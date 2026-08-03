package xyz.spiceapp.mobile

import xyz.spiceapp.mobile.model.Track

internal fun resolveQueueSelectionIndex(
    queue: List<Track>,
    selectedTrack: Track,
    requestedIndex: Int? = null,
): Int {
    if (
        requestedIndex != null &&
        requestedIndex in queue.indices &&
        queue[requestedIndex].sourceId == selectedTrack.sourceId &&
        queue[requestedIndex].id == selectedTrack.id
    ) return requestedIndex

    return queue.indexOfFirst {
        it.sourceId == selectedTrack.sourceId && it.id == selectedTrack.id
    }.takeIf { it >= 0 } ?: 0
}
