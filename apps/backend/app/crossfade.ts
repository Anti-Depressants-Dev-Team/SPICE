export type CrossfadeCurve = 'linear' | 'equal-power';
export type CrossfadePhase = 'idle' | 'preload' | 'fading' | 'complete';

export const MAX_CROSSFADE_DURATION_MS = 12_000;
export const DEFAULT_CROSSFADE_PRELOAD_LEAD_MS = 5_000;

export interface CrossfadePlanInput {
  trackDurationMs: number;
  crossfadeDurationMs: number;
  preloadLeadMs?: number;
}

export interface CrossfadePlan {
  enabled: boolean;
  trackDurationMs: number;
  requestedDurationMs: number;
  durationMs: number;
  preloadAtMs: number;
  fadeStartMs: number;
  endAtMs: number;
}

export interface CrossfadeState {
  phase: CrossfadePhase;
  progress: number;
  positionMs: number;
  timeUntilFadeMs: number;
  shouldPreload: boolean;
}

export interface CrossfadeGains {
  outgoing: number;
  incoming: number;
}

const finiteNonNegative = (value: number, fallback = 0) =>
  Number.isFinite(value) ? Math.max(0, value) : fallback;

const clampUnit = (value: number) =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/**
 * Builds a schedule for one outgoing track. The fade is capped at half of the
 * track so short tracks always retain a non-fading section.
 */
export function createCrossfadePlan({
  trackDurationMs,
  crossfadeDurationMs,
  preloadLeadMs = DEFAULT_CROSSFADE_PRELOAD_LEAD_MS,
}: CrossfadePlanInput): CrossfadePlan {
  const duration = finiteNonNegative(trackDurationMs);
  const requestedDuration = Math.min(
    MAX_CROSSFADE_DURATION_MS,
    finiteNonNegative(crossfadeDurationMs),
  );
  const effectiveDuration = duration > 0
    ? Math.min(requestedDuration, duration / 2)
    : 0;
  const fadeStartMs = Math.max(0, duration - effectiveDuration);
  const preloadAtMs = effectiveDuration > 0
    ? Math.max(0, fadeStartMs - finiteNonNegative(preloadLeadMs))
    : duration;

  return {
    enabled: effectiveDuration > 0,
    trackDurationMs: duration,
    requestedDurationMs: requestedDuration,
    durationMs: effectiveDuration,
    preloadAtMs,
    fadeStartMs,
    endAtMs: duration,
  };
}

/** Returns the deterministic scheduler state for a playback position. */
export function crossfadeStateAt(plan: CrossfadePlan, positionMs: number): CrossfadeState {
  const position = Math.min(
    plan.endAtMs,
    finiteNonNegative(positionMs),
  );
  const complete = plan.endAtMs > 0 && position >= plan.endAtMs;
  const fading = plan.enabled && position >= plan.fadeStartMs;
  const preloading = plan.enabled && position >= plan.preloadAtMs;
  const progress = complete
    ? 1
    : fading
      ? clampUnit((position - plan.fadeStartMs) / plan.durationMs)
      : 0;

  const phase: CrossfadePhase = complete
    ? 'complete'
    : fading
      ? 'fading'
      : preloading
        ? 'preload'
        : 'idle';

  return {
    phase,
    progress,
    positionMs: position,
    timeUntilFadeMs: Math.max(0, plan.fadeStartMs - position),
    shouldPreload: plan.enabled && (preloading || fading || complete),
  };
}

/** Calculates independent incoming/outgoing Web Audio gain values. */
export function crossfadeGains(
  progress: number,
  curve: CrossfadeCurve = 'equal-power',
): CrossfadeGains {
  const normalized = clampUnit(progress);
  if (curve === 'linear') {
    return {
      outgoing: 1 - normalized,
      incoming: normalized,
    };
  }

  return {
    outgoing: Math.cos(normalized * Math.PI / 2),
    incoming: Math.sin(normalized * Math.PI / 2),
  };
}
