package xyz.spiceapp.mobile

internal const val SPICE_CONNECT_COMMAND_POLL_INTERVAL_MS = 5_000L
internal const val SPICE_CONNECT_COMMAND_STATE_SETTLE_MS = 750L
internal const val SPICE_CONNECT_DEVICE_SYNC_INTERVAL_MS = 120_000L

internal fun shouldSyncSpiceConnectDevices(
    nowElapsedRealtimeMs: Long,
    nextDeviceSyncAtMs: Long,
    receivedCommands: Boolean,
): Boolean = receivedCommands || nowElapsedRealtimeMs >= nextDeviceSyncAtMs

internal fun nextSpiceConnectDeviceSyncAt(
    nowElapsedRealtimeMs: Long,
    receivedCommands: Boolean,
): Long = nowElapsedRealtimeMs + if (receivedCommands) {
    SPICE_CONNECT_COMMAND_POLL_INTERVAL_MS
} else {
    SPICE_CONNECT_DEVICE_SYNC_INTERVAL_MS
}
