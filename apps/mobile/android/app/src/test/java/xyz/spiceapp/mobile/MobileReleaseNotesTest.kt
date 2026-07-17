package xyz.spiceapp.mobile

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileReleaseNotesTest {
    @Test
    fun markdownReleaseNotesBecomeReadableMobileText() {
        val notes = readableMobileReleaseNotes(
            """
            ## What's Changed
            * Fix player controls in https://github.com/example/spice/pull/64
            **Full Changelog**: [Compare releases](https://github.com/example/spice/compare/v1...v2)
            """.trimIndent(),
        )

        assertTrue(notes.startsWith("What's Changed\n\u2022 Fix player controls"))
        assertTrue(notes.contains("Full Changelog: Compare releases"))
        assertTrue(notes.contains("/\u200B"))
        assertFalse(notes.contains("##"))
        assertFalse(notes.contains("**"))
    }
}
