export type SleepTimerMode = 'off' | 'duration' | 'end-track' | 'end-queue';

export interface SleepTimerState {
  mode: SleepTimerMode;
  expiresAt?: number;
  armedTrackKey?: string;
}

export const OFF_SLEEP_TIMER: SleepTimerState = { mode: 'off' };

export function normalizeSleepTimer(value: unknown, now = Date.now()): SleepTimerState {
  if (!value || typeof value !== 'object') return OFF_SLEEP_TIMER;
  const timer = value as Partial<SleepTimerState>;
  if (timer.mode === 'duration') {
    const expiresAt = Number(timer.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > now
      ? { mode: 'duration', expiresAt }
      : OFF_SLEEP_TIMER;
  }
  if (timer.mode === 'end-track') {
    return typeof timer.armedTrackKey === 'string' && timer.armedTrackKey
      ? { mode: 'end-track', armedTrackKey: timer.armedTrackKey }
      : OFF_SLEEP_TIMER;
  }
  if (timer.mode === 'end-queue') return { mode: 'end-queue' };
  return OFF_SLEEP_TIMER;
}

export function createDurationSleepTimer(minutes: number, now = Date.now()): SleepTimerState {
  const boundedMinutes = Number.isFinite(minutes) ? Math.max(1, Math.min(24 * 60, minutes)) : 30;
  return { mode: 'duration', expiresAt: now + Math.round(boundedMinutes * 60_000) };
}

export function sleepTimerRemainingMs(timer: SleepTimerState, now = Date.now()) {
  return timer.mode === 'duration' && timer.expiresAt
    ? Math.max(0, timer.expiresAt - now)
    : null;
}

export function shouldStopForSleepTimer({
  timer,
  now = Date.now(),
  event = 'tick',
  trackKey = '',
  isQueueTail = false,
}: {
  timer: SleepTimerState;
  now?: number;
  event?: 'tick' | 'track-ended';
  trackKey?: string;
  isQueueTail?: boolean;
}) {
  if (timer.mode === 'duration') return Boolean(timer.expiresAt && now >= timer.expiresAt);
  if (event !== 'track-ended') return false;
  if (timer.mode === 'end-track') return Boolean(trackKey && trackKey === timer.armedTrackKey);
  return timer.mode === 'end-queue' && isQueueTail;
}

export function formatSleepTimer(timer: SleepTimerState, now = Date.now()) {
  if (timer.mode === 'off') return 'Off';
  if (timer.mode === 'end-track') return 'End of track';
  if (timer.mode === 'end-queue') return 'End of queue';
  const remaining = sleepTimerRemainingMs(timer, now) ?? 0;
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
