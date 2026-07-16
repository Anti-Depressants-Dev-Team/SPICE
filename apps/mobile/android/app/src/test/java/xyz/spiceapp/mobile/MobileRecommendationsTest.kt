package xyz.spiceapp.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import xyz.spiceapp.mobile.model.FeedSection
import xyz.spiceapp.mobile.model.Track

class MobileRecommendationsTest {
    private val played = Track("played", "Digital Love", "Daft Punk", sourceId = "youtube_music")
    private val liked = Track("liked", "Genesis", "Justice", sourceId = "soundcloud")

    @Test
    fun tasteSeedsUseDistinctRecentAndLikedArtists() {
        val seeds = buildMobileRecommendationSeeds(
            history = listOf(played, played.copy(id = "other")),
            liked = listOf(liked),
        )

        assertEquals(listOf("Daft Punk", "Justice"), seeds.map { it.track.artist })
        assertTrue(seeds.first().label.startsWith("Because you played"))
    }

    @Test
    fun rankingExcludesHistoryAndKeepsProviderVariety() {
        val seed = buildMobileRecommendationSeeds(listOf(played), listOf(liked), 1).single()
        val batches = listOf(
            MobileRecommendationBatch(
                seed,
                listOf(
                    played,
                    Track("one", "One More Time", "Daft Punk", sourceId = "youtube_music"),
                    Track("two", "Phantom", "Justice", sourceId = "soundcloud"),
                ),
            ),
        )

        val ranked = rankMobileRecommendations(batches, listOf(played), listOf(liked))

        assertFalse(ranked.any { it.id == played.id })
        assertEquals(setOf("youtube_music", "soundcloud"), ranked.map { it.sourceId }.toSet())
    }

    @Test
    fun smartQueueDoesNotRepeatTheCurrentQueue() {
        val sections = listOf(
            FeedSection("Recommended Next", listOf(played, liked)),
            FeedSection("Quick Picks", listOf(liked.copy(id = "fresh"))),
        )

        val continuation = mobileSmartQueueCandidates(sections, listOf(played))

        assertFalse(continuation.any { it.id == played.id })
        assertTrue(continuation.isNotEmpty())
    }
}
