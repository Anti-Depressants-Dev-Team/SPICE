package xyz.spiceapp.mobile

import xyz.spiceapp.mobile.model.FeedSection
import xyz.spiceapp.mobile.model.Track

internal data class MobileRecommendationSeed(
    val track: Track,
    val query: String,
    val label: String,
)

internal data class MobileRecommendationBatch(
    val seed: MobileRecommendationSeed,
    val tracks: List<Track>,
)

internal fun buildMobileRecommendationSeeds(
    history: List<Track>,
    liked: List<Track>,
    limit: Int = 3,
): List<MobileRecommendationSeed> {
    val seenArtists = mutableSetOf<String>()
    return (history.take(12) + liked.take(12))
        .asSequence()
        .filter { it.title.isNotBlank() }
        .filter { track ->
            val artistKey = track.artist.tasteKey()
            artistKey.isNotBlank() && artistKey != "unknown artist" && seenArtists.add(artistKey)
        }
        .map { track ->
            MobileRecommendationSeed(
                track = track,
                query = listOf(track.artist, track.album.ifBlank { track.title }, "music")
                    .filter(String::isNotBlank)
                    .joinToString(" "),
                label = if (history.any { it.sameTrack(track) }) {
                    "Because you played ${track.title}"
                } else {
                    "Inspired by your likes"
                },
            )
        }
        .take(limit.coerceAtLeast(0))
        .toList()
}

internal fun rankMobileRecommendations(
    batches: List<MobileRecommendationBatch>,
    history: List<Track>,
    liked: List<Track>,
    limit: Int = 18,
): List<Track> {
    val excludedTracks = history.mapTo(mutableSetOf()) { it.recommendationKey() }
    val likedArtists = liked.mapTo(mutableSetOf()) { it.artist.tasteKey() }
    val historyArtistWeights = history
        .map { it.artist.tasteKey() }
        .filter(String::isNotBlank)
        .groupingBy { it }
        .eachCount()
    val scored = linkedMapOf<String, Pair<Track, Int>>()
    var ordinal = 0

    batches.forEachIndexed { batchIndex, batch ->
        batch.tracks.forEach { track ->
            val key = track.recommendationKey()
            if (key in excludedTracks || track.title.isBlank()) return@forEach
            val artistKey = track.artist.tasteKey()
            val titleArtistKey = "${track.title.tasteKey()}|$artistKey"
            if (scored.containsKey(titleArtistKey)) return@forEach
            val score = 1_000 - ordinal++ - (batchIndex * 8) +
                (historyArtistWeights[artistKey] ?: 0) * 18 +
                (if (artistKey in likedArtists) 42 else 0) +
                (if (track.sourceId == batch.seed.track.sourceId) 4 else 0)
            scored[titleArtistKey] = track to score
        }
    }

    val artistCounts = mutableMapOf<String, Int>()
    val sourceCounts = mutableMapOf<String, Int>()
    return scored.values
        .sortedByDescending { it.second }
        .map { it.first }
        .filter { track ->
            val artistKey = track.artist.tasteKey()
            val artistCount = artistCounts[artistKey] ?: 0
            val sourceCount = sourceCounts[track.sourceId] ?: 0
            val keep = artistCount < 2 || sourceCount == 0
            if (keep) {
                artistCounts[artistKey] = artistCount + 1
                sourceCounts[track.sourceId] = sourceCount + 1
            }
            keep
        }
        .take(limit.coerceAtLeast(0))
        .toList()
}

internal fun mobileRecommendationSections(
    batches: List<MobileRecommendationBatch>,
    history: List<Track>,
    liked: List<Track>,
): List<FeedSection> {
    if (batches.isEmpty()) return emptyList()
    val recommended = rankMobileRecommendations(batches, history, liked)
    val excluded = history.mapTo(mutableSetOf()) { it.recommendationKey() }
    return buildList {
        if (recommended.isNotEmpty()) add(FeedSection("Recommended Next", recommended))
        batches.take(2).forEach { batch ->
            val tracks = batch.tracks
                .filterNot { it.recommendationKey() in excluded }
                .distinctBy { it.recommendationKey() }
                .take(10)
            if (tracks.isNotEmpty()) add(FeedSection(batch.seed.label, tracks))
        }
    }
}

internal fun mobileSmartQueueCandidates(
    sections: List<FeedSection>,
    currentQueue: List<Track>,
    limit: Int = 20,
): List<Track> {
    val excluded = currentQueue.mapTo(mutableSetOf()) { it.recommendationKey() }
    val artistCounts = mutableMapOf<String, Int>()
    return sections
        .sortedBy { if (it.title == "Recommended Next") 0 else 1 }
        .flatMap { it.tracks }
        .distinctBy { it.recommendationKey() }
        .filterNot { it.recommendationKey() in excluded }
        .filter { track ->
            val key = track.artist.tasteKey()
            val count = artistCounts[key] ?: 0
            if (count >= 2) return@filter false
            artistCounts[key] = count + 1
            true
        }
        .take(limit.coerceAtLeast(0))
}

private fun Track.sameTrack(other: Track): Boolean = recommendationKey() == other.recommendationKey()

private fun Track.recommendationKey(): String = "${sourceId.tasteKey()}:${id.trim()}"

private fun String.tasteKey(): String = lowercase()
    .replace(Regex("[^a-z0-9]+"), " ")
    .trim()
