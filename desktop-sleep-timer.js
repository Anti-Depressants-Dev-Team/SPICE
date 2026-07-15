"use strict";

const OFF_DESKTOP_SLEEP_TIMER = Object.freeze({ mode: "off" });

function normalizeDesktopSleepTimer(value, now = Date.now()) {
  if (!value || typeof value !== "object") return OFF_DESKTOP_SLEEP_TIMER;
  if (value.mode === "duration") {
    const expiresAt = Number(value.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > now
      ? { mode: "duration", expiresAt }
      : OFF_DESKTOP_SLEEP_TIMER;
  }
  if (value.mode === "end-track") return { mode: "end-track" };
  if (value.mode === "end-queue") return { mode: "end-queue" };
  return OFF_DESKTOP_SLEEP_TIMER;
}

function formatDesktopSleepTimer(value, now = Date.now()) {
  const timer = normalizeDesktopSleepTimer(value, now);
  if (timer.mode === "off") return "Off";
  if (timer.mode === "end-track") return "End of track";
  if (timer.mode === "end-queue") return "End of queue";
  const remainingSeconds = Math.max(0, Math.ceil((timer.expiresAt - now) / 1000));
  return `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;
}

function detectDesktopPlaybackBoundary(previous, current) {
  if (!previous || !current || !previous.trackKey || !current.trackKey) {
    return { trackEnded: false, queueEnded: false };
  }

  const previousTime = Number(previous.currentTime) || 0;
  const currentTime = Number(current.currentTime) || 0;
  const duration = Math.max(Number(previous.duration) || 0, Number(current.duration) || 0);
  const changedTrack = previous.trackKey !== current.trackKey;
  const restartedTrack = !changedTrack && previousTime > 10 && currentTime < 5;
  const naturallyEnded = !changedTrack
    && previous.paused === false
    && current.paused === true
    && duration > 0
    && currentTime >= Math.max(0, duration - 1.5);
  const trackEnded = changedTrack || restartedTrack || naturallyEnded;

  return {
    trackEnded,
    queueEnded: trackEnded && previous.queueAtTail === true,
  };
}

class DesktopSleepTimer {
  constructor({
    initialState,
    onExpire,
    onChange,
    now = Date.now,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = {}) {
    this.onExpire = typeof onExpire === "function" ? onExpire : () => {};
    this.onChange = typeof onChange === "function" ? onChange : () => {};
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.timeout = null;
    this.state = normalizeDesktopSleepTimer(initialState, this.now());
    this.schedule();
  }

  snapshot() {
    return { ...this.state };
  }

  set(value) {
    this.state = normalizeDesktopSleepTimer(value, this.now());
    this.schedule();
    this.onChange(this.snapshot());
    return this.snapshot();
  }

  setDuration(minutes) {
    const safeMinutes = Number.isFinite(Number(minutes))
      ? Math.max(1, Math.min(24 * 60, Number(minutes)))
      : 30;
    return this.set({
      mode: "duration",
      expiresAt: this.now() + Math.round(safeMinutes * 60_000),
    });
  }

  setEndOfTrack() {
    return this.set({ mode: "end-track" });
  }

  setEndOfQueue() {
    return this.set({ mode: "end-queue" });
  }

  cancel() {
    return this.set(OFF_DESKTOP_SLEEP_TIMER);
  }

  handleTrackEnd({ queueEnded = false } = {}) {
    if (this.state.mode === "end-track" || (this.state.mode === "end-queue" && queueEnded)) {
      this.expire();
      return true;
    }
    return false;
  }

  dispose() {
    if (this.timeout !== null) this.clearTimer(this.timeout);
    this.timeout = null;
  }

  schedule() {
    if (this.timeout !== null) this.clearTimer(this.timeout);
    this.timeout = null;
    if (this.state.mode !== "duration") return;
    const delay = Math.max(0, this.state.expiresAt - this.now());
    this.timeout = this.setTimer(() => this.expire(), delay);
  }

  expire() {
    if (this.state.mode === "off") return;
    this.state = OFF_DESKTOP_SLEEP_TIMER;
    this.timeout = null;
    this.onChange(this.snapshot());
    this.onExpire();
  }
}

module.exports = {
  DesktopSleepTimer,
  OFF_DESKTOP_SLEEP_TIMER,
  detectDesktopPlaybackBoundary,
  formatDesktopSleepTimer,
  normalizeDesktopSleepTimer,
};
