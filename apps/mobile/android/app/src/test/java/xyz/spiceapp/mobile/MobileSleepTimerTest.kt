package xyz.spiceapp.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileSleepTimerTest {
    @Test
    fun durationExpiresAndFormats() {
        val timer = durationMobileSleepTimer(minutes = 15, nowEpochMs = 1_000L)
        assertEquals("15:00", formatMobileSleepTimer(timer, 1_000L))
        assertFalse(shouldStopForMobileSleepTimer(timer, 900_999L))
        assertTrue(shouldStopForMobileSleepTimer(timer, 901_000L))
    }

    @Test
    fun trackAndQueueBoundariesAreDistinct() {
        val trackTimer = MobileSleepTimerState(MobileSleepTimerMode.EndTrack, armedTrackKey = "soundcloud:one")
        assertFalse(shouldStopForMobileSleepTimer(trackTimer, trackEnded = true, trackKey = "youtube_music:one"))
        assertTrue(shouldStopForMobileSleepTimer(trackTimer, trackEnded = true, trackKey = "soundcloud:one"))

        val queueTimer = MobileSleepTimerState(MobileSleepTimerMode.EndQueue)
        assertFalse(shouldStopForMobileSleepTimer(queueTimer, trackEnded = true, queueEnded = false))
        assertTrue(shouldStopForMobileSleepTimer(queueTimer, trackEnded = true, queueEnded = true))
    }

    @Test
    fun remotePlaybackBoundariesDetectChangesRepeatsAndNaturalQueueEnds() {
        assertFalse(detectMobilePlaybackBoundary(
            "youtube_music:one", "youtube_music:one", 20_000L, 21_000L,
            previousPlaying = true, currentPlaying = true, durationMs = 180_000L, queueAtTail = false,
        ).trackEnded)
        assertTrue(detectMobilePlaybackBoundary(
            "youtube_music:one", "youtube_music:two", 179_000L, 0L,
            previousPlaying = true, currentPlaying = true, durationMs = 180_000L, queueAtTail = false,
        ).trackEnded)
        assertTrue(detectMobilePlaybackBoundary(
            "youtube_music:one", "youtube_music:one", 179_000L, 180_000L,
            previousPlaying = true, currentPlaying = false, durationMs = 180_000L, queueAtTail = true,
        ).queueEnded)
    }
}
