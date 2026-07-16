package xyz.spiceapp.mobile

import kotlin.math.roundToLong

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

internal fun mobileTransitionGain(elapsedMs: Long, durationMs: Long): Float {
    if (durationMs <= 0L) return 1f
    val progress = (elapsedMs.toDouble() / durationMs.toDouble()).coerceIn(0.0, 1.0)
    return if (progress < 0.5) {
        (1.0 - progress * 2.0).toFloat()
    } else {
        ((progress - 0.5) * 2.0).toFloat()
    }
}

internal fun mobileTransitionStepCount(durationMs: Long): Int =
    (normalizeMobileCrossfadeDurationMs(durationMs) / 50.0).roundToLong().toInt().coerceAtLeast(2)
