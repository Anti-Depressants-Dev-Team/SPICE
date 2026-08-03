package xyz.spiceapp.mobile.data

import org.json.JSONArray
import org.json.JSONObject
import xyz.spiceapp.mobile.model.RemoteCommand
import xyz.spiceapp.mobile.model.RemoteDevice
import java.text.SimpleDateFormat
import java.text.ParsePosition
import java.util.Date
import java.util.Locale
import java.util.TimeZone

internal const val SPICE_CONNECT_LAN_PROTOCOL_VERSION = 1
internal const val SPICE_CONNECT_LAN_SIGNAL_COMMAND = "lan_signal"
internal const val SPICE_CONNECT_LAN_CHANNEL_LABEL = "spice-connect-lan"
internal const val SPICE_CONNECT_LAN_CHANNEL_PROTOCOL = "spice-connect-lan-v1"
internal const val SPICE_CONNECT_LAN_MAX_MESSAGE_BYTES = 512 * 1024
internal const val SPICE_CONNECT_LAN_MAX_PEERS = 8
internal const val SPICE_CONNECT_LAN_NEGOTIATION_TIMEOUT_MS = 15_000L
internal const val SPICE_CONNECT_LAN_PEER_TIMEOUT_MS = 45_000L
internal const val SPICE_CONNECT_LAN_HEARTBEAT_INTERVAL_MS = 15_000L

private val spiceConnectLanSessionPattern = Regex("^[a-zA-Z0-9:_-]+$")
private val spiceConnectLanCommands = setOf(
    "play",
    "pause",
    "toggle",
    "next",
    "previous",
    "seek",
    "volume",
    "shuffle",
    "repeat",
    "play_track",
    "handoff",
    "handoff_prepare",
    "handoff_ready",
    "handoff_commit",
    "handoff_complete",
    "handoff_cancel",
    "connect",
)

internal data class SpiceConnectLanSignal(
    val kind: String,
    val sessionId: String,
    val descriptionType: String = "",
    val descriptionSdp: String = "",
) {
    fun toJson(): JSONObject = JSONObject()
        .put("version", SPICE_CONNECT_LAN_PROTOCOL_VERSION)
        .put("kind", kind)
        .put("sessionId", sessionId)
        .also { payload ->
            if (descriptionType.isNotEmpty() && descriptionSdp.isNotEmpty()) {
                payload.put(
                    "description",
                    JSONObject()
                        .put("type", descriptionType)
                        .put("sdp", descriptionSdp),
                )
            }
        }
}

internal sealed interface SpiceConnectLanEnvelope {
    data class Hello(val deviceId: String) : SpiceConnectLanEnvelope
    data class Command(val command: RemoteCommand) : SpiceConnectLanEnvelope
    data class State(val state: RemoteDevice) : SpiceConnectLanEnvelope
    data class Ping(val sentAt: Long) : SpiceConnectLanEnvelope
    data class Pong(val sentAt: Long) : SpiceConnectLanEnvelope
}

internal fun normalizeSpiceConnectLanDeviceId(value: String): String = value.trim().take(120)

internal fun normalizeSpiceConnectLanSessionId(value: String): String {
    val normalized = value.trim().take(160)
    return normalized.takeIf { it.isNotEmpty() && spiceConnectLanSessionPattern.matches(it) }.orEmpty()
}

internal fun isSpiceConnectLanOfferer(localDeviceId: String, peerDeviceId: String): Boolean =
    normalizeSpiceConnectLanDeviceId(localDeviceId) < normalizeSpiceConnectLanDeviceId(peerDeviceId)

internal fun parseSpiceConnectLanSignal(payloadJson: String): SpiceConnectLanSignal? = runCatching {
    parseSpiceConnectLanSignal(JSONObject(payloadJson))
}.getOrNull()

internal fun parseSpiceConnectLanSignal(payload: JSONObject): SpiceConnectLanSignal? {
    if (payload.optInt("version", -1) != SPICE_CONNECT_LAN_PROTOCOL_VERSION) return null
    val kind = payload.optString("kind").trim()
    val sessionId = normalizeSpiceConnectLanSessionId(payload.optString("sessionId"))
    if (sessionId.isEmpty()) return null
    if (kind == "request") return SpiceConnectLanSignal(kind = kind, sessionId = sessionId)
    if (kind !in setOf("offer", "answer")) return null

    val description = payload.optJSONObject("description") ?: return null
    val descriptionType = description.optString("type").trim()
    val descriptionSdp = description.optString("sdp")
    if (
        descriptionType != kind ||
        descriptionSdp.isEmpty() ||
        descriptionSdp.length > 128 * 1024
    ) return null
    return SpiceConnectLanSignal(
        kind = kind,
        sessionId = sessionId,
        descriptionType = descriptionType,
        descriptionSdp = descriptionSdp,
    )
}

internal fun parseSpiceConnectLanEnvelope(
    payload: JSONObject,
    expectedPeerDeviceIdValue: String,
    localDeviceIdValue: String,
    expectedSessionId: String,
): SpiceConnectLanEnvelope? {
    if (payload.optInt("version", -1) != SPICE_CONNECT_LAN_PROTOCOL_VERSION) return null
    if (normalizeSpiceConnectLanSessionId(payload.optString("sessionId")) != expectedSessionId) return null
    val expectedPeerDeviceId = normalizeSpiceConnectLanDeviceId(expectedPeerDeviceIdValue)
    val localDeviceId = normalizeSpiceConnectLanDeviceId(localDeviceIdValue)

    return when (payload.optString("type")) {
        "hello" -> normalizeSpiceConnectLanDeviceId(payload.optString("deviceId"))
            .takeIf { it == expectedPeerDeviceId }
            ?.let(SpiceConnectLanEnvelope::Hello)

        "command" -> {
            val item = payload.optJSONObject("command") ?: return null
            val id = item.optString("id").trim().take(200)
            val sourceDeviceId = normalizeSpiceConnectLanDeviceId(item.optString("sourceDeviceId"))
            val targetDeviceId = normalizeSpiceConnectLanDeviceId(item.optString("targetDeviceId"))
            val command = item.optString("command").trim()
            val createdAt = item.optString("createdAt").trim()
            if (
                id.isEmpty() ||
                sourceDeviceId != expectedPeerDeviceId ||
                targetDeviceId != localDeviceId ||
                command !in spiceConnectLanCommands ||
                parseSpiceConnectLanTimestamp(createdAt) == null
            ) return null
            val normalizedItem = JSONObject(item.toString())
                .put("id", id)
                .put("sourceDeviceId", sourceDeviceId)
                .put("command", command)
                .put("payload", item.optJSONObject("payload") ?: JSONObject())
            parseRemoteCommands(
                JSONObject().put("commands", JSONArray().put(normalizedItem)),
            ).singleOrNull()?.let(SpiceConnectLanEnvelope::Command)
        }

        "state" -> {
            val statePayload = payload.optJSONObject("state") ?: return null
            normalizeSpiceConnectLanState(statePayload)
                ?.takeIf { it.deviceId == expectedPeerDeviceId }
                ?.let(SpiceConnectLanEnvelope::State)
        }

        "ping", "pong" -> {
            val sentAt = payload.optDouble("sentAt", Double.NaN)
            if (!sentAt.isFinite()) return null
            if (payload.optString("type") == "ping") {
                SpiceConnectLanEnvelope.Ping(sentAt.toLong())
            } else {
                SpiceConnectLanEnvelope.Pong(sentAt.toLong())
            }
        }

        else -> null
    }
}

internal fun normalizeSpiceConnectLanState(payload: JSONObject): RemoteDevice? {
    val deviceId = normalizeSpiceConnectLanDeviceId(payload.optString("deviceId"))
    if (deviceId.isEmpty()) return null
    val displayName = payload.optString("displayName").trim().take(80).ifEmpty { "Spice Connect Device" }
    val queue = payload.optJSONArray("queue") ?: JSONArray()
    val boundedQueue = JSONArray()
    for (index in 0 until minOf(queue.length(), 80)) boundedQueue.put(queue.opt(index))
    val normalized = JSONObject()
        .put("deviceId", deviceId)
        .put("displayName", displayName)
        .put("currentTrack", payload.optJSONObject("currentTrack") ?: JSONObject.NULL)
        .put("queue", boundedQueue)
        .put("queueIndex", payload.optInt("queueIndex", 0).coerceAtLeast(0))
        .put("isPlaying", payload.optBoolean("isPlaying", false))
        .put("shuffleEnabled", payload.optBoolean("shuffleEnabled", false))
        .put("repeatMode", payload.optString("repeatMode"))
        .put("progress", payload.optDouble("progress", 0.0).takeIf(Double::isFinite)?.coerceIn(0.0, 86_400.0) ?: 0.0)
        .put("duration", payload.optDouble("duration", 0.0).takeIf(Double::isFinite)?.coerceIn(0.0, 86_400.0) ?: 0.0)
        .put("volume", payload.optInt("volume", 70).coerceIn(0, 100))
        .put("updatedAt", payload.optString("updatedAt").takeIf { parseSpiceConnectLanTimestamp(it) != null }
            ?: spiceConnectLanTimestamp())
        .put("isOnline", true)
    return parseRemoteDevice(normalized)
}

internal fun spiceConnectLanStateJson(state: RemoteDevice, nowMs: Long = System.currentTimeMillis()): JSONObject {
    val projected = projectSpiceConnectLanState(state, nowMs)
    return JSONObject()
        .put("deviceId", normalizeSpiceConnectLanDeviceId(projected.deviceId))
        .put("displayName", projected.displayName.trim().take(80).ifEmpty { "Spice Connect Device" })
        .put("currentTrack", projected.currentTrack?.toRemoteTrackJson() ?: JSONObject.NULL)
        .put("queue", JSONArray(projected.queue.take(80).map { it.toRemoteTrackJson() }))
        .put("queueIndex", projected.queueIndex.coerceIn(0, projected.queue.lastIndex.coerceAtLeast(0)))
        .put("isPlaying", projected.isPlaying)
        .put("shuffleEnabled", projected.shuffleEnabled)
        .put("repeatMode", projected.repeatMode.toRemoteValue())
        .put("progress", projected.progressMs.coerceAtLeast(0) / 1000.0)
        .put("duration", projected.durationMs.coerceAtLeast(0) / 1000.0)
        .put("volume", projected.volume.coerceIn(0, 100))
        .put("updatedAt", projected.updatedAt)
}

internal fun projectSpiceConnectLanState(state: RemoteDevice, nowMs: Long): RemoteDevice {
    val updatedAtMs = parseSpiceConnectLanTimestamp(state.updatedAt)
    val elapsedMs = if (state.isPlaying && updatedAtMs != null) {
        (nowMs - updatedAtMs).coerceIn(0L, 120_000L)
    } else {
        0L
    }
    val projectedProgressMs = (state.progressMs + elapsedMs)
        .coerceAtLeast(0L)
        .let { progress -> state.durationMs.takeIf { it > 0 }?.let(progress::coerceAtMost) ?: progress }
    return state.copy(
        progressMs = projectedProgressMs,
        updatedAt = spiceConnectLanTimestamp(nowMs),
        isOnline = true,
    )
}

internal fun spiceConnectLanTimestamp(nowMs: Long = System.currentTimeMillis()): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date(nowMs))

internal fun parseSpiceConnectLanTimestamp(value: String): Long? {
    val normalized = value.trim()
    if (normalized.isEmpty()) return null
    return listOf("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'")
        .firstNotNullOfOrNull { pattern ->
            val position = ParsePosition(0)
            val parsed = runCatching {
                SimpleDateFormat(pattern, Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                    isLenient = false
                }.parse(normalized, position)
            }.getOrNull()
            parsed?.time?.takeIf { position.index == normalized.length && position.errorIndex < 0 }
        }
}
