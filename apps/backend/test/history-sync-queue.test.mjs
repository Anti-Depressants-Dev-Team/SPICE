import assert from 'node:assert/strict';
import test from 'node:test';

import { HistorySyncQueue } from '../app/history-sync-queue.ts';

test('history sync coalesces a profile to its newest snapshot after an in-flight write', async () => {
  const sent = [];
  let releaseFirst;
  const firstWrite = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const queue = new HistorySyncQueue(async (profileId, history) => {
    sent.push({ profileId, history });
    if (sent.length === 1) await firstWrite;
  });

  queue.enqueue('profile-a', ['first']);
  queue.enqueue('profile-a', ['second', 'first']);
  assert.deepEqual(sent, [{ profileId: 'profile-a', history: ['first'] }]);

  releaseFirst();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(sent, [
    { profileId: 'profile-a', history: ['first'] },
    { profileId: 'profile-a', history: ['second', 'first'] },
  ]);
});

test('history sync retains a failed snapshot and retries it with its captured profile payload', async () => {
  const sent = [];
  let attempts = 0;
  let observeRetry;
  const retried = new Promise((resolve) => {
    observeRetry = resolve;
  });
  const queue = new HistorySyncQueue(
    async (profileId, snapshot) => {
      attempts += 1;
      sent.push({ profileId, snapshot });
      if (attempts === 1) throw new Error('temporary network failure');
      observeRetry();
    },
    undefined,
    () => 0,
  );
  const snapshot = { history: ['first'], token: 'profile-a-token' };

  queue.enqueue('profile-a', snapshot);
  await retried;

  assert.equal(attempts, 2);
  assert.deepEqual(sent, [
    { profileId: 'profile-a', snapshot },
    { profileId: 'profile-a', snapshot },
  ]);
  queue.dispose();
});

test('history sync retries a newer snapshot instead of resurrecting a failed older one', async () => {
  const sent = [];
  let releaseFirst;
  const firstSend = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let observeFirst;
  const firstStarted = new Promise((resolve) => {
    observeFirst = resolve;
  });
  let observeReplacement;
  const replacementSent = new Promise((resolve) => {
    observeReplacement = resolve;
  });
  const queue = new HistorySyncQueue(
    async (profileId, snapshot) => {
      sent.push({ profileId, snapshot });
      if (sent.length === 1) {
        observeFirst();
        await firstSend;
        throw new Error('temporary network failure');
      }
      observeReplacement();
    },
    undefined,
    () => 0,
  );
  const firstSnapshot = { history: ['older'], token: 'old-token' };
  const replacement = { history: ['newer'], token: 'new-token' };

  queue.enqueue('profile-a', firstSnapshot);
  await firstStarted;
  queue.enqueue('profile-a', replacement);
  releaseFirst();
  await replacementSent;

  assert.deepEqual(sent, [
    { profileId: 'profile-a', snapshot: firstSnapshot },
    { profileId: 'profile-a', snapshot: replacement },
  ]);
  queue.dispose();
});

test('history sync cancellation prevents an in-flight failure from scheduling a retry', async () => {
  const sent = [];
  let releaseFirst;
  const firstSend = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let observeFirst;
  const firstStarted = new Promise((resolve) => {
    observeFirst = resolve;
  });
  let retryDelayCalls = 0;
  const queue = new HistorySyncQueue(
    async (profileId, snapshot) => {
      sent.push({ profileId, snapshot });
      observeFirst();
      await firstSend;
      throw new Error('temporary network failure');
    },
    undefined,
    () => {
      retryDelayCalls += 1;
      return 60_000;
    },
  );

  queue.enqueue('profile-a', { history: ['first'], token: 'profile-a-token' });
  await firstStarted;
  queue.cancel('profile-a');
  releaseFirst();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(sent.length, 1);
  assert.equal(retryDelayCalls, 0);
  queue.dispose();
});

test('history sync keeps independent profile payloads bound to their own profile', async () => {
  const sent = [];
  const queue = new HistorySyncQueue(async (profileId, snapshot) => {
    sent.push({ profileId, snapshot });
  });

  queue.enqueue('profile-a', { history: ['a-track'], token: 'profile-a-token' });
  queue.enqueue('profile-b', { history: ['b-track'], token: 'profile-b-token' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(sent, [
    { profileId: 'profile-a', snapshot: { history: ['a-track'], token: 'profile-a-token' } },
    { profileId: 'profile-b', snapshot: { history: ['b-track'], token: 'profile-b-token' } },
  ]);
  queue.dispose();
});
