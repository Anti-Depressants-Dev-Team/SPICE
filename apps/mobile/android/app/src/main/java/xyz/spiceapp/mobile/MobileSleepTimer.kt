package xyz.spiceapp.mobile

enum class MobileSleepTimerMode {
    Off,
    Duration,
    EndTrack,
    EndQueue,
}

data class MobileSleepTimerState(
    val mode: MobileSleepTimerMode = MobileSleepTimerMode.Off,
    val expiresAtEpochMs: Long = 0L,
    val armedTrackKey: String = "",
)

internal data class MobilePlaybackBoundary(
    val trackEnded: Boolean,
    val queueEnded: Boolean,
)

internal fun detectMobilePlaybackBoundary(
    previousTrackKey: String,
    currentTrackKey: String,
    previousProgressMs: Long,
    currentProgressMs: Long,
    previousPlaying: Boolean,
    currentPlaying: Boolean,
    durationMs: Long,
    queueAtTail: Boolean,
): MobilePlaybackBoundary {
    if (previousTrackKey.isBlank()) return MobilePlaybackBoundary(false, false)
    val changedTrack = currentTrackKey != previousTrackKey
    val restartedTrack = !changedTrack && previousProgressMs > 10_000L && currentProgressMs < 5_000L
    val naturallyEnded = !changedTrack && !restartedTrack &&
        previousPlaying && !currentPlaying && durationMs > 0L &&
        currentProgressMs >= (durationMs - 1_500L).coerceAtLeast(0L)
    val trackEnded = changedTrack || restartedTrack || naturallyEnded
    return MobilePlaybackBoundary(trackEnded, trackEnded && queueAtTail)
}

internal fun normalizeMobileSleepTimer(
    state: MobileSleepTimerState,
    nowEpochMs: Long = System.currentTimeMillis(),
): MobileSleepTimerState = when (state.mode) {
    MobileSleepTimerMode.Duration -> if (state.expiresAtEpochMs > nowEpochMs) state else MobileSleepTimerState()
    MobileSleepTimerMode.EndTrack -> if (state.armedTrackKey.isNotBlank()) state else MobileSleepTimerState()
    MobileSleepTimerMode.EndQueue -> state
    MobileSleepTimerMode.Off -> MobileSleepTimerState()
}

internal fun durationMobileSleepTimer(
    minutes: Int,
    nowEpochMs: Long = System.currentTimeMillis(),
): MobileSleepTimerState = MobileSleepTimerState(
    mode = MobileSleepTimerMode.Duration,
    expiresAtEpochMs = nowEpochMs + minutes.coerceIn(1, 24 * 60) * 60_000L,
)

internal fun shouldStopForMobileSleepTimer(
    timer: MobileSleepTimerState,
    nowEpochMs: Long = System.currentTimeMillis(),
    trackEnded: Boolean = false,
    trackKey: String = "",
    queueEnded: Boolean = false,
): Boolean = when (timer.mode) {
    MobileSleepTimerMode.Duration -> nowEpochMs >= timer.expiresAtEpochMs
    MobileSleepTimerMode.EndTrack -> trackEnded && trackKey == timer.armedTrackKey
    MobileSleepTimerMode.EndQueue -> trackEnded && queueEnded
    MobileSleepTimerMode.Off -> false
}

internal fun formatMobileSleepTimer(
    timer: MobileSleepTimerState,
    nowEpochMs: Long = System.currentTimeMillis(),
): String = when (timer.mode) {
    MobileSleepTimerMode.Off -> "Off"
    MobileSleepTimerMode.EndTrack -> "End of track"
    MobileSleepTimerMode.EndQueue -> "End of queue"
    MobileSleepTimerMode.Duration -> {
        val remainingSeconds = ((timer.expiresAtEpochMs - nowEpochMs).coerceAtLeast(0L) + 999L) / 1000L
        "${remainingSeconds / 60}:${(remainingSeconds % 60).toString().padStart(2, '0')}"
    }
}
