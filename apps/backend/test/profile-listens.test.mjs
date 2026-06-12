import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveLastFmSessionKey } from '../lib/profile-listens.ts';

test('profile listen resolver prefers a provided Last.fm session key', async () => {
  let sessionLookups = 0;
  let connectionLookups = 0;

  const sessionKey = await resolveLastFmSessionKey({
    provider: { sessionKey: ' browser-session ' },
    databaseConfigured: true,
    getSessionUserId: async () => {
      sessionLookups += 1;
      return 'user-1';
    },
    getConnection: async () => {
      connectionLookups += 1;
      return { sessionKey: 'account-session' };
    },
  });

  assert.equal(sessionKey, 'browser-session');
  assert.equal(sessionLookups, 0);
  assert.equal(connectionLookups, 0);
});

test('profile listen resolver uses the account-backed Last.fm session when requested', async () => {
  const sessionKey = await resolveLastFmSessionKey({
    provider: {},
    databaseConfigured: true,
    getSessionUserId: async () => 'user-1',
    getConnection: async (userId) => {
      assert.equal(userId, 'user-1');
      return { sessionKey: 'account-session' };
    },
  });

  assert.equal(sessionKey, 'account-session');
});

test('profile listen resolver skips backend Last.fm lookup when provider was not requested', async () => {
  let sessionLookups = 0;

  const sessionKey = await resolveLastFmSessionKey({
    provider: undefined,
    databaseConfigured: true,
    getSessionUserId: async () => {
      sessionLookups += 1;
      return 'user-1';
    },
    getConnection: async () => {
      throw new Error('connection lookup should not run');
    },
  });

  assert.equal(sessionKey, undefined);
  assert.equal(sessionLookups, 0);
});

test('profile listen resolver skips account lookup when database is not configured', async () => {
  let sessionLookups = 0;

  const sessionKey = await resolveLastFmSessionKey({
    provider: {},
    databaseConfigured: false,
    getSessionUserId: async () => {
      sessionLookups += 1;
      return 'user-1';
    },
    getConnection: async () => {
      throw new Error('connection lookup should not run');
    },
  });

  assert.equal(sessionKey, undefined);
  assert.equal(sessionLookups, 0);
});
