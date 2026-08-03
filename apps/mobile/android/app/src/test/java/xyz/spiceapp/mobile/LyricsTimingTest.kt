package xyz.spiceapp.mobile

import org.junit.Assert.assertEquals
import org.junit.Test

class LyricsTimingTest {
    @Test
    fun parsesAndSortsLrcTimestamps() {
        assertEquals(
            listOf(
                TimedLyricLine(1_250L, "First"),
                TimedLyricLine(2_500L, "Second"),
                TimedLyricLine(62_345L, "Later"),
            ),
            parseTimedLyrics("[00:02.50]Second\n[ar:Spice]\n[00:01.250]First\n[01:02.345]Later"),
        )
    }

    @Test
    fun expandsMultipleTimestampsForTheSameLine() {
        assertEquals(
            listOf(
                TimedLyricLine(5_000L, "Chorus"),
                TimedLyricLine(10_000L, "Chorus"),
            ),
            parseTimedLyrics("[00:05.00][00:10.00]Chorus"),
        )
    }

    @Test
    fun findsTheLatestLineAtOrBeforePlaybackPosition() {
        val lines = parseTimedLyrics("[00:01.00]One\n[00:03.00]Three")
        assertEquals(-1, activeTimedLyricIndex(lines, 999L))
        assertEquals(0, activeTimedLyricIndex(lines, 1_000L))
        assertEquals(1, activeTimedLyricIndex(lines, 4_000L))
    }
}
