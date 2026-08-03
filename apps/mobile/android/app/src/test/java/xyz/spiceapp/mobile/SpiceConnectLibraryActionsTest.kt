package xyz.spiceapp.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import xyz.spiceapp.mobile.model.Playlist

class SpiceConnectLibraryActionsTest {
    @Test
    fun pairingOnlyPlaylistsFallBackToAPrivateTitleMatch() {
        val shared = Playlist(id = "shared", title = "Road Trip", shared = true)
        val local = Playlist(id = "local", title = "  road trip  ")

        assertEquals(
            local,
            findPortableSpiceConnectPlaylist(listOf(shared, local), "phone-only-id", "Road Trip"),
        )
        assertEquals(
            shared,
            findPortableSpiceConnectPlaylist(listOf(shared, local), "shared", "Different title"),
        )
        assertNull(findPortableSpiceConnectPlaylist(listOf(shared), "missing", ""))
    }
}
