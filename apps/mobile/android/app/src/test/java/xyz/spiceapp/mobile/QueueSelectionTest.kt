package xyz.spiceapp.mobile

import org.junit.Assert.assertEquals
import org.junit.Test
import xyz.spiceapp.mobile.model.Track

class QueueSelectionTest {
    @Test
    fun preservesTheTappedOccurrenceWhenTheQueueContainsDuplicates() {
        val duplicate = Track(id = "same", title = "Duplicate", artist = "Artist")
        val queue = listOf(
            duplicate,
            Track(id = "middle", title = "Middle", artist = "Artist"),
            duplicate,
        )

        assertEquals(2, resolveQueueSelectionIndex(queue, duplicate, requestedIndex = 2))
        assertEquals(0, resolveQueueSelectionIndex(queue, duplicate))
    }
}
