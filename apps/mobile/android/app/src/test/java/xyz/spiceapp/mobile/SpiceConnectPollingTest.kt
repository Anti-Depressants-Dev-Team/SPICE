package xyz.spiceapp.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SpiceConnectPollingTest {
    @Test
    fun keepsCommandPollingResponsiveWhileDeviceSyncUsesLongerCadence() {
        assertEquals(5_000L, SPICE_CONNECT_COMMAND_POLL_INTERVAL_MS)
        assertEquals(750L, SPICE_CONNECT_COMMAND_STATE_SETTLE_MS)
        assertEquals(120_000L, SPICE_CONNECT_DEVICE_SYNC_INTERVAL_MS)
    }

    @Test
    fun waitsUntilDeviceSyncDeadlineWhenNoCommandsArrive() {
        assertFalse(
            shouldSyncSpiceConnectDevices(
                nowElapsedRealtimeMs = 119_999L,
                nextDeviceSyncAtMs = 120_000L,
                receivedCommands = false,
            ),
        )
    }

    @Test
    fun syncsExactlyAtDeviceSyncDeadline() {
        assertTrue(
            shouldSyncSpiceConnectDevices(
                nowElapsedRealtimeMs = 120_000L,
                nextDeviceSyncAtMs = 120_000L,
                receivedCommands = false,
            ),
        )
    }

    @Test
    fun receivedCommandsTriggerImmediateDeviceSyncBeforeDeadline() {
        assertTrue(
            shouldSyncSpiceConnectDevices(
                nowElapsedRealtimeMs = 5_000L,
                nextDeviceSyncAtMs = 120_000L,
                receivedCommands = true,
            ),
        )
        assertEquals(
            10_000L,
            nextSpiceConnectDeviceSyncAt(
                nowElapsedRealtimeMs = 5_000L,
                receivedCommands = true,
            ),
        )
        assertEquals(
            125_000L,
            nextSpiceConnectDeviceSyncAt(
                nowElapsedRealtimeMs = 5_000L,
                receivedCommands = false,
            ),
        )
    }
}
