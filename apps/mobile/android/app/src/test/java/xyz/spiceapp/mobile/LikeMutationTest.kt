package xyz.spiceapp.mobile

import org.junit.Assert.assertEquals
import org.junit.Test

class LikeMutationTest {
    @Test
    fun optimisticToggleChangesTheVisibleStateImmediately() {
        assertEquals(true, nextLikeState(currentlyLiked = false))
        assertEquals(false, nextLikeState(currentlyLiked = true))
    }

    @Test
    fun latestSuccessfulMutationIsConfirmed() {
        assertEquals(
            LikeMutationResolution.Confirm,
            resolveLikeMutation(
                requestRevision = 4,
                latestRevision = 4,
                requestedLiked = true,
                currentlyLiked = true,
                succeeded = true,
            ),
        )
    }

    @Test
    fun latestFailedMutationRollsBack() {
        assertEquals(
            LikeMutationResolution.RollBack,
            resolveLikeMutation(
                requestRevision = 4,
                latestRevision = 4,
                requestedLiked = false,
                currentlyLiked = false,
                succeeded = false,
            ),
        )
    }

    @Test
    fun anOlderResponseNeverOverwritesARapidNewerTap() {
        for (succeeded in listOf(true, false)) {
            assertEquals(
                LikeMutationResolution.ReconcileNewerChange,
                resolveLikeMutation(
                    requestRevision = 4,
                    latestRevision = 6,
                    requestedLiked = true,
                    currentlyLiked = true,
                    succeeded = succeeded,
                ),
            )
        }
    }

    @Test
    fun aCrossDeviceStateChangeIsReconciledInsteadOfOverwritten() {
        assertEquals(
            LikeMutationResolution.ReconcileNewerChange,
            resolveLikeMutation(
                requestRevision = 8,
                latestRevision = 8,
                requestedLiked = true,
                currentlyLiked = false,
                succeeded = true,
            ),
        )
    }
}
