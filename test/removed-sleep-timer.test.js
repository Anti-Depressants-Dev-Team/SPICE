const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

test("Sleep Timer is absent from active desktop, SPICE player, and Android surfaces", () => {
  const activeFiles = [
    "main.js",
    "preload.js",
    "settings.html",
    "package.json",
    "apps/backend/app/spice-app.tsx",
    "apps/backend/app/globals.css",
    "apps/mobile/android/app/src/main/java/xyz/spiceapp/mobile/MainActivity.kt",
    "apps/mobile/android/app/src/main/java/xyz/spiceapp/mobile/SpiceViewModel.kt",
    "apps/mobile/android/app/src/main/java/xyz/spiceapp/mobile/ui/SpiceApp.kt",
  ];

  for (const relativePath of activeFiles) {
    const contents = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    assert.doesNotMatch(
      contents,
      /sleep(?:[-_\s]+)timer/i,
      `${relativePath} still contains active Sleep Timer code or UI`,
    );
  }

  for (const removedPath of [
    "desktop-sleep-timer.js",
    "test/desktop-sleep-timer.test.js",
    "apps/backend/app/sleep-timer.ts",
    "apps/backend/test/sleep-timer.test.mjs",
    "apps/mobile/android/app/src/main/java/xyz/spiceapp/mobile/MobileSleepTimer.kt",
    "apps/mobile/android/app/src/test/java/xyz/spiceapp/mobile/MobileSleepTimerTest.kt",
  ]) {
    assert.equal(fs.existsSync(path.join(repoRoot, removedPath)), false, removedPath);
  }
});
