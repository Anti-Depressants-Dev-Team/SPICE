export const SPICE_CONNECT_HANDOFF_ACCEPT_TIMEOUT_MS = 8_000;
export const SPICE_CONNECT_HANDOFF_COMPLETE_TIMEOUT_MS = 12_000;

export type SpiceConnectHandoffSourcePhase =
  | 'waiting_for_ready'
  | 'waiting_for_complete'
  | 'completed'
  | 'failed'
  | 'uncertain';

export interface SpiceConnectHandoffSourceState {
  transferId: string;
  targetDeviceId: string;
  sourceWasPlaying: boolean;
  phase: SpiceConnectHandoffSourcePhase;
}

export type SpiceConnectHandoffSourceEvent =
  | { type: 'ready'; transferId: string; sourceDeviceId: string }
  | { type: 'complete'; transferId: string; sourceDeviceId: string }
  | {
      type:
        | 'prepare_failed'
        | 'ready_timeout'
        | 'commit_failed'
        | 'destination_failed'
        | 'complete_timeout';
    };

export interface SpiceConnectHandoffSourceTransition {
  state: SpiceConnectHandoffSourceState;
  sourcePlayback: 'continue' | 'pause' | 'resume' | 'unchanged';
  outbound: 'commit' | 'cancel' | null;
}

export function normalizeSpiceConnectTransferId(value: unknown) {
  return typeof value === 'string'
    ? value.trim().replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 160)
    : '';
}

export function createSpiceConnectTransferId(
  sourceDeviceId: string,
  targetDeviceId: string,
  now = Date.now(),
  entropy = Math.random().toString(36).slice(2),
) {
  const source = sourceDeviceId.replace(/[^a-zA-Z0-9_-]/g, '').slice(-24) || 'source';
  const target = targetDeviceId.replace(/[^a-zA-Z0-9_-]/g, '').slice(-24) || 'target';
  const randomPart = entropy.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36) || 'transfer';
  return `${source}:${target}:${Math.max(0, Math.round(now)).toString(36)}:${randomPart}`;
}

export function startSpiceConnectHandoffSource(
  transferId: string,
  targetDeviceId: string,
  sourceWasPlaying: boolean,
): SpiceConnectHandoffSourceTransition {
  return {
    state: {
      transferId: normalizeSpiceConnectTransferId(transferId),
      targetDeviceId,
      sourceWasPlaying,
      phase: 'waiting_for_ready',
    },
    sourcePlayback: 'continue',
    outbound: null,
  };
}

export function transitionSpiceConnectHandoffSource(
  state: SpiceConnectHandoffSourceState,
  event: SpiceConnectHandoffSourceEvent,
): SpiceConnectHandoffSourceTransition {
  if (event.type === 'ready') {
    if (
      state.phase !== 'waiting_for_ready'
      || normalizeSpiceConnectTransferId(event.transferId) !== state.transferId
      || event.sourceDeviceId !== state.targetDeviceId
    ) {
      return { state, sourcePlayback: 'unchanged', outbound: null };
    }
    return {
      state: { ...state, phase: 'waiting_for_complete' },
      sourcePlayback: 'pause',
      outbound: 'commit',
    };
  }

  if (event.type === 'complete') {
    if (
      state.phase !== 'waiting_for_complete'
      || normalizeSpiceConnectTransferId(event.transferId) !== state.transferId
      || event.sourceDeviceId !== state.targetDeviceId
    ) {
      return { state, sourcePlayback: 'unchanged', outbound: null };
    }
    return {
      state: { ...state, phase: 'completed' },
      sourcePlayback: 'unchanged',
      outbound: null,
    };
  }

  if (event.type === 'complete_timeout') {
    return state.phase === 'waiting_for_complete'
      ? {
          state: { ...state, phase: 'uncertain' },
          // Once the destination accepted a transfer, silence is safer than
          // resuming the source and risking two devices playing at once.
          sourcePlayback: 'pause',
          outbound: null,
        }
      : { state, sourcePlayback: 'unchanged', outbound: null };
  }

  if (event.type === 'commit_failed') {
    return state.phase === 'waiting_for_complete'
      ? {
          state: { ...state, phase: 'uncertain' },
          // The server may have accepted the commit even when the client did
          // not receive its HTTP response. Staying paused is the only state
          // that cannot create overlapping playback.
          sourcePlayback: 'pause',
          outbound: 'cancel',
        }
      : { state, sourcePlayback: 'unchanged', outbound: null };
  }

  if (event.type === 'destination_failed') {
    return state.phase === 'waiting_for_complete'
      ? {
          state: { ...state, phase: 'failed' },
          // The destination explicitly confirmed that playback did not start.
          sourcePlayback: state.sourceWasPlaying ? 'resume' : 'unchanged',
          outbound: null,
        }
      : { state, sourcePlayback: 'unchanged', outbound: null };
  }

  if (
    state.phase !== 'waiting_for_ready'
    || (event.type !== 'prepare_failed' && event.type !== 'ready_timeout')
  ) {
    return { state, sourcePlayback: 'unchanged', outbound: null };
  }

  return {
    state: { ...state, phase: 'failed' },
    sourcePlayback: state.sourceWasPlaying ? 'resume' : 'unchanged',
    outbound: 'cancel',
  };
}

export type SpiceConnectHandoffDestinationPhase = 'waiting_for_commit' | 'committed' | 'cancelled';

export interface SpiceConnectHandoffDestinationState {
  transferId: string;
  sourceDeviceId: string;
  phase: SpiceConnectHandoffDestinationPhase;
  expiresAt: number;
}

export function prepareSpiceConnectHandoffDestination(
  transferId: string,
  sourceDeviceId: string,
  now = Date.now(),
) {
  return {
    state: {
      transferId: normalizeSpiceConnectTransferId(transferId),
      sourceDeviceId,
      phase: 'waiting_for_commit' as const,
      expiresAt: now + SPICE_CONNECT_HANDOFF_ACCEPT_TIMEOUT_MS,
    },
    startPlayback: false,
    outbound: 'ready' as const,
  };
}

export function commitSpiceConnectHandoffDestination(
  state: SpiceConnectHandoffDestinationState | null,
  transferId: string,
  sourceDeviceId: string,
  now = Date.now(),
) {
  const normalizedTransferId = normalizeSpiceConnectTransferId(transferId);
  const matchesPrepared = Boolean(
    state
    && state.phase === 'waiting_for_commit'
    && state.transferId === normalizedTransferId
    && state.sourceDeviceId === sourceDeviceId
    && state.expiresAt > now,
  );

  return {
    state: matchesPrepared && state
      ? { ...state, phase: 'committed' as const }
      : state,
    // Require the acknowledged prepare phase. After a reload it is safer to
    // reject and let the source recover than to accept a late or cancelled
    // commit and risk overlapping playback.
    startPlayback: matchesPrepared,
    outbound: matchesPrepared ? 'complete' as const : null,
    matchesPrepared,
  };
}
