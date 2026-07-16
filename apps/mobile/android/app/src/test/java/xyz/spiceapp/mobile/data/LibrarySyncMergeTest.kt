package xyz.spiceapp.mobile.data

import org.junit.Assert.assertEquals
import org.junit.Test
import xyz.spiceapp.mobile.model.Track

class LibrarySyncMergeTest {
    private val desktopNewest = Track("desktop-new", "Desktop New", "Artist")
    private val shared = Track("shared", "Shared", "Artist")
    private val mobilePending = Track("mobile-new", "Mobile New", "Other")

    @Test
    fun firstReconciliationKeepsCloudRecencyAndAppendsUniqueMobileHistory() {
        val merged = mergeSyncHistory(
            remote = listOf(desktopNewest, shared),
            local = listOf(shared, mobilePending),
            initialReconciliation = true,
        )

        assertEquals(listOf("desktop-new", "shared", "mobile-new"), merged.map { it.id })
    }

    @Test
    fun pendingMobileListensLeadTheNextCloudSnapshot() {
        val merged = mergeSyncHistory(
            remote = listOf(desktopNewest, shared),
            local = listOf(mobilePending, shared),
            pendingLocalTrackIds = setOf("mobile-new"),
        )

        assertEquals(listOf("mobile-new", "desktop-new", "shared"), merged.map { it.id })
    }

    @Test
    fun settledMobileHistoryFollowsTheCloudOrder() {
        val merged = mergeSyncHistory(
            remote = listOf(desktopNewest, shared),
            local = listOf(shared, mobilePending),
        )

        assertEquals(listOf("desktop-new", "shared"), merged.map { it.id })
    }

    @Test
    fun firstLikesReconciliationKeepsCloudAndExistingMobileLikes() {
        val merged = mergeSyncLikes(
            remote = listOf(desktopNewest),
            local = listOf(mobilePending),
            initialReconciliation = true,
        )

        assertEquals(listOf("desktop-new", "mobile-new"), merged.map { it.id })
    }

    @Test
    fun pendingMobileUnlikeRemovesACloudLike() {
        val merged = mergeSyncLikes(
            remote = listOf(desktopNewest, shared),
            local = listOf(shared),
            pendingLocalTrackIds = setOf("desktop-new"),
        )

        assertEquals(listOf("shared"), merged.map { it.id })
    }

    @Test
    fun settledMobileLikesFollowTheCloudSnapshot() {
        val merged = mergeSyncLikes(
            remote = listOf(desktopNewest),
            local = listOf(mobilePending),
        )

        assertEquals(listOf("desktop-new"), merged.map { it.id })
    }
}
