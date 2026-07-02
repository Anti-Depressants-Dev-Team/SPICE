package xyz.spiceapp.mobile.data.local

import org.junit.Assert.assertEquals
import org.junit.Test
import xyz.spiceapp.mobile.model.Track

class TrackEntityTest {
    @Test
    fun roundTripsTrackMetadataForLocalStorage() {
        val track = Track(
            id = "soundcloud:42",
            title = "Digital Love",
            artist = "Daft Punk",
            album = "Discovery",
            durationMs = 301_000,
            artworkUrl = "https://example.test/art.jpg",
            sourceId = "soundcloud",
        )

        val entity = track.toEntity(updatedAt = 1234)
        val restored = entity.toTrack()

        assertEquals("soundcloud:42", entity.id)
        assertEquals(1234, entity.updatedAt)
        assertEquals(track, restored)
    }
}
