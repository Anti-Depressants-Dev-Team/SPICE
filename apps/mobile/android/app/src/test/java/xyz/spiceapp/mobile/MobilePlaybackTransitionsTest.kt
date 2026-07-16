package xyz.spiceapp.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobilePlaybackTransitionsTest {
    @Test
    fun transitionPreparesBeforeItsFadeWindow() {
        assertTrue(shouldPrepareMobileTransition(80_000L, 100_000L, 5_000L, hasNextTrack = true))
        assertFalse(shouldStartMobileTransition(80_000L, 100_000L, 5_000L, prepared = true))
        assertTrue(shouldStartMobileTransition(96_000L, 100_000L, 5_000L, prepared = true))
        assertFalse(shouldPrepareMobileTransition(96_000L, 100_000L, 5_000L, hasNextTrack = false))
    }

    @Test
    fun gainFadesOutThenBackIn() {
        assertEquals(1f, mobileTransitionGain(0L, 4_000L), 0.001f)
        assertEquals(0f, mobileTransitionGain(2_000L, 4_000L), 0.001f)
        assertEquals(1f, mobileTransitionGain(4_000L, 4_000L), 0.001f)
    }

    @Test
    fun durationIsBoundedForMobilePlayback() {
        assertEquals(0L, normalizeMobileCrossfadeDurationMs(-1L))
        assertEquals(MAX_MOBILE_CROSSFADE_DURATION_MS, normalizeMobileCrossfadeDurationMs(60_000L))
    }
}
