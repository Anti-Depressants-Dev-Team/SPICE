const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("desktop seeks use the active SPICE player and cancel prepared crossfades", () => {
  const main = read("main.js");
  const spiceApp = read("apps/backend/app/spice-app.tsx");

  assert.match(main, /typeof window\.__spiceSeekPlayback === 'function'/);
  assert.match(main, /document\.querySelector\('\[data-spice-active="true"\]'/);
  assert.match(spiceApp, /const seekToPosition = \(seekTime: number\) => \{\s*cancelPreparedCrossfade\(\)/);
  assert.equal((spiceApp.match(/seekToPosition\(line\.time\)/g) || []).length, 2);
});

test("desktop playback ignores stale media events and stops at exhausted boundaries", () => {
  const spiceApp = read("apps/backend/app/spice-app.tsx");

  assert.match(spiceApp, /endedVideoId !== currentTrackRef\.current\.id/);
  assert.match(spiceApp, /onEnded=\{\(event\) => handleAudioEnded\(slot, event\.currentTarget\)\}/);
  assert.match(spiceApp, /audio\.dataset\.spiceTrackKey !== activeTrackKey/);
  assert.match(spiceApp, /const stopPlaybackAtQueueBoundary = \(\) => \{[\s\S]*audioRef\.current\?\.pause\(\)/);
  assert.match(
    spiceApp,
    /preparedCrossfadeRef\.current\?\.started[\s\S]*state\.phase !== 'fading'[\s\S]*cancelPreparedCrossfade\(\)/,
  );
});
