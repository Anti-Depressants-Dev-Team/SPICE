const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");
const preloadSource = fs.readFileSync(
  path.join(repoRoot, "preload-view.js"),
  "utf8",
);
const mainSource = fs.readFileSync(path.join(repoRoot, "main.js"), "utf8");

function extractFunction(source, name) {
  const signature = `function ${name}(`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${name} must exist`);

  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error(`Could not extract ${name}`);
}

const context = vm.createContext({});
vm.runInContext(
  extractFunction(preloadSource, "normalizeSpiceDesktopAudioPayload"),
  context,
);

function normalize(payload) {
  return JSON.parse(JSON.stringify(
    context.normalizeSpiceDesktopAudioPayload(payload),
  ));
}

test("normalizes revisioned desktop audio commands against the boost ceiling", () => {
  assert.deepEqual(
    normalize({ volume: 310, boostEnabled: false, revision: 8 }),
    { volume: 200, boostEnabled: false, revision: 8 },
  );
  assert.deepEqual(
    normalize({ volume: 310, boostEnabled: true, revision: 9 }),
    { volume: 310, boostEnabled: true, revision: 9 },
  );
  assert.deepEqual(
    normalize({ volume: 70, boostEnabled: false }),
    { volume: 70, boostEnabled: false, revision: null },
  );
  assert.equal(
    context.normalizeSpiceDesktopAudioPayload({ volume: "invalid" }),
    null,
  );
});

test("rejects stale bridge commands and cancels superseded retries", () => {
  assert.match(
    preloadSource,
    /nextPayload\.revision < desktopAudioRevision/,
  );
  assert.match(
    preloadSource,
    /if \(desktopAudioPayload !== nextPayload\) return/,
  );
  assert.match(
    mainSource,
    /nextPayload\.revision === spiceAudioControlRevision/,
  );
  assert.match(
    mainSource,
    /revision: \+\+spiceAudioControlRevision/,
  );
});

test("checks the rendered Boost state before persisting a desktop command", () => {
  const applyStart = preloadSource.indexOf(
    "function applyAudioSettingsPayload(payload)",
  );
  const currentBoostRead = preloadSource.indexOf(
    "const currentBoost = readBoostEnabled();",
    applyStart,
  );
  const storageWrite = preloadSource.indexOf(
    "writeDesktopAudioPayloadToStorage(nextPayload);",
    applyStart,
  );

  assert.ok(applyStart >= 0);
  assert.ok(currentBoostRead > applyStart);
  assert.ok(storageWrite > currentBoostRead);
  assert.match(
    preloadSource,
    /if \(Number\.isFinite\(sliderMaximum\)\) return sliderMaximum > 200/,
  );
});

test("inline lyrics build DOM nodes without a TrustedHTML assignment", () => {
  assert.doesNotMatch(
    mainSource,
    /panel\.innerHTML\s*=\s*['"]<div class=['"]spice-line/,
  );
  assert.match(
    mainSource,
    /currentLine\.className = 'spice-line'[\s\S]*nextLine\.className = 'spice-next'[\s\S]*panel\.append\(currentLine, nextLine\)/,
  );
});
