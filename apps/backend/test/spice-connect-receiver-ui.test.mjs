import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSourceUrl = new URL('../app/spice-app.tsx', import.meta.url);
const cssSourceUrl = new URL('../app/globals.css', import.meta.url);

test('remembered receiver removal is optimistic and rejects stale list refreshes', async () => {
  const source = await readFile(appSourceUrl, 'utf8');
  const forgetStart = source.indexOf('const forgetSpiceConnectDevice = async');
  const forgetEnd = source.indexOf('const renderSpiceConnectReceiverOption', forgetStart);
  const forgetSource = source.slice(forgetStart, forgetEnd);

  assert.ok(forgetStart >= 0);
  assert.ok(forgetSource.indexOf('setRemoteDevices((devices) => devices.filter') < forgetSource.indexOf('await spiceFetch'));
  assert.match(source, /listRevision !== remoteDeviceListRevisionRef\.current/);
  assert.match(source, /forgettingRemoteDeviceIdsRef\.current\.has\(device\.deviceId\)/);
  assert.match(forgetSource, /setRemoteDevices\(\(devices\) => \(\s*devices\.some/s);
});

test('receiver forget action uses a dedicated compact control', async () => {
  const [source, css] = await Promise.all([
    readFile(appSourceUrl, 'utf8'),
    readFile(cssSourceUrl, 'utf8'),
  ]);

  assert.match(source, /className="spice-connect-receiver__forget"/);
  assert.match(source, /disabled=\{forgettingRemoteDeviceIds\.has\(value\)\}/);
  assert.match(css, /\.spice-connect-receiver__forget \{[\s\S]*?width: 32px;[\s\S]*?height: 32px;[\s\S]*?border-radius: 50%;/);
});
