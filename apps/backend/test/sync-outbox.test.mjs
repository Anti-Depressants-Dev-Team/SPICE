import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DurableSyncOutbox,
  SyncOutboxPermanentError,
} from '../app/sync-outbox.ts';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test('durable sync outbox restores the newest profile snapshots after restart', async () => {
  const storage = new MemoryStorage();
  const offline = new DurableSyncOutbox({
    storage,
    send: async () => { throw new Error('offline'); },
    retryDelayMs: () => 60_000,
  });
  offline.enqueue('profile-a', 'history', { version: 1 });
  offline.enqueue('profile-a', 'history', { version: 2 });
  offline.enqueue('profile-a', 'likes', { ids: ['one'] });
  await new Promise((resolve) => setImmediate(resolve));
  offline.dispose();

  const sent = [];
  const restored = new DurableSyncOutbox({
    storage,
    send: async (item) => { sent.push(item); },
  });
  await restored.flushAll();

  assert.deepEqual(
    sent.map((item) => [item.kind, item.payload]),
    [['history', { version: 2 }], ['likes', { ids: ['one'] }]],
  );
  assert.equal(restored.snapshot().length, 0);
  assert.equal(storage.getItem('spice_sync_outbox_v1'), null);
  restored.dispose();
});

test('durable sync outbox keeps a newer snapshot queued during an in-flight send', async () => {
  let releaseFirst;
  const firstSend = new Promise((resolve) => { releaseFirst = resolve; });
  const sent = [];
  const outbox = new DurableSyncOutbox({
    send: async (item) => {
      sent.push(item.payload.version);
      if (item.payload.version === 1) await firstSend;
    },
  });
  outbox.enqueue('profile-a', 'history', { version: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  outbox.enqueue('profile-a', 'history', { version: 2 });
  releaseFirst();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(sent, [1, 2]);
  assert.equal(outbox.snapshot().length, 0);
  outbox.dispose();
});

test('durable sync outbox surfaces permanent conflicts for explicit retry', async () => {
  let attempts = 0;
  const outbox = new DurableSyncOutbox({
    send: async () => {
      attempts += 1;
      if (attempts === 1) throw new SyncOutboxPermanentError('Resolve this account conflict.');
    },
  });
  outbox.enqueue('profile-a', 'playlists', { ids: ['one'] });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(outbox.snapshot()[0].status, 'attention');
  assert.equal(outbox.snapshot()[0].error, 'Resolve this account conflict.');
  outbox.retryAttentionItems();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(attempts, 2);
  assert.equal(outbox.snapshot().length, 0);
  outbox.dispose();
});

test('durable sync outbox cancels every pending mutation for a profile', async () => {
  const outbox = new DurableSyncOutbox({
    send: async () => { throw new Error('offline'); },
    retryDelayMs: () => 60_000,
  });
  outbox.enqueue('profile-a', 'history', {});
  outbox.enqueue('profile-a', 'likes', {});
  outbox.enqueue('profile-b', 'history', {});
  await new Promise((resolve) => setImmediate(resolve));
  outbox.cancelProfile('profile-a');

  assert.deepEqual(outbox.snapshot().map((item) => item.profileId), ['profile-b']);
  outbox.dispose();
});
