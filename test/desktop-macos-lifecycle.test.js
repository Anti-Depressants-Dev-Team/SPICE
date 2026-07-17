const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const main = fs.readFileSync(path.resolve(__dirname, "..", "main.js"), "utf8");

test("macOS uses hosted classic SPICE instead of a Windows local runtime", () => {
  assert.match(
    main,
    /const SPICE_LOCAL_RUNTIME_PLATFORM = resolveLocalRuntimePlatform\(process\.platform\)/,
  );
  assert.match(main, /function bundledNativeRuntimeDir\(\) \{\s*if \(!SPICE_LOCAL_RUNTIME_PLATFORM\) return null;/);
  assert.match(main, /if \(!SPICE_LOCAL_RUNTIME_PLATFORM\) return SPICE_REMOTE_MUSIC_URL;/);
  assert.match(main, /const SPICE_LOCAL_MANIFEST_URL = SPICE_LOCAL_RUNTIME_PLATFORM[\s\S]*?: null;/);
});

test("macOS closes and recreates the shell without tearing down playback services", () => {
  const closeHandlerStart = main.indexOf('windowInstance.on("closed"');
  const closeHandlerEnd = main.indexOf("// Mini Player Logic", closeHandlerStart);
  assert.ok(closeHandlerStart >= 0 && closeHandlerEnd > closeHandlerStart);

  const closeHandler = main.slice(closeHandlerStart, closeHandlerEnd);
  assert.doesNotMatch(closeHandler, /app\.quit\(\)/);
  assert.doesNotMatch(closeHandler, /spiceRuntimeManager\.stop\(\)/);
  assert.doesNotMatch(closeHandler, /discordRpc\.disconnect\(\)/);

  assert.match(main, /process\.platform === "darwin"[\s\S]*?windowInstance\.setBrowserView\(null\)/);
  assert.match(main, /if \(view && currentService\) \{[\s\S]*?windowInstance\.setBrowserView\(view\)/);
  assert.match(main, /app\.on\("activate", \(\) => \{\s*if \(!mainWindow \|\| mainWindow\.isDestroyed\(\)\)/);
});

test("explicit desktop quit performs one shared asynchronous cleanup", () => {
  assert.match(main, /if \(appQuitCleanupPromise\) return appQuitCleanupPromise;/);
  assert.match(main, /app\.on\("before-quit", \(event\) =>/);
  assert.match(main, /await spiceRuntimeManager\.stop\(\)/);
  assert.match(main, /discordRpc\.disconnect\(\)/);
  assert.match(main, /await cleanupDesktopProcessForQuit\(\)/);
});

test("settings restarts clean up managed playback before the process exits", () => {
  assert.match(main, /async function restartDesktopApp\(\)[\s\S]*?app\.relaunch\(\);[\s\S]*?await cleanupDesktopProcessForQuit\(\);[\s\S]*?app\.exit\(0\);/);
  assert.equal([...main.matchAll(/app\.exit\(/g)].length, 1);
  assert.equal([...main.matchAll(/void restartDesktopApp\(\)/g)].length, 3);
});
