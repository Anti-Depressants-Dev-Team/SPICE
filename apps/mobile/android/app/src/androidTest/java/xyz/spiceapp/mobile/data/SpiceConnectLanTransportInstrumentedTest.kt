package xyz.spiceapp.mobile.data

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import xyz.spiceapp.mobile.model.RemoteCommand
import xyz.spiceapp.mobile.model.RemoteDevice

@RunWith(AndroidJUnit4::class)
class SpiceConnectLanTransportInstrumentedTest {
    @Test
    fun verifiedHostOnlyPeersExchangeStateAndCommands() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        val receivedCommand = CompletableDeferred<RemoteCommand>()
        val receivedState = CompletableDeferred<RemoteDevice>()
        lateinit var first: SpiceConnectLanTransport
        lateinit var second: SpiceConnectLanTransport

        first = SpiceConnectLanTransport(
            context = context,
            localDeviceId = "android-a",
            scope = scope,
            sendSignal = { _, signal ->
                scope.launch { second.handleSignal("android-a", signal.toJson().toString()) }
                true
            },
            onCommand = {},
            onState = { _, state -> receivedState.complete(state) },
        )
        second = SpiceConnectLanTransport(
            context = context,
            localDeviceId = "android-b",
            scope = scope,
            sendSignal = { _, signal ->
                scope.launch { first.handleSignal("android-b", signal.toJson().toString()) }
                true
            },
            onCommand = { command -> receivedCommand.complete(command) },
            onState = { _, _ -> },
        )

        try {
            second.broadcastState(
                RemoteDevice(
                    deviceId = "android-b",
                    displayName = "Android receiver",
                    isPlaying = true,
                    progressMs = 2_000,
                    durationMs = 60_000,
                    updatedAt = spiceConnectLanTimestamp(),
                ),
            )
            first.ensureConnection("android-b")
            withTimeout(15_000) {
                while ("android-b" !in first.connectedPeerDeviceIds()) delay(50)
            }
            assertTrue(
                first.sendCommand(
                    targetDeviceIdValue = "android-b",
                    command = "volume",
                    payload = JSONObject().put("volume", 37),
                ),
            )

            assertEquals(37, withTimeout(5_000) { receivedCommand.await() }.volume)
            assertEquals("android-b", withTimeout(5_000) { receivedState.await() }.deviceId)
        } finally {
            first.dispose()
            second.dispose()
            scope.cancel()
        }
    }
}
