import {
  isSpiceConnectCommandType,
  type SpiceConnectCommandType,
  type SpiceConnectRepeatMode,
} from './spice-connect.ts';

export const SPICE_CONNECT_LAN_PROTOCOL_VERSION = 1;
export const SPICE_CONNECT_LAN_SIGNAL_COMMAND = 'lan_signal' as const;
export const SPICE_CONNECT_LAN_CHANNEL_LABEL = 'spice-connect-lan';
export const SPICE_CONNECT_LAN_CHANNEL_PROTOCOL = 'spice-connect-lan-v1';
export const SPICE_CONNECT_LAN_MAX_MESSAGE_BYTES = 512 * 1024;
export const SPICE_CONNECT_LAN_MAX_PEERS = 8;
export const SPICE_CONNECT_LAN_NEGOTIATION_TIMEOUT_MS = 15_000;
export const SPICE_CONNECT_LAN_PEER_TIMEOUT_MS = 45_000;
export const SPICE_CONNECT_LAN_HEARTBEAT_INTERVAL_MS = 15_000;

export type SpiceConnectLanSignalKind = 'request' | 'offer' | 'answer';

export interface SpiceConnectLanSignal {
  version: 1;
  kind: SpiceConnectLanSignalKind;
  sessionId: string;
  description?: RTCSessionDescriptionInit;
}

export interface SpiceConnectLanDeviceState {
  deviceId: string;
  displayName: string;
  currentTrack: unknown;
  queue: unknown[];
  queueIndex: number;
  isPlaying: boolean;
  shuffleEnabled: boolean;
  repeatMode: SpiceConnectRepeatMode;
  progress: number;
  duration: number;
  volume: number;
  updatedAt: string;
}

export interface SpiceConnectLanCommand {
  id: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  command: Exclude<SpiceConnectCommandType, typeof SPICE_CONNECT_LAN_SIGNAL_COMMAND>;
  payload: Record<string, unknown>;
  createdAt: string;
}

type SpiceConnectLanEnvelope =
  | {
      version: 1;
      type: 'hello';
      sessionId: string;
      deviceId: string;
    }
  | {
      version: 1;
      type: 'command';
      sessionId: string;
      command: SpiceConnectLanCommand;
    }
  | {
      version: 1;
      type: 'state';
      sessionId: string;
      state: SpiceConnectLanDeviceState;
    }
  | {
      version: 1;
      type: 'ping' | 'pong';
      sessionId: string;
      sentAt: number;
    };

interface SpiceConnectLanPeer {
  peerDeviceId: string;
  sessionId: string;
  connection: RTCPeerConnection;
  channel: RTCDataChannel | null;
  verified: boolean;
  createdAt: number;
  lastSeenAt: number;
  pendingPingSentAt: number | null;
}

export interface SpiceConnectLanTransportOptions {
  localDeviceId: string;
  sendSignal: (targetDeviceId: string, signal: SpiceConnectLanSignal) => Promise<boolean>;
  onCommand: (command: SpiceConnectLanCommand) => void;
  onState: (peerDeviceId: string, state: SpiceConnectLanDeviceState) => void;
  onPeersChanged?: (connectedPeerDeviceIds: string[]) => void;
  onPeerLatency?: (peerDeviceId: string, roundTripMs: number) => void;
  onDiagnostic?: (message: string) => void;
  createPeerConnection?: () => RTCPeerConnection;
  now?: () => number;
  createSessionId?: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function normalizedDeviceId(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}

function normalizedSessionId(value: unknown) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().slice(0, 160);
  return /^[a-zA-Z0-9:_-]+$/.test(normalized) ? normalized : '';
}

function normalizedDescription(value: unknown, expectedType: 'offer' | 'answer') {
  if (!isRecord(value) || value.type !== expectedType || typeof value.sdp !== 'string') return null;
  if (!value.sdp || value.sdp.length > 128 * 1024) return null;
  return { type: expectedType, sdp: value.sdp } satisfies RTCSessionDescriptionInit;
}

function randomSessionId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2);
  return `lan-${Date.now().toString(36)}-${random}`;
}

export function isSpiceConnectLanOfferer(localDeviceId: string, peerDeviceId: string) {
  return normalizedDeviceId(localDeviceId).localeCompare(normalizedDeviceId(peerDeviceId)) < 0;
}

export function normalizeSpiceConnectLanSignal(value: unknown): SpiceConnectLanSignal | null {
  if (!isRecord(value) || value.version !== SPICE_CONNECT_LAN_PROTOCOL_VERSION) return null;
  const sessionId = normalizedSessionId(value.sessionId);
  if (!sessionId) return null;

  if (value.kind === 'request') {
    return { version: SPICE_CONNECT_LAN_PROTOCOL_VERSION, kind: 'request', sessionId };
  }
  if (value.kind === 'offer') {
    const description = normalizedDescription(value.description, 'offer');
    return description
      ? { version: SPICE_CONNECT_LAN_PROTOCOL_VERSION, kind: 'offer', sessionId, description }
      : null;
  }
  if (value.kind === 'answer') {
    const description = normalizedDescription(value.description, 'answer');
    return description
      ? { version: SPICE_CONNECT_LAN_PROTOCOL_VERSION, kind: 'answer', sessionId, description }
      : null;
  }
  return null;
}

export function normalizeSpiceConnectLanDeviceState(value: unknown): SpiceConnectLanDeviceState | null {
  if (!isRecord(value)) return null;
  const deviceId = normalizedDeviceId(value.deviceId);
  if (!deviceId) return null;
  const displayName = typeof value.displayName === 'string' && value.displayName.trim()
    ? value.displayName.trim().slice(0, 80)
    : 'Spice Connect Device';
  const queue = Array.isArray(value.queue) ? value.queue.slice(0, 80) : [];
  const queueIndex = Math.round(boundedNumber(value.queueIndex, 0, 0, Math.max(queue.length - 1, 0)));
  const repeatMode = value.repeatMode === 'all' || value.repeatMode === 'one' ? value.repeatMode : 'none';
  const updatedAtMs = typeof value.updatedAt === 'string' ? new Date(value.updatedAt).getTime() : Number.NaN;

  return {
    deviceId,
    displayName,
    currentTrack: isRecord(value.currentTrack) ? value.currentTrack : null,
    queue,
    queueIndex,
    isPlaying: value.isPlaying === true,
    shuffleEnabled: value.shuffleEnabled === true,
    repeatMode,
    progress: boundedNumber(value.progress, 0, 0, 24 * 60 * 60),
    duration: boundedNumber(value.duration, 0, 0, 24 * 60 * 60),
    volume: Math.round(boundedNumber(value.volume, 70, 0, 100)),
    updatedAt: Number.isFinite(updatedAtMs) ? new Date(updatedAtMs).toISOString() : new Date().toISOString(),
  };
}

export function projectSpiceConnectLanDeviceState(
  state: SpiceConnectLanDeviceState,
  now: number = Date.now(),
) {
  const updatedAt = new Date(state.updatedAt).getTime();
  const elapsedSeconds = state.isPlaying && Number.isFinite(updatedAt)
    ? Math.max(0, Math.min((now - updatedAt) / 1000, 120))
    : 0;
  const projectedProgress = Math.min(
    state.duration || Number.POSITIVE_INFINITY,
    state.progress + elapsedSeconds,
  );
  return {
    ...state,
    progress: Math.max(0, projectedProgress),
    updatedAt: new Date(now).toISOString(),
  };
}

export function normalizeSpiceConnectLanEnvelope(
  rawValue: unknown,
  expectedPeerDeviceId: string,
  localDeviceId: string,
  expectedSessionId: string,
): SpiceConnectLanEnvelope | null {
  if (!isRecord(rawValue) || rawValue.version !== SPICE_CONNECT_LAN_PROTOCOL_VERSION) return null;
  if (normalizedSessionId(rawValue.sessionId) !== expectedSessionId) return null;

  if (rawValue.type === 'hello') {
    return normalizedDeviceId(rawValue.deviceId) === expectedPeerDeviceId
      ? {
          version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
          type: 'hello',
          sessionId: expectedSessionId,
          deviceId: expectedPeerDeviceId,
        }
      : null;
  }

  if (rawValue.type === 'command' && isRecord(rawValue.command)) {
    const command = rawValue.command;
    const id = typeof command.id === 'string' ? command.id.trim().slice(0, 200) : '';
    const sourceDeviceId = normalizedDeviceId(command.sourceDeviceId);
    const targetDeviceId = normalizedDeviceId(command.targetDeviceId);
    const commandName = typeof command.command === 'string' ? command.command : '';
    const createdAtMs = typeof command.createdAt === 'string'
      ? new Date(command.createdAt).getTime()
      : Number.NaN;
    if (
      !id
      || sourceDeviceId !== expectedPeerDeviceId
      || targetDeviceId !== localDeviceId
      || !isSpiceConnectCommandType(commandName)
      || commandName === SPICE_CONNECT_LAN_SIGNAL_COMMAND
      || !Number.isFinite(createdAtMs)
    ) return null;

    return {
      version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
      type: 'command',
      sessionId: expectedSessionId,
      command: {
        id,
        sourceDeviceId,
        targetDeviceId,
        command: commandName as SpiceConnectLanCommand['command'],
        payload: isRecord(command.payload) ? command.payload : {},
        createdAt: new Date(createdAtMs).toISOString(),
      },
    };
  }

  if (rawValue.type === 'state') {
    const state = normalizeSpiceConnectLanDeviceState(rawValue.state);
    return state?.deviceId === expectedPeerDeviceId
      ? {
          version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
          type: 'state',
          sessionId: expectedSessionId,
          state,
        }
      : null;
  }

  if ((rawValue.type === 'ping' || rawValue.type === 'pong') && Number.isFinite(rawValue.sentAt)) {
    return {
      version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
      type: rawValue.type,
      sessionId: expectedSessionId,
      sentAt: Number(rawValue.sentAt),
    };
  }
  return null;
}

function waitForIceGathering(connection: RTCPeerConnection) {
  if (connection.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      connection.removeEventListener('icegatheringstatechange', handleStateChange);
      clearTimeout(timeoutId);
      resolve();
    };
    const handleStateChange = () => {
      if (connection.iceGatheringState === 'complete') finish();
    };
    const timeoutId = setTimeout(finish, 3_000);
    connection.addEventListener('icegatheringstatechange', handleStateChange);
  });
}

export class SpiceConnectLanTransport {
  private readonly localDeviceId: string;
  private readonly sendSignalCallback: SpiceConnectLanTransportOptions['sendSignal'];
  private readonly onCommandCallback: SpiceConnectLanTransportOptions['onCommand'];
  private readonly onStateCallback: SpiceConnectLanTransportOptions['onState'];
  private readonly onPeersChangedCallback?: SpiceConnectLanTransportOptions['onPeersChanged'];
  private readonly onPeerLatencyCallback?: SpiceConnectLanTransportOptions['onPeerLatency'];
  private readonly onDiagnosticCallback?: SpiceConnectLanTransportOptions['onDiagnostic'];
  private readonly createPeerConnection: () => RTCPeerConnection;
  private readonly now: () => number;
  private readonly createSessionId: () => string;
  private readonly peers = new Map<string, SpiceConnectLanPeer>();
  private readonly pendingRequests = new Map<string, { sessionId: string; createdAt: number }>();
  private readonly heartbeatTimer: ReturnType<typeof setInterval>;
  private latestLocalState: SpiceConnectLanDeviceState | null = null;
  private disposed = false;

  constructor(options: SpiceConnectLanTransportOptions) {
    this.localDeviceId = normalizedDeviceId(options.localDeviceId);
    if (!this.localDeviceId) throw new Error('A local Spice Connect device id is required.');
    this.sendSignalCallback = options.sendSignal;
    this.onCommandCallback = options.onCommand;
    this.onStateCallback = options.onState;
    this.onPeersChangedCallback = options.onPeersChanged;
    this.onPeerLatencyCallback = options.onPeerLatency;
    this.onDiagnosticCallback = options.onDiagnostic;
    this.createPeerConnection = options.createPeerConnection ?? (() => new RTCPeerConnection({
      // Intentionally host-only: this path is for peers on the same LAN and
      // must never become an unapproved internet relay.
      iceServers: [],
    }));
    this.now = options.now ?? (() => Date.now());
    this.createSessionId = options.createSessionId ?? randomSessionId;
    this.heartbeatTimer = setInterval(() => this.heartbeat(), SPICE_CONNECT_LAN_HEARTBEAT_INTERVAL_MS);
  }

  connectedPeerDeviceIds() {
    return [...this.peers.values()]
      .filter((peer) => this.isPeerReady(peer))
      .map((peer) => peer.peerDeviceId)
      .sort();
  }

  async ensureConnection(peerDeviceIdValue: string) {
    const peerDeviceId = normalizedDeviceId(peerDeviceIdValue);
    if (this.disposed || !peerDeviceId || peerDeviceId === this.localDeviceId) return;
    const existing = this.peers.get(peerDeviceId);
    if (existing && (this.isPeerReady(existing) || this.now() - existing.createdAt < SPICE_CONNECT_LAN_NEGOTIATION_TIMEOUT_MS)) {
      return;
    }
    if (existing) this.closePeer(peerDeviceId, existing.sessionId);

    const pending = this.pendingRequests.get(peerDeviceId);
    if (pending && this.now() - pending.createdAt < SPICE_CONNECT_LAN_NEGOTIATION_TIMEOUT_MS) return;

    const sessionId = this.createSessionId();
    if (isSpiceConnectLanOfferer(this.localDeviceId, peerDeviceId)) {
      await this.createOffer(peerDeviceId, sessionId);
      return;
    }

    this.pendingRequests.set(peerDeviceId, { sessionId, createdAt: this.now() });
    const sent = await this.sendSignalCallback(peerDeviceId, {
      version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
      kind: 'request',
      sessionId,
    });
    if (!sent) this.pendingRequests.delete(peerDeviceId);
  }

  async handleSignal(sourceDeviceIdValue: string, rawSignal: unknown) {
    const sourceDeviceId = normalizedDeviceId(sourceDeviceIdValue);
    const signal = normalizeSpiceConnectLanSignal(rawSignal);
    if (
      this.disposed
      || !sourceDeviceId
      || sourceDeviceId === this.localDeviceId
      || !signal
    ) return false;

    if (signal.kind === 'request') {
      if (!isSpiceConnectLanOfferer(this.localDeviceId, sourceDeviceId)) return false;
      const existing = this.peers.get(sourceDeviceId);
      if (existing && this.isPeerReady(existing)) return true;
      await this.createOffer(sourceDeviceId, signal.sessionId);
      return true;
    }

    if (signal.kind === 'offer') {
      if (isSpiceConnectLanOfferer(this.localDeviceId, sourceDeviceId) || !signal.description) return false;
      this.pendingRequests.delete(sourceDeviceId);
      this.closePeer(sourceDeviceId);
      const peer = this.createPeer(sourceDeviceId, signal.sessionId, false);
      try {
        await peer.connection.setRemoteDescription(signal.description);
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        await waitForIceGathering(peer.connection);
        if (this.peers.get(sourceDeviceId) !== peer || !peer.connection.localDescription) return false;
        const sent = await this.sendSignalCallback(sourceDeviceId, {
          version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
          kind: 'answer',
          sessionId: signal.sessionId,
          description: {
            type: 'answer',
            sdp: peer.connection.localDescription.sdp,
          },
        });
        if (!sent) this.closePeer(sourceDeviceId, signal.sessionId);
        return sent;
      } catch (error) {
        this.diagnostic(`LAN answer failed for ${sourceDeviceId}: ${error instanceof Error ? error.message : 'unknown error'}`);
        this.closePeer(sourceDeviceId, signal.sessionId);
        return false;
      }
    }

    const peer = this.peers.get(sourceDeviceId);
    if (
      !peer
      || peer.sessionId !== signal.sessionId
      || !signal.description
      || peer.connection.remoteDescription
    ) return false;
    try {
      await peer.connection.setRemoteDescription(signal.description);
      return true;
    } catch (error) {
      this.diagnostic(`LAN offer completion failed for ${sourceDeviceId}: ${error instanceof Error ? error.message : 'unknown error'}`);
      this.closePeer(sourceDeviceId, signal.sessionId);
      return false;
    }
  }

  sendCommand(
    targetDeviceIdValue: string,
    command: Exclude<SpiceConnectCommandType, typeof SPICE_CONNECT_LAN_SIGNAL_COMMAND>,
    payload: Record<string, unknown> = {},
  ) {
    const targetDeviceId = normalizedDeviceId(targetDeviceIdValue);
    const peer = this.peers.get(targetDeviceId);
    if (!peer || !this.isPeerReady(peer)) {
      void this.ensureConnection(targetDeviceId);
      return false;
    }
    const createdAt = new Date(this.now()).toISOString();
    return this.sendEnvelope(peer, {
      version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
      type: 'command',
      sessionId: peer.sessionId,
      command: {
        id: `lan:${peer.sessionId}:${this.createSessionId()}`,
        sourceDeviceId: this.localDeviceId,
        targetDeviceId,
        command,
        payload,
        createdAt,
      },
    });
  }

  broadcastState(rawState: SpiceConnectLanDeviceState) {
    const state = normalizeSpiceConnectLanDeviceState(rawState);
    if (!state || state.deviceId !== this.localDeviceId) return 0;
    this.latestLocalState = state;
    let delivered = 0;
    for (const peer of this.peers.values()) {
      if (this.sendState(peer)) delivered += 1;
    }
    return delivered;
  }

  disconnect(peerDeviceIdValue: string) {
    const peerDeviceId = normalizedDeviceId(peerDeviceIdValue);
    if (!peerDeviceId) return;
    this.pendingRequests.delete(peerDeviceId);
    this.closePeer(peerDeviceId);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.heartbeatTimer);
    for (const peer of [...this.peers.values()]) {
      this.closePeer(peer.peerDeviceId, peer.sessionId);
    }
    this.pendingRequests.clear();
  }

  private async createOffer(peerDeviceId: string, sessionId: string) {
    this.pendingRequests.delete(peerDeviceId);
    this.closePeer(peerDeviceId);
    const peer = this.createPeer(peerDeviceId, sessionId, true);
    try {
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
      await waitForIceGathering(peer.connection);
      if (this.peers.get(peerDeviceId) !== peer || !peer.connection.localDescription) return;
      const sent = await this.sendSignalCallback(peerDeviceId, {
        version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
        kind: 'offer',
        sessionId,
        description: {
          type: 'offer',
          sdp: peer.connection.localDescription.sdp,
        },
      });
      if (!sent) this.closePeer(peerDeviceId, sessionId);
    } catch (error) {
      this.diagnostic(`LAN offer failed for ${peerDeviceId}: ${error instanceof Error ? error.message : 'unknown error'}`);
      this.closePeer(peerDeviceId, sessionId);
    }
  }

  private createPeer(peerDeviceId: string, sessionId: string, initiator: boolean) {
    if (!this.peers.has(peerDeviceId) && this.peers.size >= SPICE_CONNECT_LAN_MAX_PEERS) {
      const oldestPeer = [...this.peers.values()]
        .sort((left, right) => left.createdAt - right.createdAt)[0];
      if (oldestPeer) this.closePeer(oldestPeer.peerDeviceId, oldestPeer.sessionId);
    }
    const connection = this.createPeerConnection();
    const peer: SpiceConnectLanPeer = {
      peerDeviceId,
      sessionId,
      connection,
      channel: null,
      verified: false,
      createdAt: this.now(),
      lastSeenAt: this.now(),
      pendingPingSentAt: null,
    };
    this.peers.set(peerDeviceId, peer);

    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'failed' || connection.connectionState === 'closed') {
        this.closePeer(peerDeviceId, sessionId);
      }
    };
    connection.ondatachannel = (event) => this.attachChannel(peer, event.channel);
    if (initiator) {
      this.attachChannel(peer, connection.createDataChannel(SPICE_CONNECT_LAN_CHANNEL_LABEL, {
        ordered: true,
        protocol: SPICE_CONNECT_LAN_CHANNEL_PROTOCOL,
      }));
    }
    return peer;
  }

  private attachChannel(peer: SpiceConnectLanPeer, channel: RTCDataChannel) {
    if (
      channel.label !== SPICE_CONNECT_LAN_CHANNEL_LABEL
      || channel.protocol !== SPICE_CONNECT_LAN_CHANNEL_PROTOCOL
    ) {
      channel.close();
      return;
    }
    peer.channel?.close();
    peer.channel = channel;
    channel.onopen = () => {
      this.sendEnvelope(peer, {
        version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
        type: 'hello',
        sessionId: peer.sessionId,
        deviceId: this.localDeviceId,
      }, false);
    };
    channel.onmessage = (event) => this.handleChannelMessage(peer, event.data);
    channel.onclose = () => this.closePeer(peer.peerDeviceId, peer.sessionId);
    channel.onerror = () => this.closePeer(peer.peerDeviceId, peer.sessionId);
  }

  private handleChannelMessage(peer: SpiceConnectLanPeer, data: unknown) {
    if (typeof data !== 'string' || data.length > SPICE_CONNECT_LAN_MAX_MESSAGE_BYTES) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    const envelope = normalizeSpiceConnectLanEnvelope(
      parsed,
      peer.peerDeviceId,
      this.localDeviceId,
      peer.sessionId,
    );
    if (!envelope) return;
    peer.lastSeenAt = this.now();

    if (envelope.type === 'hello') {
      const changed = !peer.verified;
      peer.verified = true;
      if (changed) {
        this.onPeersChangedCallback?.(this.connectedPeerDeviceIds());
        this.sendState(peer);
        this.sendPing(peer);
      }
      return;
    }
    if (!peer.verified) return;

    if (envelope.type === 'command') {
      try {
        this.onCommandCallback(envelope.command);
      } catch (error) {
        this.diagnostic(`LAN command handling failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
      return;
    }
    if (envelope.type === 'state') {
      this.onStateCallback(peer.peerDeviceId, envelope.state);
      return;
    }
    if (envelope.type === 'ping') {
      this.sendEnvelope(peer, {
        version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
        type: 'pong',
        sessionId: peer.sessionId,
        sentAt: envelope.sentAt,
      });
      return;
    }
    if (envelope.type === 'pong') {
      if (peer.pendingPingSentAt === envelope.sentAt) {
        const roundTripMs = Math.max(0, Math.round(this.now() - envelope.sentAt));
        peer.pendingPingSentAt = null;
        this.onPeerLatencyCallback?.(peer.peerDeviceId, roundTripMs);
      }
    }
  }

  private sendState(peer: SpiceConnectLanPeer) {
    if (!this.latestLocalState || !this.isPeerReady(peer)) return false;
    return this.sendEnvelope(peer, {
      version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
      type: 'state',
      sessionId: peer.sessionId,
      state: projectSpiceConnectLanDeviceState(this.latestLocalState, this.now()),
    });
  }

  private sendPing(peer: SpiceConnectLanPeer) {
    const sentAt = this.now();
    const sent = this.sendEnvelope(peer, {
      version: SPICE_CONNECT_LAN_PROTOCOL_VERSION,
      type: 'ping',
      sessionId: peer.sessionId,
      sentAt,
    });
    if (sent) peer.pendingPingSentAt = sentAt;
    return sent;
  }

  private sendEnvelope(peer: SpiceConnectLanPeer, envelope: SpiceConnectLanEnvelope, requireVerified = true) {
    if (
      !peer.channel
      || peer.channel.readyState !== 'open'
      || (requireVerified && !peer.verified)
    ) return false;
    try {
      const serialized = JSON.stringify(envelope);
      if (serialized.length > SPICE_CONNECT_LAN_MAX_MESSAGE_BYTES) return false;
      peer.channel.send(serialized);
      return true;
    } catch {
      this.closePeer(peer.peerDeviceId, peer.sessionId);
      return false;
    }
  }

  private heartbeat() {
    const now = this.now();
    for (const peer of [...this.peers.values()]) {
      if (
        now - peer.createdAt >= SPICE_CONNECT_LAN_NEGOTIATION_TIMEOUT_MS
        && !this.isPeerReady(peer)
      ) {
        this.closePeer(peer.peerDeviceId, peer.sessionId);
        continue;
      }
      if (now - peer.lastSeenAt >= SPICE_CONNECT_LAN_PEER_TIMEOUT_MS) {
        this.closePeer(peer.peerDeviceId, peer.sessionId);
        continue;
      }
      if (this.isPeerReady(peer)) {
        this.sendPing(peer);
        this.sendState(peer);
      }
    }
    for (const [peerDeviceId, pending] of this.pendingRequests) {
      if (now - pending.createdAt >= SPICE_CONNECT_LAN_NEGOTIATION_TIMEOUT_MS) {
        this.pendingRequests.delete(peerDeviceId);
      }
    }
  }

  private isPeerReady(peer: SpiceConnectLanPeer) {
    return peer.verified && peer.channel?.readyState === 'open';
  }

  private closePeer(peerDeviceId: string, expectedSessionId?: string) {
    const peer = this.peers.get(peerDeviceId);
    if (!peer || (expectedSessionId && peer.sessionId !== expectedSessionId)) return;
    const wasReady = this.isPeerReady(peer);
    this.peers.delete(peerDeviceId);
    peer.channel?.close();
    peer.connection.close();
    if (wasReady) this.onPeersChangedCallback?.(this.connectedPeerDeviceIds());
  }

  private diagnostic(message: string) {
    this.onDiagnosticCallback?.(message);
  }
}
