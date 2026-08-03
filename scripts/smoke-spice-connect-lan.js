const { app, BrowserWindow } = require('electron');

const SMOKE_TIMEOUT_MS = 15_000;

async function runSmoke() {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await window.loadURL('data:text/html,<meta charset="utf-8"><title>Spice Connect LAN smoke</title>');

  return window.webContents.executeJavaScript(`
    (async () => {
      const timeout = (message) => new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), ${SMOKE_TIMEOUT_MS});
      });
      const waitForIce = (connection) => {
        if (connection.iceGatheringState === 'complete') return Promise.resolve();
        return new Promise((resolve) => {
          connection.addEventListener('icegatheringstatechange', () => {
            if (connection.iceGatheringState === 'complete') resolve();
          });
        });
      };
      const candidateTypes = (description) => [
        ...description.sdp.matchAll(/ a=candidate:[^\\r\\n]* typ ([a-z]+)/g),
        ...description.sdp.matchAll(/^a=candidate:[^\\r\\n]* typ ([a-z]+)/gm),
      ].map((match) => match[1]);

      const offerer = new RTCPeerConnection({ iceServers: [] });
      const answerer = new RTCPeerConnection({ iceServers: [] });
      const channel = offerer.createDataChannel('spice-connect-lan', {
        ordered: true,
        protocol: 'spice-connect-lan-v1',
      });
      const answerChannelReady = new Promise((resolve) => {
        answerer.addEventListener('datachannel', (event) => {
          resolve(event.channel);
        }, { once: true });
      });
      const opened = new Promise((resolve) => channel.addEventListener('open', resolve, { once: true }));

      await offerer.setLocalDescription(await offerer.createOffer());
      await Promise.race([waitForIce(offerer), timeout('Offer ICE gathering timed out.')]);
      await answerer.setRemoteDescription(offerer.localDescription);
      await answerer.setLocalDescription(await answerer.createAnswer());
      await Promise.race([waitForIce(answerer), timeout('Answer ICE gathering timed out.')]);
      await offerer.setRemoteDescription(answerer.localDescription);
      await Promise.race([opened, timeout('Host-only data channel did not open.')]);
      const answerChannel = await Promise.race([answerChannelReady, timeout('Answer data channel was not received.')]);

      const payload = JSON.stringify({
        version: 1,
        type: 'command',
        command: 'pause',
      });
      const received = new Promise((resolve) => {
        answerChannel.addEventListener('message', (message) => resolve(message.data), { once: true });
      });
      channel.send(payload);
      const delivered = await Promise.race([received, timeout('Direct message delivery timed out.')]);
      const pong = new Promise((resolve) => {
        channel.addEventListener('message', (message) => resolve(message.data), { once: true });
      });
      answerChannel.addEventListener('message', (message) => answerChannel.send(message.data), { once: true });
      const latencyProbe = JSON.stringify({ version: 1, type: 'ping', sentAt: performance.now() });
      const latencyStartedAt = performance.now();
      channel.send(latencyProbe);
      const echoedProbe = await Promise.race([pong, timeout('LAN latency probe timed out.')]);
      const roundTripMs = Math.max(0, performance.now() - latencyStartedAt);
      const types = [
        ...candidateTypes(offerer.localDescription),
        ...candidateTypes(answerer.localDescription),
      ];

      channel.close();
      offerer.close();
      answerer.close();
      if (delivered !== payload) throw new Error('Direct message payload changed in transit.');
      if (echoedProbe !== latencyProbe) throw new Error('LAN latency probe changed in transit.');
      if (types.length === 0 || types.some((type) => type !== 'host')) {
        throw new Error('Expected host-only ICE candidates, received: ' + JSON.stringify(types));
      }
      return { delivered: true, roundTripMs, candidateTypes: types };
    })()
  `, true);
}

app.whenReady()
  .then(runSmoke)
  .then((result) => {
    console.log(`[Spice Connect LAN smoke] ${JSON.stringify(result)}`);
    app.quit();
  })
  .catch((error) => {
    console.error(`[Spice Connect LAN smoke] ${error instanceof Error ? error.stack : error}`);
    process.exitCode = 1;
    app.quit();
  });
