package xyz.spiceapp.mobile.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import xyz.spiceapp.mobile.model.RemoteDevice

class SpiceConnectLanProtocolTest {
    @Test
    fun `offerer selection is deterministic across peers`() {
        assertTrue(isSpiceConnectLanOfferer("android-a", "desktop-b"))
        assertFalse(isSpiceConnectLanOfferer("desktop-b", "android-a"))
    }

    @Test
    fun `signals require a bounded versioned session and matching description`() {
        val request = parseSpiceConnectLanSignal(
            JSONObject()
                .put("version", 1)
                .put("kind", "request")
                .put("sessionId", "lan-session_1"),
        )
        assertEquals("request", request?.kind)
        assertNull(
            parseSpiceConnectLanSignal(
                JSONObject()
                    .put("version", 1)
                    .put("kind", "offer")
                    .put("sessionId", "invalid session")
                    .put("description", JSONObject().put("type", "offer").put("sdp", "v=0")),
            ),
        )
        assertNull(
            parseSpiceConnectLanSignal(
                JSONObject()
                    .put("version", 1)
                    .put("kind", "offer")
                    .put("sessionId", "session-1")
                    .put("description", JSONObject().put("type", "answer").put("sdp", "v=0")),
            ),
        )
    }

    @Test
    fun `command envelopes are bound to peer target session and allow list`() {
        val command = JSONObject()
            .put("id", "lan:session-1:command-1")
            .put("sourceDeviceId", "desktop")
            .put("targetDeviceId", "android")
            .put("command", "volume")
            .put("payload", JSONObject().put("volume", 42))
            .put("createdAt", "2026-08-02T10:20:30.000Z")
        val envelope = JSONObject()
            .put("version", 1)
            .put("type", "command")
            .put("sessionId", "session-1")
            .put("command", command)

        val parsed = parseSpiceConnectLanEnvelope(envelope, "desktop", "android", "session-1")
        assertTrue(parsed is SpiceConnectLanEnvelope.Command)
        assertEquals(42, (parsed as SpiceConnectLanEnvelope.Command).command.volume)

        command
            .put("command", "set_like")
            .put("payload", JSONObject().put("liked", true).put("track", JSONObject().put("id", "track-1")))
        val libraryAction = parseSpiceConnectLanEnvelope(envelope, "desktop", "android", "session-1")
        assertEquals(true, (libraryAction as SpiceConnectLanEnvelope.Command).command.liked)

        assertNull(parseSpiceConnectLanEnvelope(envelope, "other", "android", "session-1"))
        assertNull(parseSpiceConnectLanEnvelope(envelope, "desktop", "android", "session-2"))
        command.put("command", SPICE_CONNECT_LAN_SIGNAL_COMMAND)
        assertNull(parseSpiceConnectLanEnvelope(envelope, "desktop", "android", "session-1"))
    }

    @Test
    fun `state envelopes are bounded and projected from their observation time`() {
        val queue = JSONArray()
        repeat(90) { index ->
            queue.put(
                JSONObject()
                    .put("id", "track-$index")
                    .put("title", "Track $index")
                    .put("artist", "Artist")
                    .put("source", "youtube"),
            )
        }
        val normalized = normalizeSpiceConnectLanState(
            JSONObject()
                .put("deviceId", "desktop")
                .put("displayName", "Desktop")
                .put("queue", queue)
                .put("queueIndex", 89)
                .put("isPlaying", true)
                .put("progress", 10.0)
                .put("duration", 20.0)
                .put("volume", 101)
                .put("updatedAt", "2026-08-02T10:20:30.000Z"),
        )
        assertNotNull(normalized)
        assertEquals(80, normalized?.queue?.size)
        assertEquals(79, normalized?.queueIndex)
        assertEquals(100, normalized?.volume)

        val startedAt = parseSpiceConnectLanTimestamp("2026-08-02T10:20:30.000Z")!!
        val projected = projectSpiceConnectLanState(
            RemoteDevice(
                deviceId = "desktop",
                displayName = "Desktop",
                isPlaying = true,
                progressMs = 10_000,
                durationMs = 20_000,
                updatedAt = "2026-08-02T10:20:30.000Z",
            ),
            nowMs = startedAt + 5_000,
        )
        assertEquals(15_000, projected.progressMs)
        assertEquals("2026-08-02T10:20:35.000Z", projected.updatedAt)
    }
}
