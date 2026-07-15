const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createLyricsCacheEntry,
  findActiveLine,
  getWordProgress,
  inferWordTimings,
  lyricsTrackKey,
  normalizeLyricsOffset,
  parseLrc,
  readLyricsCacheEntry,
} = require("../lyrics-core");

test("parseLrc parses, sorts, and interpolates standard line-timed lyrics", () => {
  const lines = parseLrc(`
[00:05.00]Second line
[ar:Artist]
[00:01.50]First lyric line
`);

  assert.equal(lines.length, 2);
  assert.equal(lines[0].time, 1.5);
  assert.equal(lines[0].text, "First lyric line");
  assert.equal(lines[0].words.length, 3);
  assert.equal(lines[0].words[0].startTime, 1.5);
  assert.equal(lines[0].words.at(-1).endTime, 5);
  assert.equal(lines[1].text, "Second line");
});

test("parseLrc preserves enhanced LRC word timestamps when available", () => {
  const lines = parseLrc(
    "[00:10.00]<00:10.00>Hello <00:10.50>world\n[00:12.00]Again",
  );

  assert.equal(lines[0].words.length, 2);
  assert.deepEqual(
    lines[0].words.map((word) => [word.text, word.startTime, word.endTime]),
    [
      ["Hello ", 10, 10.5],
      ["world", 10.5, 12],
    ],
  );
});

test("parseLrc supports repeated line timestamps and hundredths", () => {
  const lines = parseLrc("[00:01.25][00:03.250]Echo");

  assert.deepEqual(
    lines.map((line) => line.time),
    [1.25, 3.25],
  );
});

test("findActiveLine returns the latest started line", () => {
  const lines = parseLrc("[00:01.00]One\n[00:02.00]Two\n[00:03.00]Three");

  assert.equal(findActiveLine(lines, 0.5), -1);
  assert.equal(findActiveLine(lines, 1), 0);
  assert.equal(findActiveLine(lines, 2.8), 1);
  assert.equal(findActiveLine(lines, 30), 2);
});

test("getWordProgress clamps partial highlighting between zero and one", () => {
  const [word] = inferWordTimings("Hello", 4, 6);

  assert.equal(getWordProgress(word, 3), 0);
  assert.equal(getWordProgress(word, 5), 0.5);
  assert.equal(getWordProgress(word, 7), 1);
});

test("lyrics cache keys isolate providers and normalize track metadata", () => {
  const track = { title: "  Hello ", artist: "The  Artist", album: "One" };
  assert.equal(lyricsTrackKey(track, "LRCLIB"), "lrclib:hello|the artist|one");
  assert.notEqual(lyricsTrackKey(track, "lrclib"), lyricsTrackKey(track, "genius"));
  assert.notEqual(
    lyricsTrackKey({ id: "one", sourceId: "youtube_music" }),
    lyricsTrackKey({ id: "two", sourceId: "youtube_music" }),
  );
});

test("lyrics cache entries expire and timing offsets stay bounded", () => {
  const entry = createLyricsCacheEntry({ syncedLyrics: "[00:01]Hi" }, 1000);
  assert.deepEqual(readLyricsCacheEntry(entry, 1500, 1000), entry.payload);
  assert.equal(readLyricsCacheEntry(entry, 2501, 1000), null);
  assert.equal(normalizeLyricsOffset(8), 5);
  assert.equal(normalizeLyricsOffset(-8), -5);
  assert.equal(normalizeLyricsOffset(0.333), 0.33);
});
