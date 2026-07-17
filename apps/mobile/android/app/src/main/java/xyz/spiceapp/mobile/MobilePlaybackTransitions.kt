package xyz.spiceapp.mobile

import androidx.media3.common.Player
import kotlin.math.min

internal const val MAX_MOBILE_CROSSFADE_DURATION_MS = 12_000L

internal fun normalizeMobileCrossfadeDurationMs(value: Long): Long =
    value.coerceIn(0L, MAX_MOBILE_CROSSFADE_DURATION_MS)

internal fun shouldPrepareMobileTransition(
    positionMs: Long,
    durationMs: Long,
    crossfadeDurationMs: Long,
    hasNextTrack: Boolean,
): Boolean {
    val safeCrossfade = normalizeMobileCrossfadeDurationMs(crossfadeDurationMs)
    if (!hasNextTrack || safeCrossfade <= 0L || durationMs <= 0L) return false
    val remainingMs = (durationMs - positionMs).coerceAtLeast(0L)
    return remainingMs in 1..(safeCrossfade + 15_000L)
}

internal fun shouldStartMobileTransition(
    positionMs: Long,
    durationMs: Long,
    crossfadeDurationMs: Long,
    prepared: Boolean,
): Boolean {
    val safeCrossfade = normalizeMobileCrossfadeDurationMs(crossfadeDurationMs)
    if (!prepared || safeCrossfade <= 0L || durationMs <= 0L) return false
    val remainingMs = (durationMs - positionMs).coerceAtLeast(0L)
    return remainingMs in 1..safeCrossfade
}

internal fun shouldCancelMobileCrossfadeForPlaybackInterruption(
    crossfadeRunning: Boolean,
    playWhenReady: Boolean,
    outgoingEndedNaturally: Boolean,
    playbackSuppressed: Boolean = false,
): Boolean = crossfadeRunning &&
    !outgoingEndedNaturally &&
    (!playWhenReady || playbackSuppressed)

internal fun isAutomaticMobileRepeatTransition(reason: Int): Boolean =
    reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT

internal fun effectiveMobileCrossfadeDurationMs(
    configuredDurationMs: Long,
    outgoingRemainingMs: Long,
): Long? {
    val duration = min(
        normalizeMobileCrossfadeDurationMs(configuredDurationMs),
        outgoingRemainingMs.coerceAtLeast(0L),
    )
    return duration.takeIf { it >= 250L }
}

internal fun shouldDispatchMobilePlaybackEnded(
    callbackReportsEnded: Boolean,
    controllerStillReportsEnded: Boolean,
    alreadyHandledForCurrentItem: Boolean,
): Boolean = callbackReportsEnded && controllerStillReportsEnded && !alreadyHandledForCurrentItem

internal fun shouldRetryMobilePlaybackSource(
    capturedGeneration: Long,
    currentGeneration: Long,
    capturedMediaId: String,
    currentMediaId: String,
): Boolean = capturedGeneration == currentGeneration &&
    capturedMediaId.isNotBlank() &&
    capturedMediaId == currentMediaId

internal fun shouldRestartMobileTrackForPrevious(positionMs: Long): Boolean = positionMs > 3_000L

internal fun shouldTreatMobileSeekAsSkip(
    currentPositionMs: Long,
    targetPositionMs: Long,
    durationMs: Long,
): Boolean = durationMs > 0L &&
    targetPositionMs - currentPositionMs >= 1_000L &&
    targetPositionMs >= durationMs - 3_000L

internal data class MobilePromotedPlayerModes(
    val shuffleEnabled: Boolean,
    val repeatMode: Int,
)

internal fun mobilePromotedPlayerModes(
    outgoingShuffleEnabled: Boolean,
    outgoingRepeatMode: Int,
): MobilePromotedPlayerModes = MobilePromotedPlayerModes(
    shuffleEnabled = outgoingShuffleEnabled,
    repeatMode = outgoingRepeatMode,
)

internal fun shouldUseExactMobileCutForIncoming(
    incomingDurationMs: Long,
    requestedCrossfadeDurationMs: Long,
): Boolean = incomingDurationMs > 0L &&
    incomingDurationMs <= requestedCrossfadeDurationMs + 250L

internal fun mobileQueueNavigationStepForPlayerCommand(playerCommand: Int): Int? = when (playerCommand) {
    Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
    Player.COMMAND_SEEK_TO_NEXT,
    -> 1
    Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
    Player.COMMAND_SEEK_TO_PREVIOUS,
    -> -1
    else -> null
}

internal fun shouldCommitMobileServiceNavigation(
    capturedGeneration: Long,
    currentGeneration: Long,
    capturedMediaId: String,
    currentMediaId: String,
    navigationStillPending: Boolean,
): Boolean = navigationStillPending &&
    capturedGeneration == currentGeneration &&
    capturedMediaId.isNotBlank() &&
    capturedMediaId == currentMediaId

internal fun shouldRunMobileBackgroundContinuation(
    playWhenReady: Boolean,
    playbackEnded: Boolean,
    playbackSuppressed: Boolean,
): Boolean = playbackEnded || (playWhenReady && !playbackSuppressed)

internal fun shouldStartMobileCrossfadeForPlaybackState(
    isPlaying: Boolean,
    playbackSuppressed: Boolean,
): Boolean = isPlaying && !playbackSuppressed
