package xyz.spiceapp.mobile.data

import android.content.Context
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import livekit.org.webrtc.DataChannel
import livekit.org.webrtc.IceCandidate
import livekit.org.webrtc.MediaConstraints
import livekit.org.webrtc.MediaStream
import livekit.org.webrtc.PeerConnection
import livekit.org.webrtc.PeerConnectionFactory
import livekit.org.webrtc.RtpReceiver
import livekit.org.webrtc.SdpObserver
import livekit.org.webrtc.SessionDescription
import org.json.JSONObject
import xyz.spiceapp.mobile.model.RemoteCommand
import xyz.spiceapp.mobile.model.RemoteDevice
import java.nio.ByteBuffer
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal class SpiceConnectLanTransport(
    context: Context,
    private val localDeviceId: String,
    private val scope: CoroutineScope,
    private val sendSignal: suspend (targetDeviceId: String, signal: SpiceConnectLanSignal) -> Boolean,
    private val onCommand: suspend (command: RemoteCommand) -> Unit,
    private val onState: (peerDeviceId: String, state: RemoteDevice) -> Unit,
    private val onPeersChanged: (connectedPeerDeviceIds: Set<String>) -> Unit = {},
    private val onDiagnostic: (message: String) -> Unit = {},
    private val now: () -> Long = System::currentTimeMillis,
    private val createSessionId: () -> String = { UUID.randomUUID().toString() },
) {
    private data class PendingRequest(val sessionId: String, val createdAt: Long)

    private data class Peer(
        val peerDeviceId: String,
        val sessionId: String,
        val connection: PeerConnection,
        val iceGatheringComplete: CompletableDeferred<Unit>,
        val createdAt: Long,
        var channel: DataChannel? = null,
        var verified: Boolean = false,
        var lastSeenAt: Long,
    )

    private val normalizedLocalDeviceId = normalizeSpiceConnectLanDeviceId(localDeviceId)
    private val factory = createPeerConnectionFactory(context.applicationContext)
    private val peers = linkedMapOf<String, Peer>()
    private val pendingRequests = mutableMapOf<String, PendingRequest>()
    private val heartbeatJob: Job
    private var latestLocalState: RemoteDevice? = null
    private var disposed = false

    init {
        require(normalizedLocalDeviceId.isNotEmpty()) { "A local Spice Connect device id is required." }
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(SPICE_CONNECT_LAN_HEARTBEAT_INTERVAL_MS)
                heartbeat()
            }
        }
    }

    fun connectedPeerDeviceIds(): Set<String> = peers.values
        .filter(::isPeerReady)
        .mapTo(sortedSetOf()) { it.peerDeviceId }

    suspend fun ensureConnection(peerDeviceIdValue: String) {
        val peerDeviceId = normalizeSpiceConnectLanDeviceId(peerDeviceIdValue)
        if (disposed || peerDeviceId.isEmpty() || peerDeviceId == normalizedLocalDeviceId) return
        val currentTime = now()
        val existing = peers[peerDeviceId]
        if (
            existing != null &&
            (isPeerReady(existing) || currentTime - existing.createdAt < SPICE_CONNECT_LAN_NEGOTIATION_TIMEOUT_MS)
        ) return
        if (existing != null) closePeer(peerDeviceId, existing.sessionId)

        val pending = pendingRequests[peerDeviceId]
        if (pending != null && currentTime - pending.createdAt < SPICE_CONNECT_LAN_NEGOTIATION_TIMEOUT_MS) return
        val sessionId = normalizeSpiceConnectLanSessionId(createSessionId())
        if (sessionId.isEmpty()) return
        if (isSpiceConnectLanOfferer(normalizedLocalDeviceId, peerDeviceId)) {
            createOffer(peerDeviceId, sessionId)
            return
        }

        pendingRequests[peerDeviceId] = PendingRequest(sessionId, currentTime)
        val sent = runCatching {
            sendSignal(
                peerDeviceId,
                SpiceConnectLanSignal(kind = "request", sessionId = sessionId),
            )
        }.getOrElse { error ->
            diagnostic("LAN connection request failed for $peerDeviceId", error)
            false
        }
        if (!sent) pendingRequests.remove(peerDeviceId)
    }

    suspend fun handleSignal(sourceDeviceIdValue: String, rawSignal: String): Boolean {
        val sourceDeviceId = normalizeSpiceConnectLanDeviceId(sourceDeviceIdValue)
        val signal = parseSpiceConnectLanSignal(rawSignal)
        if (
            disposed ||
            sourceDeviceId.isEmpty() ||
            sourceDeviceId == normalizedLocalDeviceId ||
            signal == null
        ) return false

        if (signal.kind == "request") {
            if (!isSpiceConnectLanOfferer(normalizedLocalDeviceId, sourceDeviceId)) return false
            val existing = peers[sourceDeviceId]
            if (existing != null && isPeerReady(existing)) return true
            return createOffer(sourceDeviceId, signal.sessionId)
        }

        if (signal.kind == "offer") {
            if (isSpiceConnectLanOfferer(normalizedLocalDeviceId, sourceDeviceId)) return false
            pendingRequests.remove(sourceDeviceId)
            closePeer(sourceDeviceId)
            val peer = runCatching { createPeer(sourceDeviceId, signal.sessionId, initiator = false) }
                .getOrElse { error ->
                    diagnostic("LAN peer creation failed for $sourceDeviceId", error)
                    return false
                }
            return try {
                peer.connection.setRemoteDescription(
                    SessionDescription(SessionDescription.Type.OFFER, signal.descriptionSdp),
                )
                val answer = peer.connection.createAnswer()
                peer.connection.setLocalDescription(answer)
                waitForIceGathering(peer)
                val localDescription = peer.connection.localDescription
                if (!isCurrentPeer(peer) || localDescription == null) return false
                val sent = sendSignal(
                    sourceDeviceId,
                    SpiceConnectLanSignal(
                        kind = "answer",
                        sessionId = signal.sessionId,
                        descriptionType = "answer",
                        descriptionSdp = localDescription.description,
                    ),
                )
                if (!sent) closePeer(sourceDeviceId, signal.sessionId)
                sent
            } catch (error: Exception) {
                diagnostic("LAN answer failed for $sourceDeviceId", error)
                closePeer(sourceDeviceId, signal.sessionId)
                false
            }
        }

        val peer = peers[sourceDeviceId]
        if (
            peer == null ||
            peer.sessionId != signal.sessionId ||
            peer.connection.remoteDescription != null
        ) return false
        return try {
            peer.connection.setRemoteDescription(
                SessionDescription(SessionDescription.Type.ANSWER, signal.descriptionSdp),
            )
            true
        } catch (error: Exception) {
            diagnostic("LAN offer completion failed for $sourceDeviceId", error)
            closePeer(sourceDeviceId, signal.sessionId)
            false
        }
    }

    fun sendCommand(targetDeviceIdValue: String, command: String, payload: JSONObject = JSONObject()): Boolean {
        val targetDeviceId = normalizeSpiceConnectLanDeviceId(targetDeviceIdValue)
        if (command == SPICE_CONNECT_LAN_SIGNAL_COMMAND || command !in spiceConnectLanTransportCommandNames) return false
        val peer = peers[targetDeviceId]
        if (peer == null || !isPeerReady(peer)) {
            scope.launch { ensureConnection(targetDeviceId) }
            return false
        }
        return sendEnvelope(
            peer,
            JSONObject()
                .put("version", SPICE_CONNECT_LAN_PROTOCOL_VERSION)
                .put("type", "command")
                .put("sessionId", peer.sessionId)
                .put(
                    "command",
                    JSONObject()
                        .put("id", "lan:${peer.sessionId}:${createSessionId()}")
                        .put("sourceDeviceId", normalizedLocalDeviceId)
                        .put("targetDeviceId", targetDeviceId)
                        .put("command", command)
                        .put("payload", JSONObject(payload.toString()))
                        .put("createdAt", spiceConnectLanTimestamp(now())),
                ),
        )
    }

    fun broadcastState(state: RemoteDevice): Int {
        if (normalizeSpiceConnectLanDeviceId(state.deviceId) != normalizedLocalDeviceId) return 0
        latestLocalState = state.copy(updatedAt = spiceConnectLanTimestamp(now()))
        return peers.values.count(::sendState)
    }

    fun disconnect(peerDeviceIdValue: String) {
        val peerDeviceId = normalizeSpiceConnectLanDeviceId(peerDeviceIdValue)
        if (peerDeviceId.isEmpty()) return
        pendingRequests.remove(peerDeviceId)
        closePeer(peerDeviceId)
    }

    fun dispose() {
        if (disposed) return
        disposed = true
        heartbeatJob.cancel()
        peers.values.toList().forEach { closePeer(it.peerDeviceId, it.sessionId) }
        pendingRequests.clear()
        factory.dispose()
    }

    private suspend fun createOffer(peerDeviceId: String, sessionId: String): Boolean {
        pendingRequests.remove(peerDeviceId)
        closePeer(peerDeviceId)
        val peer = runCatching { createPeer(peerDeviceId, sessionId, initiator = true) }
            .getOrElse { error ->
                diagnostic("LAN peer creation failed for $peerDeviceId", error)
                return false
            }
        return try {
            val offer = peer.connection.createOffer()
            peer.connection.setLocalDescription(offer)
            waitForIceGathering(peer)
            val localDescription = peer.connection.localDescription
            if (!isCurrentPeer(peer) || localDescription == null) return false
            val sent = sendSignal(
                peerDeviceId,
                SpiceConnectLanSignal(
                    kind = "offer",
                    sessionId = sessionId,
                    descriptionType = "offer",
                    descriptionSdp = localDescription.description,
                ),
            )
            if (!sent) closePeer(peerDeviceId, sessionId)
            sent
        } catch (error: Exception) {
            diagnostic("LAN offer failed for $peerDeviceId", error)
            closePeer(peerDeviceId, sessionId)
            false
        }
    }

    private fun createPeer(peerDeviceId: String, sessionId: String, initiator: Boolean): Peer {
        if (peerDeviceId !in peers && peers.size >= SPICE_CONNECT_LAN_MAX_PEERS) {
            peers.values.minByOrNull(Peer::createdAt)?.let { oldest ->
                closePeer(oldest.peerDeviceId, oldest.sessionId)
            }
        }
        val iceGatheringComplete = CompletableDeferred<Unit>()
        val observer = object : PeerConnection.Observer {
            override fun onSignalingChange(newState: PeerConnection.SignalingState) = Unit
            override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState) {
                if (newState == PeerConnection.IceConnectionState.FAILED ||
                    newState == PeerConnection.IceConnectionState.CLOSED
                ) {
                    scope.launch { closePeer(peerDeviceId, sessionId) }
                }
            }
            override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
                if (newState == PeerConnection.PeerConnectionState.FAILED ||
                    newState == PeerConnection.PeerConnectionState.CLOSED
                ) {
                    scope.launch { closePeer(peerDeviceId, sessionId) }
                }
            }
            override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
            override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState) {
                if (newState == PeerConnection.IceGatheringState.COMPLETE) {
                    iceGatheringComplete.complete(Unit)
                }
            }
            override fun onIceCandidate(candidate: IceCandidate) = Unit
            override fun onIceCandidatesRemoved(candidates: Array<IceCandidate>) = Unit
            override fun onAddStream(stream: MediaStream) = Unit
            override fun onRemoveStream(stream: MediaStream) = Unit
            override fun onDataChannel(channel: DataChannel) {
                scope.launch {
                    peers[peerDeviceId]
                        ?.takeIf { it.sessionId == sessionId }
                        ?.let { attachChannel(it, channel) }
                        ?: closeChannel(channel)
                }
            }
            override fun onRenegotiationNeeded() = Unit
            override fun onAddTrack(receiver: RtpReceiver, mediaStreams: Array<MediaStream>) = Unit
        }
        val configuration = PeerConnection.RTCConfiguration(emptyList()).apply {
            // This transport is intentionally same-network-only. Never add STUN
            // or TURN here without a separate product and privacy decision.
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }
        val connection = factory.createPeerConnection(configuration, observer)
            ?: error("WebRTC could not create a data-channel peer.")
        val peer = Peer(
            peerDeviceId = peerDeviceId,
            sessionId = sessionId,
            connection = connection,
            iceGatheringComplete = iceGatheringComplete,
            createdAt = now(),
            lastSeenAt = now(),
        )
        peers[peerDeviceId] = peer
        if (initiator) {
            val channel = connection.createDataChannel(
                SPICE_CONNECT_LAN_CHANNEL_LABEL,
                DataChannel.Init().apply {
                    ordered = true
                    protocol = SPICE_CONNECT_LAN_CHANNEL_PROTOCOL
                },
            )
            attachChannel(peer, channel)
        }
        return peer
    }

    private fun attachChannel(peer: Peer, channel: DataChannel) {
        if (!isCurrentPeer(peer) || channel.label() != SPICE_CONNECT_LAN_CHANNEL_LABEL) {
            closeChannel(channel)
            return
        }
        peer.channel?.takeIf { it !== channel }?.let(::closeChannel)
        peer.channel = channel
        channel.registerObserver(object : DataChannel.Observer {
            override fun onBufferedAmountChange(previousAmount: Long) = Unit
            override fun onStateChange() {
                scope.launch { handleChannelStateChange(peer, channel) }
            }
            override fun onMessage(buffer: DataChannel.Buffer) {
                if (buffer.binary || buffer.data.remaining() > SPICE_CONNECT_LAN_MAX_MESSAGE_BYTES) return
                val data = ByteArray(buffer.data.remaining())
                buffer.data.slice().get(data)
                scope.launch { handleChannelMessage(peer, data) }
            }
        })
        if (channel.state() == DataChannel.State.OPEN) handleChannelStateChange(peer, channel)
    }

    private fun handleChannelStateChange(peer: Peer, channel: DataChannel) {
        if (!isCurrentPeer(peer) || peer.channel !== channel) return
        when (channel.state()) {
            DataChannel.State.OPEN -> sendEnvelope(
                peer,
                JSONObject()
                    .put("version", SPICE_CONNECT_LAN_PROTOCOL_VERSION)
                    .put("type", "hello")
                    .put("sessionId", peer.sessionId)
                    .put("deviceId", normalizedLocalDeviceId),
                requireVerified = false,
            )
            DataChannel.State.CLOSING, DataChannel.State.CLOSED -> closePeer(peer.peerDeviceId, peer.sessionId)
            else -> Unit
        }
    }

    private suspend fun handleChannelMessage(peer: Peer, data: ByteArray) {
        if (!isCurrentPeer(peer)) return
        val payload = runCatching { JSONObject(data.toString(Charsets.UTF_8)) }.getOrNull() ?: return
        val envelope = parseSpiceConnectLanEnvelope(
            payload = payload,
            expectedPeerDeviceIdValue = peer.peerDeviceId,
            localDeviceIdValue = normalizedLocalDeviceId,
            expectedSessionId = peer.sessionId,
        ) ?: return
        peer.lastSeenAt = now()
        when (envelope) {
            is SpiceConnectLanEnvelope.Hello -> {
                val changed = !peer.verified
                peer.verified = true
                if (changed) {
                    notifyPeersChanged()
                    sendState(peer)
                }
            }
            is SpiceConnectLanEnvelope.Command -> if (peer.verified) onCommand(envelope.command)
            is SpiceConnectLanEnvelope.State -> if (peer.verified) onState(peer.peerDeviceId, envelope.state)
            is SpiceConnectLanEnvelope.Ping -> if (peer.verified) {
                sendEnvelope(
                    peer,
                    JSONObject()
                        .put("version", SPICE_CONNECT_LAN_PROTOCOL_VERSION)
                        .put("type", "pong")
                        .put("sessionId", peer.sessionId)
                        .put("sentAt", envelope.sentAt),
                )
            }
            is SpiceConnectLanEnvelope.Pong -> Unit
        }
    }

    private fun sendState(peer: Peer): Boolean {
        val state = latestLocalState ?: return false
        if (!isPeerReady(peer)) return false
        return sendEnvelope(
            peer,
            JSONObject()
                .put("version", SPICE_CONNECT_LAN_PROTOCOL_VERSION)
                .put("type", "state")
                .put("sessionId", peer.sessionId)
                .put("state", spiceConnectLanStateJson(state, now())),
        )
    }

    private fun sendEnvelope(peer: Peer, envelope: JSONObject, requireVerified: Boolean = true): Boolean {
        val channel = peer.channel ?: return false
        if (channel.state() != DataChannel.State.OPEN || (requireVerified && !peer.verified)) return false
        return runCatching {
            val serialized = envelope.toString().toByteArray(Charsets.UTF_8)
            if (serialized.size > SPICE_CONNECT_LAN_MAX_MESSAGE_BYTES) return false
            channel.send(DataChannel.Buffer(ByteBuffer.wrap(serialized), false))
        }.getOrElse { error ->
            diagnostic("LAN data-channel send failed for ${peer.peerDeviceId}", error)
            closePeer(peer.peerDeviceId, peer.sessionId)
            false
        }
    }

    private fun heartbeat() {
        val currentTime = now()
        peers.values.toList().forEach { peer ->
            if (currentTime - peer.createdAt >= SPICE_CONNECT_LAN_NEGOTIATION_TIMEOUT_MS && !isPeerReady(peer)) {
                closePeer(peer.peerDeviceId, peer.sessionId)
            } else if (currentTime - peer.lastSeenAt >= SPICE_CONNECT_LAN_PEER_TIMEOUT_MS) {
                closePeer(peer.peerDeviceId, peer.sessionId)
            } else if (isPeerReady(peer)) {
                sendEnvelope(
                    peer,
                    JSONObject()
                        .put("version", SPICE_CONNECT_LAN_PROTOCOL_VERSION)
                        .put("type", "ping")
                        .put("sessionId", peer.sessionId)
                        .put("sentAt", currentTime),
                )
                sendState(peer)
            }
        }
        pendingRequests.entries.removeAll { currentTime - it.value.createdAt >= SPICE_CONNECT_LAN_NEGOTIATION_TIMEOUT_MS }
    }

    private suspend fun waitForIceGathering(peer: Peer) {
        if (peer.connection.iceGatheringState() == PeerConnection.IceGatheringState.COMPLETE) return
        withTimeoutOrNull(3_000L) { peer.iceGatheringComplete.await() }
    }

    private fun isCurrentPeer(peer: Peer): Boolean = !disposed && peers[peer.peerDeviceId] === peer

    private fun isPeerReady(peer: Peer): Boolean =
        peer.verified && peer.channel?.state() == DataChannel.State.OPEN

    private fun closePeer(peerDeviceId: String, expectedSessionId: String? = null) {
        val peer = peers[peerDeviceId] ?: return
        if (expectedSessionId != null && peer.sessionId != expectedSessionId) return
        val wasReady = isPeerReady(peer)
        peers.remove(peerDeviceId)
        peer.channel?.let(::closeChannel)
        runCatching { peer.connection.close() }
        runCatching { peer.connection.dispose() }
        if (wasReady) notifyPeersChanged()
    }

    private fun closeChannel(channel: DataChannel) {
        runCatching { channel.unregisterObserver() }
        runCatching { channel.close() }
        runCatching { channel.dispose() }
    }

    private fun notifyPeersChanged() = onPeersChanged(connectedPeerDeviceIds())

    private fun diagnostic(message: String, error: Throwable? = null) {
        onDiagnostic(if (error?.message.isNullOrBlank()) message else "$message: ${error.message}")
    }

    private suspend fun PeerConnection.createOffer(): SessionDescription = createDescription { observer ->
        createOffer(observer, MediaConstraints())
    }

    private suspend fun PeerConnection.createAnswer(): SessionDescription = createDescription { observer ->
        createAnswer(observer, MediaConstraints())
    }

    private suspend fun createDescription(
        start: (SdpObserver) -> Unit,
    ): SessionDescription = suspendCancellableCoroutine { continuation ->
        start(object : SdpObserver {
            override fun onCreateSuccess(description: SessionDescription) {
                if (continuation.isActive) continuation.resume(description)
            }
            override fun onCreateFailure(message: String) {
                if (continuation.isActive) continuation.resumeWithException(IllegalStateException(message))
            }
            override fun onSetSuccess() = Unit
            override fun onSetFailure(message: String) = Unit
        })
    }

    private suspend fun PeerConnection.setLocalDescription(description: SessionDescription) =
        setDescription { observer -> setLocalDescription(observer, description) }

    private suspend fun PeerConnection.setRemoteDescription(description: SessionDescription) =
        setDescription { observer -> setRemoteDescription(observer, description) }

    private suspend fun setDescription(start: (SdpObserver) -> Unit): Unit =
        suspendCancellableCoroutine { continuation ->
            start(object : SdpObserver {
                override fun onCreateSuccess(description: SessionDescription) = Unit
                override fun onCreateFailure(message: String) = Unit
                override fun onSetSuccess() {
                    if (continuation.isActive) continuation.resume(Unit)
                }
                override fun onSetFailure(message: String) {
                    if (continuation.isActive) continuation.resumeWithException(IllegalStateException(message))
                }
            })
        }

    private companion object {
        private var peerConnectionFactoryInitialized = false

        private fun createPeerConnectionFactory(context: Context): PeerConnectionFactory {
            synchronized(SpiceConnectLanTransport::class.java) {
                if (!peerConnectionFactoryInitialized) {
                    PeerConnectionFactory.initialize(
                        PeerConnectionFactory.InitializationOptions.builder(context)
                            .createInitializationOptions(),
                    )
                    peerConnectionFactoryInitialized = true
                }
            }
            return PeerConnectionFactory.builder().createPeerConnectionFactory()
        }
    }
}

private val spiceConnectLanTransportCommandNames = setOf(
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
