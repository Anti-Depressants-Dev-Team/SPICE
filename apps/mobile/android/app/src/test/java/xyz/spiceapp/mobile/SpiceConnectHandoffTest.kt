package xyz.spiceapp.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SpiceConnectHandoffTest {
    @Test
    fun sourceWaitsForDestinationBeforeEnteringThePausedCommitPhase() {
        val pending = beginSpiceConnectHandoff(
            transferId = "phone:desktop:transfer",
            targetDeviceId = "desktop",
            targetName = "Desktop",
            sourceWasPlaying = true,
        )

        assertEquals(SpiceConnectHandoffPhase.WaitingForReady, pending.phase)
        val accepted = acceptSpiceConnectHandoffReady(
            pending = pending,
            transferId = pending.transferId,
            sourceDeviceId = "desktop",
            sourceWasPlaying = true,
        )
        assertEquals(SpiceConnectHandoffPhase.WaitingForComplete, accepted?.phase)
        assertTrue(accepted?.sourceWasPlaying == true)
    }

    @Test
    fun unrelatedOrLateAcknowledgementsCannotMoveTheSourceState() {
        val pending = beginSpiceConnectHandoff(
            transferId = "transfer-a",
            targetDeviceId = "desktop",
            targetName = "Desktop",
            sourceWasPlaying = true,
        )

        assertNull(
            acceptSpiceConnectHandoffReady(
                pending = pending,
                transferId = "transfer-b",
                sourceDeviceId = "desktop",
                sourceWasPlaying = true,
            ),
        )
        assertNull(
            acceptSpiceConnectHandoffReady(
                pending = pending,
                transferId = "transfer-a",
                sourceDeviceId = "unknown-device",
                sourceWasPlaying = true,
            ),
        )
        assertFalse(completesSpiceConnectHandoff(pending, "transfer-a", "desktop"))
    }

    @Test
    fun completionRequiresTheAcceptedTargetAndExactTransferId() {
        val accepted = acceptSpiceConnectHandoffReady(
            pending = beginSpiceConnectHandoff(
                transferId = "transfer-a",
                targetDeviceId = "desktop",
                targetName = "Desktop",
                sourceWasPlaying = true,
            ),
            transferId = "transfer-a",
            sourceDeviceId = "desktop",
            sourceWasPlaying = true,
        )

        assertTrue(completesSpiceConnectHandoff(accepted, "transfer-a", "desktop"))
        assertFalse(completesSpiceConnectHandoff(accepted, "transfer-b", "desktop"))
        assertFalse(completesSpiceConnectHandoff(accepted, "transfer-a", "phone"))
    }

    @Test
    fun transferIdsAreBoundedAndSanitizedBeforeMatching() {
        assertEquals(
            "phone:desktop:abc-123_value",
            normalizeSpiceConnectTransferId(" phone:desktop:abc-123_value ! "),
        )
        assertTrue(SPICE_CONNECT_HANDOFF_ACCEPT_TIMEOUT_MS < SPICE_CONNECT_HANDOFF_COMPLETE_TIMEOUT_MS)
    }

    @Test
    fun ambiguousCommitFailureKeepsTheSourcePaused() {
        val accepted = acceptSpiceConnectHandoffReady(
            pending = beginSpiceConnectHandoff(
                transferId = "transfer-a",
                targetDeviceId = "desktop",
                targetName = "Desktop",
                sourceWasPlaying = true,
            ),
            transferId = "transfer-a",
            sourceDeviceId = "desktop",
            sourceWasPlaying = true,
        )

        assertFalse(
            shouldResumeSpiceConnectSource(
                accepted,
                destinationConfirmedNoPlayback = false,
            ),
        )
        assertTrue(
            shouldResumeSpiceConnectSource(
                accepted,
                destinationConfirmedNoPlayback = true,
            ),
        )
    }

    @Test
    fun destinationRejectsLateOrMismatchedCommits() {
        val prepared = PreparedSpiceConnectHandoff(
            transferId = "transfer-a",
            sourceDeviceId = "desktop",
            expiresAtElapsedMs = 9_000L,
        )

        assertTrue(acceptsPreparedSpiceConnectCommit(prepared, "transfer-a", "desktop", 8_999L))
        assertFalse(acceptsPreparedSpiceConnectCommit(prepared, "transfer-a", "desktop", 9_000L))
        assertFalse(acceptsPreparedSpiceConnectCommit(prepared, "transfer-b", "desktop", 8_000L))
        assertFalse(acceptsPreparedSpiceConnectCommit(prepared, "transfer-a", "phone", 8_000L))
    }
}
