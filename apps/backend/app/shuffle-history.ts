export interface ShuffleHistoryState {
  queueKeys: string[];
  sequence: number[];
  cursor: number;
  cycleVisited: number[];
}

export interface ShuffleHistoryStep {
  state: ShuffleHistoryState;
  index: number | null;
  fromHistory: boolean;
}

interface ShuffleNextOptions {
  random?: () => number;
  wrap?: boolean;
  weights?: readonly number[];
}

const MAX_SHUFFLE_WEIGHT = 1_000_000;
export const MAX_SHUFFLE_HISTORY_ENTRIES = 2_000;

const validIndex = (index: number, queueLength: number) => (
  Number.isInteger(index) && index >= 0 && index < queueLength
);

const sameQueueOrPrefixExtension = (previous: string[], next: string[]) => (
  previous.length <= next.length
  && previous.every((key, index) => key === next[index])
);

const normalizedShuffleWeight = (value: unknown) => {
  const weight = Number(value);
  return Number.isFinite(weight) && weight > 0
    ? Math.min(MAX_SHUFFLE_WEIGHT, weight)
    : 1;
};

const trimShuffleSequence = (sequence: number[], cursor: number) => {
  if (sequence.length <= MAX_SHUFFLE_HISTORY_ENTRIES) return { sequence, cursor };
  const latestStart = sequence.length - MAX_SHUFFLE_HISTORY_ENTRIES;
  const centeredStart = Math.max(0, cursor - Math.floor(MAX_SHUFFLE_HISTORY_ENTRIES / 2));
  const start = Math.min(latestStart, centeredStart);
  return {
    sequence: sequence.slice(start, start + MAX_SHUFFLE_HISTORY_ENTRIES),
    cursor: cursor - start,
  };
};

export function resetShuffleHistory(
  queueKeys: string[],
  currentIndex: number,
): ShuffleHistoryState {
  const safeIndex = validIndex(currentIndex, queueKeys.length) ? currentIndex : 0;
  const hasTrack = queueKeys.length > 0;
  return {
    queueKeys: [...queueKeys],
    sequence: hasTrack ? [safeIndex] : [],
    cursor: hasTrack ? 0 : -1,
    cycleVisited: hasTrack ? [safeIndex] : [],
  };
}

export function alignShuffleHistory(
  state: ShuffleHistoryState | null,
  queueKeys: string[],
  currentIndex: number,
): ShuffleHistoryState {
  if (
    !state
    || !sameQueueOrPrefixExtension(state.queueKeys, queueKeys)
    || !validIndex(currentIndex, queueKeys.length)
    || state.sequence[state.cursor] !== currentIndex
  ) {
    return resetShuffleHistory(queueKeys, currentIndex);
  }

  const validSequence = state.sequence
    .map((index, position) => ({ index, position }))
    .filter(({ index }) => validIndex(index, queueKeys.length));
  const validCursor = validSequence.findIndex(({ position }) => position === state.cursor);
  if (validCursor < 0) return resetShuffleHistory(queueKeys, currentIndex);
  const trimmed = trimShuffleSequence(
    validSequence.map(({ index }) => index),
    validCursor,
  );

  return {
    ...state,
    queueKeys: [...queueKeys],
    sequence: trimmed.sequence,
    cursor: trimmed.cursor,
    cycleVisited: state.cycleVisited
      .filter((index) => validIndex(index, queueKeys.length))
      .slice(-queueKeys.length),
  };
}

export function previousShuffleTrack(
  state: ShuffleHistoryState | null,
  queueKeys: string[],
  currentIndex: number,
): ShuffleHistoryStep {
  const aligned = alignShuffleHistory(state, queueKeys, currentIndex);
  if (aligned.cursor <= 0) {
    return { state: aligned, index: null, fromHistory: false };
  }

  const cursor = aligned.cursor - 1;
  return {
    state: { ...aligned, cursor },
    index: aligned.sequence[cursor] ?? null,
    fromHistory: true,
  };
}

export function nextShuffleTrack(
  state: ShuffleHistoryState | null,
  queueKeys: string[],
  currentIndex: number,
  options: ShuffleNextOptions = {},
): ShuffleHistoryStep {
  const aligned = alignShuffleHistory(state, queueKeys, currentIndex);
  if (aligned.cursor >= 0 && aligned.cursor < aligned.sequence.length - 1) {
    const cursor = aligned.cursor + 1;
    return {
      state: { ...aligned, cursor },
      index: aligned.sequence[cursor] ?? null,
      fromHistory: true,
    };
  }

  if (queueKeys.length === 0) {
    return { state: aligned, index: null, fromHistory: false };
  }

  const queueWeights = queueKeys.map((_, index) => normalizedShuffleWeight(options.weights?.[index]));
  const minimumWeight = Math.min(...queueWeights);
  const maximumWeight = Math.max(...queueWeights);
  const adaptiveRound = maximumWeight > minimumWeight * 1.000001;
  let cycleVisited = [...aligned.cycleVisited];
  let roundComplete = cycleVisited.length >= queueKeys.length;

  if (roundComplete) {
    if (!options.wrap) {
      return { state: aligned, index: null, fromHistory: false };
    }
    cycleVisited = validIndex(currentIndex, queueKeys.length) ? [currentIndex] : [];
    roundComplete = false;
  }

  const visited = new Set(cycleVisited);
  let candidates = queueKeys
    .map((_, index) => index)
    .filter((index) => (
      adaptiveRound ? index !== currentIndex : !visited.has(index)
    ));
  const distinctTrackCandidates = candidates.filter((index) => (
    queueKeys[index] !== queueKeys[currentIndex]
  ));
  if (distinctTrackCandidates.length > 0) candidates = distinctTrackCandidates;

  // A priority change can turn a weighted round with duplicate visits back
  // into a classic no-repeat round. If no unseen entry remains, finish that
  // mixed round early rather than manufacturing an immediate repeat.
  if (candidates.length === 0 && !roundComplete) {
    if (!options.wrap) return { state: aligned, index: null, fromHistory: false };
    cycleVisited = validIndex(currentIndex, queueKeys.length) ? [currentIndex] : [];
    candidates = queueKeys
      .map((_, index) => index)
      .filter((index) => index !== currentIndex);
    const distinctResetCandidates = candidates.filter((index) => (
      queueKeys[index] !== queueKeys[currentIndex]
    ));
    if (distinctResetCandidates.length > 0) candidates = distinctResetCandidates;
  }
  if (candidates.length === 0) {
    return {
      state: { ...aligned, cycleVisited },
      index: validIndex(currentIndex, queueKeys.length) ? currentIndex : null,
      fromHistory: false,
    };
  }

  const random = options.random ?? Math.random;
  const randomValue = Number(random());
  const sample = Number.isFinite(randomValue)
    ? Math.min(0.999999999, Math.max(0, randomValue))
    : 0;
  const candidateWeights = candidates.map((index) => queueWeights[index]);
  const totalWeight = candidateWeights.reduce((total, weight) => total + weight, 0);
  const weightedSample = sample * totalWeight;
  let cumulativeWeight = 0;
  let nextIndex = candidates[candidates.length - 1];
  for (let candidate = 0; candidate < candidates.length; candidate += 1) {
    cumulativeWeight += candidateWeights[candidate];
    if (weightedSample < cumulativeWeight) {
      nextIndex = candidates[candidate];
      break;
    }
  }
  const appendedSequence = [...aligned.sequence.slice(0, aligned.cursor + 1), nextIndex];
  const trimmed = trimShuffleSequence(appendedSequence, appendedSequence.length - 1);

  return {
    state: {
      queueKeys: [...queueKeys],
      sequence: trimmed.sequence,
      cursor: trimmed.cursor,
      cycleVisited: [...cycleVisited, nextIndex],
    },
    index: nextIndex,
    fromHistory: false,
  };
}
