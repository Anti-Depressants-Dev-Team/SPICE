import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test, { afterEach } from 'node:test';

import { tsImport } from 'tsx/esm/api';

const tsconfig = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
const {
  __setSpiceConnectRedisForTests,
  cacheSpiceConnectPairedAuthorization,
  claimSpiceConnectCommands,
  clearSpiceConnectForgottenDevice,
  deleteSpiceConnectDeviceState,
  enqueueSpiceConnectCommand,
  invalidateSpiceConnectPairedAuthorization,
  readSpiceConnectDeviceStates,
  readSpiceConnectPairedAuthorization,
  rememberSpiceConnectForgottenDevice,
  removeSpiceConnectCommandsForDevice,
  reserveSpiceConnectDeviceCheckpoint,
  writeSpiceConnectDeviceState,
} = await tsImport('../lib/spice-connect-redis.ts', {
  parentURL: import.meta.url,
  tsconfig,
});
import {
  SPICE_CONNECT_COMMAND_REDELIVERY_MS,
  SPICE_CONNECT_COMMAND_TTL_MS,
} from '../lib/spice-connect.ts';

class FakeRedis {
  strings = new Map();
  hashes = new Map();
  expirations = new Map();
  operations = [];

  _hash(key) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    return this.hashes.get(key);
  }

  async hset(key, values) {
    this.operations.push(['hset', key, Object.keys(values)]);
    const hash = this._hash(key);
    for (const [field, value] of Object.entries(values)) hash.set(field, value);
    return Object.keys(values).length;
  }

  async hgetall(key) {
    this.operations.push(['hgetall', key]);
    const hash = this.hashes.get(key);
    return hash ? Object.fromEntries(hash) : null;
  }

  async hget(key, field) {
    this.operations.push(['hget', key, field]);
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hdel(key, ...fields) {
    this.operations.push(['hdel', key, fields]);
    const hash = this.hashes.get(key);
    let removed = 0;
    for (const field of fields) {
      if (hash?.delete(field)) removed += 1;
    }
    return removed;
  }

  async expire(key, seconds) {
    this.operations.push(['expire', key, seconds]);
    this.expirations.set(key, seconds);
    return 1;
  }

  async set(key, value, options = {}) {
    this.operations.push(['set', key, options]);
    if (options.nx && this.strings.has(key)) return null;
    this.strings.set(key, value);
    if (options.ex) this.expirations.set(key, options.ex);
    return 'OK';
  }

  async get(key) {
    this.operations.push(['get', key]);
    return this.strings.get(key) ?? null;
  }

  async mset(values) {
    this.operations.push(['mset', Object.keys(values)]);
    for (const [key, value] of Object.entries(values)) this.strings.set(key, value);
    return 'OK';
  }

  async del(...keys) {
    this.operations.push(['del', keys]);
    let removed = 0;
    for (const key of keys) {
      if (this.strings.delete(key)) removed += 1;
      if (this.hashes.delete(key)) removed += 1;
      this.expirations.delete(key);
    }
    return removed;
  }

  async publish(channel, signal) {
    this.operations.push(['publish', channel, signal]);
    return 1;
  }

  pipeline() {
    const pending = [];
    const pipeline = {};
    for (const method of ['hset', 'hdel', 'expire', 'set']) {
      pipeline[method] = (...args) => {
        pending.push(() => this[method](...args));
        return pipeline;
      };
    }
    pipeline.exec = async () => Promise.all(pending.map((operation) => operation()));
    return pipeline;
  }
}

const cachedDevice = (overrides = {}) => ({
  deviceId: 'desktop',
  displayName: 'Desktop',
  pairedAuthorizationHash: null,
  currentTrack: { id: 'yt-1', title: 'Redis path' },
  queue: [{ id: 'yt-1', title: 'Redis path' }],
  queueIndex: 0,
  isPlaying: true,
  shuffleEnabled: false,
  repeatMode: 'none',
  progressMs: 12_000,
  durationMs: 180_000,
  volume: 72,
  updatedAt: new Date().toISOString(),
  ...overrides,
});

afterEach(() => {
  __setSpiceConnectRedisForTests(undefined);
});

test('Redis device state is written, read, expired, and deleted through real helper behavior', async () => {
  const redis = new FakeRedis();
  __setSpiceConnectRedisForTests(redis);

  assert.equal(await writeSpiceConnectDeviceState('user-1', cachedDevice()), true);
  const states = await readSpiceConnectDeviceStates('user-1');
  assert.equal(states.length, 1);
  assert.equal(states[0].deviceId, 'desktop');
  assert.equal(states[0].currentTrack.title, 'Redis path');

  const deviceExpiration = redis.operations.find(
    ([operation, key]) => operation === 'expire' && key.includes(':devices:'),
  );
  assert.ok(deviceExpiration);
  assert.ok(deviceExpiration[2] >= 30 * 24 * 60 * 60);

  assert.equal(await deleteSpiceConnectDeviceState('user-1', 'desktop'), true);
  assert.deepEqual(await readSpiceConnectDeviceStates('user-1'), []);
});

test('Redis command queues deliver once, respect redelivery delay, and retain a bounded TTL', async () => {
  const redis = new FakeRedis();
  __setSpiceConnectRedisForTests(redis);
  const createdAt = new Date('2026-07-26T12:00:00.000Z');
  const command = {
    id: 'command-1',
    sourceDeviceId: 'phone',
    targetDeviceId: 'desktop',
    command: 'handoff_prepare',
    payloadJson: '{"transferId":"transfer-1"}',
    createdAt: createdAt.toISOString(),
    consumedAt: null,
    deliveryAttempts: 0,
  };

  assert.equal(await enqueueSpiceConnectCommand('user-1', command), true);
  const queueExpiration = redis.operations.find(
    ([operation, key]) => operation === 'expire' && key.includes(':commands:'),
  );
  assert.ok(queueExpiration);
  assert.ok(queueExpiration[2] >= Math.ceil(SPICE_CONNECT_COMMAND_TTL_MS / 1000));
  assert.ok(queueExpiration[2] <= Math.ceil(SPICE_CONNECT_COMMAND_TTL_MS / 1000) + 60);

  const first = await claimSpiceConnectCommands('user-1', 'desktop', createdAt);
  assert.equal(first.length, 1);
  assert.equal(first[0].deliveryAttempts, 1);
  assert.equal(first[0].consumedAt, createdAt.toISOString());

  const immediate = await claimSpiceConnectCommands(
    'user-1',
    'desktop',
    new Date(createdAt.getTime() + SPICE_CONNECT_COMMAND_REDELIVERY_MS - 1),
  );
  assert.deepEqual(immediate, []);

  const redelivered = await claimSpiceConnectCommands(
    'user-1',
    'desktop',
    new Date(createdAt.getTime() + SPICE_CONNECT_COMMAND_REDELIVERY_MS),
  );
  assert.equal(redelivered.length, 1);
  assert.equal(redelivered[0].deliveryAttempts, 2);
});

test('forgetting a Redis device removes commands sent by it and addressed to it', async () => {
  const redis = new FakeRedis();
  __setSpiceConnectRedisForTests(redis);
  const createdAt = new Date('2026-07-26T12:00:00.000Z').toISOString();
  const command = (id, sourceDeviceId, targetDeviceId) => ({
    id,
    sourceDeviceId,
    targetDeviceId,
    command: 'play',
    payloadJson: '{}',
    createdAt,
    consumedAt: null,
    deliveryAttempts: 0,
  });

  await enqueueSpiceConnectCommand('user-1', command('sent-by-phone', 'phone', 'desktop'));
  await enqueueSpiceConnectCommand('user-1', command('sent-to-phone', 'desktop', 'phone'));
  await enqueueSpiceConnectCommand('user-1', command('unrelated', 'tablet', 'desktop'));

  assert.equal(await removeSpiceConnectCommandsForDevice('user-1', 'phone'), true);
  const desktopCommands = await claimSpiceConnectCommands(
    'user-1',
    'desktop',
    new Date(createdAt),
  );
  assert.deepEqual(desktopCommands.map((entry) => entry.id), ['unrelated']);
  assert.deepEqual(
    await claimSpiceConnectCommands('user-1', 'phone', new Date(createdAt)),
    null,
  );
});

test('Redis paired authorization cache rotates and invalidates the exact device generation', async () => {
  const redis = new FakeRedis();
  __setSpiceConnectRedisForTests(redis);
  const authorization = {
    authorizationId: 'authorization-1',
    userId: 'user-1',
    deviceId: 'phone',
    authorizationHash: 'hash-generation-1',
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
  };

  assert.equal(await cacheSpiceConnectPairedAuthorization(authorization), true);
  assert.deepEqual(
    await readSpiceConnectPairedAuthorization(authorization.authorizationHash),
    authorization,
  );
  assert.equal(
    await invalidateSpiceConnectPairedAuthorization(
      authorization.userId,
      authorization.deviceId,
      authorization.authorizationHash,
    ),
    true,
  );
  assert.equal(await readSpiceConnectPairedAuthorization(authorization.authorizationHash), null);
});

test('forgotten paired devices are filtered and cannot reappear from a delayed heartbeat', async () => {
  const redis = new FakeRedis();
  __setSpiceConnectRedisForTests(redis);
  const state = cachedDevice({
    deviceId: 'old-phone',
    pairedAuthorizationHash: 'revoked-hash',
  });

  assert.equal(await writeSpiceConnectDeviceState('user-1', state), true);
  assert.equal(
    await rememberSpiceConnectForgottenDevice('user-1', 'old-phone', 'revoked-hash'),
    true,
  );
  assert.deepEqual(await readSpiceConnectDeviceStates('user-1'), []);

  assert.equal(await writeSpiceConnectDeviceState('user-1', {
    ...state,
    updatedAt: new Date(Date.now() + 1_000).toISOString(),
  }), 'forgotten');
  assert.deepEqual(await readSpiceConnectDeviceStates('user-1'), []);

  assert.equal(
    await rememberSpiceConnectForgottenDevice('user-1', 'old-phone', 'older-revoked-hash'),
    true,
  );
  assert.equal(
    await clearSpiceConnectForgottenDevice('user-1', 'old-phone', 'new-hash'),
    true,
  );
  assert.equal(await writeSpiceConnectDeviceState('user-1', {
    ...state,
    pairedAuthorizationHash: 'new-hash',
    updatedAt: new Date(Date.now() + 2_000).toISOString(),
  }), true);
  assert.equal((await readSpiceConnectDeviceStates('user-1')).length, 1);

  assert.equal(await writeSpiceConnectDeviceState('user-1', {
    ...state,
    pairedAuthorizationHash: 'older-revoked-hash',
    updatedAt: new Date(Date.now() + 3_000).toISOString(),
  }), 'forgotten');
  assert.deepEqual(
    (await readSpiceConnectDeviceStates('user-1')).map((entry) => entry.pairedAuthorizationHash),
    ['new-hash'],
  );
});

test('Redis checkpoint writes durable state once per checkpoint window', async () => {
  const redis = new FakeRedis();
  __setSpiceConnectRedisForTests(redis);

  assert.equal(await reserveSpiceConnectDeviceCheckpoint('user-1', 'desktop', null), true);
  assert.equal(await reserveSpiceConnectDeviceCheckpoint('user-1', 'desktop', null), false);
});

test('Redis failures return fallback sentinels instead of breaking Spice Connect', async () => {
  const redis = new FakeRedis();
  redis.hgetall = async () => {
    throw new Error('simulated outage');
  };
  __setSpiceConnectRedisForTests(redis);

  assert.equal(await readSpiceConnectDeviceStates('user-1'), null);
  __setSpiceConnectRedisForTests(null);
  assert.equal(await writeSpiceConnectDeviceState('user-1', cachedDevice()), false);
  assert.equal(await enqueueSpiceConnectCommand('user-1', {
    id: 'command-2',
    sourceDeviceId: 'phone',
    targetDeviceId: 'desktop',
    command: 'play',
    payloadJson: '{}',
    createdAt: new Date().toISOString(),
    consumedAt: null,
    deliveryAttempts: 0,
  }), false);
});
