import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  isSpiceConnectLanOfferer,
  normalizeSpiceConnectLanDeviceState,
  normalizeSpiceConnectLanEnvelope,
  normalizeSpiceConnectLanSignal,
  projectSpiceConnectLanDeviceState,
  SpiceConnectLanTransport,
  SPICE_CONNECT_LAN_PROTOCOL_VERSION,
} from '../lib/spice-connect-lan.ts';

class FakeDataChannel {
  constructor(label, protocol) {
    this.label = label;
    this.protocol = protocol;
    this.readyState = 'connecting';
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
  }

  send(value) {
    this.sent.push(value);
  }

  close() {
    this.readyState = 'closed';
  }
}

class FakePeerConnection {
  constructor() {
    this.connectionState = 'new';
    this.iceGatheringState = 'complete';
    this.localDescription = null;
    this.remoteDescription = null;
    this.onconnectionstatechange = null;
    this.ondatachannel = null;
    this.channel = null;
  }

  createDataChannel(label, options) {
    this.channel = new FakeDataChannel(label, options.protocol);
    return this.channel;
  }

  async createOffer() {
    return { type: 'offer', sdp: 'v=0\r\na=spice-lan-offer\r\n' };
  }

  async createAnswer() {
    return { type: 'answer', sdp: 'v=0\r\na=spice-lan-answer\r\n' };
  }

  async setLocalDescription(description) {
    this.localDescription = description;
  }

  async setRemoteDescription(description) {
    this.remoteDescription = description;
  }

  addEventListener() {}

  removeEventListener() {}

  close() {
    this.connectionState = 'closed';
  }
}

test('LAN signaling accepts only bounded versioned offers and answers', () => {
  assert.deepEqual(
    normalizeSpiceConnectLanSignal({
      version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
      kind: 'offer',
      sessionId: 'session-1',
      description: { type: 'offer', sdp: 'v=0\r\n' },
    }),
    {
      version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
      kind: 'offer',
      sessionId: 'session-1',
      description: { type: 'offer', sdp: 'v=0\r\n' },
    },
  );
  assert.equal(normalizeSpiceConnectLanSignal({
    version: 2,
    kind: 'request',
    sessionId: 'session-1',
  }), null);
  assert.equal(normalizeSpiceConnectLanSignal({
    version: 1,
    kind: 'answer',
    sessionId: 'bad session',
    description: { type: 'answer', sdp: 'v=0\r\n' },
  }), null);
  assert.equal(normalizeSpiceConnectLanSignal({
    version: 1,
    kind: 'offer',
    sessionId: 'session-1',
    description: { type: 'answer', sdp: 'v=0\r\n' },
  }), null);
});

test('LAN device state normalization bounds untrusted peer snapshots', () => {
  const state = normalizeSpiceConnectLanDeviceState({
    deviceId: 'desktop-1',
    displayName: `  Living room ${'x'.repeat(100)}  `,
    currentTrack: { id: 'track-1' },
    queue: Array.from({ length: 100 }, (_, index) => ({ id: `track-${index}` })),
    queueIndex: 99,
    isPlaying: true,
    shuffleEnabled: true,
    repeatMode: 'one',
    progress: -10,
    duration: 999_999,
    volume: 900,
    updatedAt: '2026-07-30T10:00:00.000Z',
  });

  assert.ok(state);
  assert.equal(state.displayName.length, 80);
  assert.equal(state.queue.length, 80);
  assert.equal(state.queueIndex, 79);
  assert.equal(state.progress, 0);
  assert.equal(state.duration, 86_400);
  assert.equal(state.volume, 100);
  assert.equal(state.repeatMode, 'one');
});

test('LAN heartbeats project playing progress instead of resetting it to a stale base', () => {
  const state = normalizeSpiceConnectLanDeviceState({
    deviceId: 'desktop-1',
    displayName: 'Desktop',
    currentTrack: { id: 'track-1' },
    queue: [],
    queueIndex: 0,
    isPlaying: true,
    progress: 30,
    duration: 100,
    volume: 70,
    updatedAt: '2026-07-30T10:00:00.000Z',
  });
  assert.ok(state);
  const projected = projectSpiceConnectLanDeviceState(
    state,
    new Date('2026-07-30T10:00:15.000Z').getTime(),
  );
  assert.equal(projected.progress, 45);
  assert.equal(projected.updatedAt, '2026-07-30T10:00:15.000Z');
});

test('LAN envelopes are bound to the authenticated peer, target, session, and command allow-list', () => {
  const valid = {
    version: 1,
    type: 'command',
    sessionId: 'session-1',
    command: {
      id: 'lan-command-1',
      sourceDeviceId: 'desktop-2',
      targetDeviceId: 'desktop-1',
      command: 'pause',
      payload: {},
      createdAt: '2026-07-30T10:00:00.000Z',
    },
  };

  assert.equal(
    normalizeSpiceConnectLanEnvelope(valid, 'desktop-2', 'desktop-1', 'session-1')?.type,
    'command',
  );
  assert.equal(
    normalizeSpiceConnectLanEnvelope({
      ...valid,
      command: { ...valid.command, sourceDeviceId: 'attacker' },
    }, 'desktop-2', 'desktop-1', 'session-1'),
    null,
  );
  assert.equal(
    normalizeSpiceConnectLanEnvelope({
      ...valid,
      command: { ...valid.command, command: 'delete-everything' },
    }, 'desktop-2', 'desktop-1', 'session-1'),
    null,
  );
  assert.equal(
    normalizeSpiceConnectLanEnvelope(valid, 'desktop-2', 'desktop-1', 'other-session'),
    null,
  );
});

test('LAN negotiation deterministically chooses one offerer and uses cloud only for signaling', async () => {
  assert.equal(isSpiceConnectLanOfferer('desktop-a', 'desktop-b'), true);
  assert.equal(isSpiceConnectLanOfferer('desktop-b', 'desktop-a'), false);

  const offerSignals = [];
  const offerConnection = new FakePeerConnection();
  const offerer = new SpiceConnectLanTransport({
    localDeviceId: 'desktop-a',
    createPeerConnection: () => offerConnection,
    createSessionId: () => 'offer-session',
    sendSignal: async (targetDeviceId, signal) => {
      offerSignals.push({ targetDeviceId, signal });
      return true;
    },
    onCommand: () => {},
    onState: () => {},
  });
  await offerer.ensureConnection('desktop-b');
  assert.equal(offerSignals.length, 1);
  assert.equal(offerSignals[0].targetDeviceId, 'desktop-b');
  assert.equal(offerSignals[0].signal.kind, 'offer');
  assert.equal(offerSignals[0].signal.description.type, 'offer');
  offerer.dispose();

  const requestSignals = [];
  const requester = new SpiceConnectLanTransport({
    localDeviceId: 'desktop-b',
    createSessionId: () => 'request-session',
    sendSignal: async (targetDeviceId, signal) => {
      requestSignals.push({ targetDeviceId, signal });
      return true;
    },
    onCommand: () => {},
    onState: () => {},
  });
  await requester.ensureConnection('desktop-a');
  assert.equal(requestSignals.length, 1);
  assert.equal(requestSignals[0].signal.kind, 'request');
  requester.dispose();
});

test('LAN answerer accepts an authenticated deterministic offer and returns one answer', async () => {
  const answerSignals = [];
  const connection = new FakePeerConnection();
  const answerer = new SpiceConnectLanTransport({
    localDeviceId: 'desktop-z',
    createPeerConnection: () => connection,
    sendSignal: async (targetDeviceId, signal) => {
      answerSignals.push({ targetDeviceId, signal });
      return true;
    },
    onCommand: () => {},
    onState: () => {},
  });

  const accepted = await answerer.handleSignal('desktop-a', {
    version: 1,
    kind: 'offer',
    sessionId: 'session-1',
    description: { type: 'offer', sdp: 'v=0\r\na=remote-offer\r\n' },
  });
  assert.equal(accepted, true);
  assert.equal(connection.remoteDescription.type, 'offer');
  assert.equal(answerSignals.length, 1);
  assert.equal(answerSignals[0].targetDeviceId, 'desktop-a');
  assert.equal(answerSignals[0].signal.kind, 'answer');
  assert.equal(answerSignals[0].signal.description.type, 'answer');
  answerer.dispose();
});

test('LAN data channel stays unusable until the expected peer proves its signaled identity', async () => {
  const connection = new FakePeerConnection();
  const connectedSnapshots = [];
  const receivedCommands = [];
  const transport = new SpiceConnectLanTransport({
    localDeviceId: 'desktop-a',
    createPeerConnection: () => connection,
    createSessionId: () => 'session-1',
    now: () => new Date('2026-07-30T10:00:00.000Z').getTime(),
    sendSignal: async () => true,
    onCommand: (command) => receivedCommands.push(command),
    onState: () => {},
    onPeersChanged: (peers) => connectedSnapshots.push(peers),
  });
  await transport.ensureConnection('desktop-b');
  connection.channel.readyState = 'open';
  connection.channel.onopen();
  assert.equal(transport.sendCommand('desktop-b', 'pause'), false);

  connection.channel.onmessage({
    data: JSON.stringify({
      version: 1,
      type: 'hello',
      sessionId: 'session-1',
      deviceId: 'desktop-b',
    }),
  });
  assert.deepEqual(transport.connectedPeerDeviceIds(), ['desktop-b']);
  assert.deepEqual(connectedSnapshots.at(-1), ['desktop-b']);
  assert.equal(transport.sendCommand('desktop-b', 'pause'), true);
  assert.equal(JSON.parse(connection.channel.sent.at(-1)).command.command, 'pause');

  connection.channel.onmessage({
    data: JSON.stringify({
      version: 1,
      type: 'command',
      sessionId: 'session-1',
      command: {
        id: 'direct-1',
        sourceDeviceId: 'desktop-b',
        targetDeviceId: 'desktop-a',
        command: 'play',
        payload: {},
        createdAt: '2026-07-30T10:00:00.000Z',
      },
    }),
  });
  assert.equal(receivedCommands.length, 1);
  assert.equal(receivedCommands[0].command, 'play');
  transport.dispose();
});

test('LAN transport measures round-trip latency only from its matching authenticated pong', async () => {
  const connection = new FakePeerConnection();
  const latencies = [];
  let now = 10_000;
  const transport = new SpiceConnectLanTransport({
    localDeviceId: 'desktop-a',
    createPeerConnection: () => connection,
    createSessionId: () => 'session-1',
    now: () => now,
    sendSignal: async () => true,
    onCommand: () => {},
    onState: () => {},
    onPeerLatency: (peerDeviceId, roundTripMs) => latencies.push({ peerDeviceId, roundTripMs }),
  });
  await transport.ensureConnection('desktop-b');
  connection.channel.readyState = 'open';
  connection.channel.onopen();
  connection.channel.onmessage({
    data: JSON.stringify({
      version: 1,
      type: 'hello',
      sessionId: 'session-1',
      deviceId: 'desktop-b',
    }),
  });
  const ping = connection.channel.sent
    .map((entry) => JSON.parse(entry))
    .findLast((entry) => entry.type === 'ping');
  assert.ok(ping);

  now += 12;
  connection.channel.onmessage({
    data: JSON.stringify({
      version: 1,
      type: 'pong',
      sessionId: 'session-1',
      sentAt: ping.sentAt + 1,
    }),
  });
  assert.deepEqual(latencies, []);
  connection.channel.onmessage({
    data: JSON.stringify({
      version: 1,
      type: 'pong',
      sessionId: 'session-1',
      sentAt: ping.sentAt,
    }),
  });
  assert.deepEqual(latencies, [{ peerDeviceId: 'desktop-b', roundTripMs: 12 }]);
  transport.dispose();
});

test('SPICE desktop and Android prefer verified LAN delivery while preserving cloud fallback', async () => {
  const [appSource, androidSource, androidTransport, roadmap] = await Promise.all([
    readFile(new URL('../app/spice-app.tsx', import.meta.url), 'utf8'),
    readFile(new URL(
      '../../mobile/android/app/src/main/java/xyz/spiceapp/mobile/SpiceViewModel.kt',
      import.meta.url,
    ), 'utf8'),
    readFile(new URL(
      '../../mobile/android/app/src/main/java/xyz/spiceapp/mobile/data/SpiceConnectLanTransport.kt',
      import.meta.url,
    ), 'utf8'),
    readFile(new URL('../docs/local-mode-roadmap.md', import.meta.url), 'utf8'),
  ]);
  const sendStart = appSource.indexOf('async function sendRemoteCommand(');
  const sendEnd = appSource.indexOf('sendRemoteCommandRef.current = sendRemoteCommand', sendStart);
  const sendSource = appSource.slice(sendStart, sendEnd);

  assert.ok(sendStart >= 0);
  assert.ok(sendSource.indexOf('remoteLanTransportRef.current?.sendCommand(') >= 0);
  assert.ok(sendSource.indexOf('remoteLanTransportRef.current?.sendCommand(') < sendSource.indexOf("spiceFetch('cloud', '/remote/commands'"));
  assert.match(appSource, /command\.command === SPICE_CONNECT_LAN_SIGNAL_COMMAND[\s\S]*?handleSignal/);
  assert.match(appSource, /selectedRemoteDeviceId && !selectedRemoteDeviceUsesLan/);
  assert.doesNotMatch(appSource, /patchSelectedRemoteQueueStep/);
  assert.match(appSource, /Ctrl\+Shift\+Alt\+L/);
  assert.match(appSource, /SPICE CONNECT TRACE/);
  assert.match(appSource, /Playback command route/);
  assert.match(appSource, /Cloud signaling and fallback/);
  assert.doesNotMatch(appSource, /Redis fast path is active/);
  assert.match(androidSource, /spiceConnectLanTransport\?\.sendCommand\(deviceId, command, payload\)/);
  assert.match(androidSource, /handleSignal\(command\.sourceDeviceId, command\.payloadJson\)/);
  assert.doesNotMatch(androidSource, /patchRemoteQueueStep/);
  assert.match(androidTransport, /PeerConnection\.RTCConfiguration\(emptyList\(\)\)/);
  assert.match(androidTransport, /command == SPICE_CONNECT_LAN_SIGNAL_COMMAND/);
  assert.match(roadmap, /desktop, web, and Android peers/);
});
