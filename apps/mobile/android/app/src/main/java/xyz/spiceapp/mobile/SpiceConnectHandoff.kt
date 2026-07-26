package xyz.spiceapp.mobile

internal const val SPICE_CONNECT_HANDOFF_ACCEPT_TIMEOUT_MS = 8_000L
internal const val SPICE_CONNECT_HANDOFF_COMPLETE_TIMEOUT_MS = 12_000L

internal enum class SpiceConnectHandoffPhase {
    WaitingForReady,
    WaitingForComplete,
}

internal data class PendingSpiceConnectHandoff(
    val transferId: String,
    val targetDeviceId: String,
    val targetName: String,
    val sourceWasPlaying: Boolean,
    val phase: SpiceConnectHandoffPhase,
)

internal data class PreparedSpiceConnectHandoff(
    val transferId: String,
    val sourceDeviceId: String,
    val expiresAtElapsedMs: Long,
)

internal fun beginSpiceConnectHandoff(
    transferId: String,
    targetDeviceId: String,
    targetName: String,
    sourceWasPlaying: Boolean,
): PendingSpiceConnectHandoff = PendingSpiceConnectHandoff(
    transferId = transferId,
    targetDeviceId = targetDeviceId,
    targetName = targetName,
    sourceWasPlaying = sourceWasPlaying,
    phase = SpiceConnectHandoffPhase.WaitingForReady,
)

internal fun acceptSpiceConnectHandoffReady(
    pending: PendingSpiceConnectHandoff?,
    transferId: String,
    sourceDeviceId: String,
    sourceWasPlaying: Boolean,
): PendingSpiceConnectHandoff? = pending
    ?.takeIf {
        it.phase == SpiceConnectHandoffPhase.WaitingForReady &&
            it.transferId == transferId &&
            it.targetDeviceId == sourceDeviceId
    }
    ?.copy(
        sourceWasPlaying = sourceWasPlaying,
        phase = SpiceConnectHandoffPhase.WaitingForComplete,
    )

internal fun completesSpiceConnectHandoff(
    pending: PendingSpiceConnectHandoff?,
    transferId: String,
    sourceDeviceId: String,
): Boolean = pending?.let {
    it.phase == SpiceConnectHandoffPhase.WaitingForComplete &&
        it.transferId == transferId &&
        it.targetDeviceId == sourceDeviceId
} == true

internal fun shouldResumeSpiceConnectSource(
    pending: PendingSpiceConnectHandoff?,
    destinationConfirmedNoPlayback: Boolean,
): Boolean = pending?.sourceWasPlaying == true && (
    pending.phase == SpiceConnectHandoffPhase.WaitingForReady ||
        destinationConfirmedNoPlayback
    )

internal fun acceptsPreparedSpiceConnectCommit(
    prepared: PreparedSpiceConnectHandoff?,
    transferId: String,
    sourceDeviceId: String,
    nowElapsedMs: Long,
): Boolean = prepared?.let {
    it.transferId == transferId &&
        it.sourceDeviceId == sourceDeviceId &&
        it.expiresAtElapsedMs > nowElapsedMs
} == true

internal fun normalizeSpiceConnectTransferId(value: String): String =
    value.trim()
        .filter { it.isLetterOrDigit() || it == ':' || it == '_' || it == '-' }
        .take(160)
