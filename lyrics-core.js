(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.LyricsCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const LINE_TIMESTAMP_PATTERN =
    /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const WORD_TIMESTAMP_PATTERN =
    /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g;
  const DEFAULT_LYRICS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  function timestampToSeconds(minutes, seconds, fraction = "0") {
    const milliseconds = Number(fraction.padEnd(3, "0").slice(0, 3));
    return Number(minutes) * 60 + Number(seconds) + milliseconds / 1000;
  }

  function matchToSeconds(match) {
    return timestampToSeconds(match[1], match[2], match[3]);
  }

  function tokenizeWords(text) {
    return text.match(/\S+\s*/g) || [];
  }

  function inferWordTimings(text, startTime, endTime) {
    const tokens = tokenizeWords(text);
    if (tokens.length === 0) return [];

    const safeEndTime = Math.max(startTime, endTime);
    const weights = tokens.map((token) =>
      Math.max(1, Math.sqrt(token.trim().length)),
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const duration = safeEndTime - startTime;
    let cursor = startTime;

    return tokens.map((token, index) => {
      const isLastWord = index === tokens.length - 1;
      const wordDuration = duration * (weights[index] / totalWeight);
      const wordEndTime = isLastWord ? safeEndTime : cursor + wordDuration;
      const word = {
        text: token,
        startTime: cursor,
        endTime: wordEndTime,
      };

      cursor = wordEndTime;
      return word;
    });
  }

  function stripWordTimestamps(text) {
    return text.replace(WORD_TIMESTAMP_PATTERN, "");
  }

  function parseEnhancedWords(markedText, lineStartTime, lineEndTime) {
    const markers = [];
    WORD_TIMESTAMP_PATTERN.lastIndex = 0;

    let match;
    while ((match = WORD_TIMESTAMP_PATTERN.exec(markedText)) !== null) {
      markers.push({
        time: matchToSeconds(match),
        index: match.index,
        endIndex: WORD_TIMESTAMP_PATTERN.lastIndex,
      });
    }

    if (markers.length === 0) {
      return inferWordTimings(markedText, lineStartTime, lineEndTime);
    }

    const words = [];
    const prefix = markedText.slice(0, markers[0].index);
    if (prefix.trim()) {
      words.push(
        ...inferWordTimings(prefix, lineStartTime, markers[0].time),
      );
    }

    markers.forEach((marker, index) => {
      const nextMarker = markers[index + 1];
      const segmentEndTime = nextMarker ? nextMarker.time : lineEndTime;
      const segmentText = markedText.slice(
        marker.endIndex,
        nextMarker ? nextMarker.index : markedText.length,
      );

      words.push(
        ...inferWordTimings(segmentText, marker.time, segmentEndTime),
      );
    });

    return words;
  }

  function inferLastLineEnd(line, trackDuration) {
    const wordCount = tokenizeWords(line.text).length;
    const estimatedDuration = Math.min(8, Math.max(2, wordCount * 0.55));
    const estimatedEnd = line.time + estimatedDuration;

    if (trackDuration > line.time) {
      return Math.min(trackDuration, estimatedEnd);
    }

    return estimatedEnd;
  }

  function parseLrc(lrcText, options = {}) {
    const trackDuration = Number(options.duration) || 0;
    const lines = [];

    for (const rawLine of String(lrcText || "").split("\n")) {
      LINE_TIMESTAMP_PATTERN.lastIndex = 0;
      const timestamps = [];
      let match;

      while ((match = LINE_TIMESTAMP_PATTERN.exec(rawLine)) !== null) {
        timestamps.push(matchToSeconds(match));
      }

      if (timestamps.length === 0) continue;

      const markedText = rawLine.replace(LINE_TIMESTAMP_PATTERN, "").trim();
      const text = stripWordTimestamps(markedText).trim();
      if (!text) continue;

      timestamps.forEach((time) => {
        lines.push({ time, text, markedText, words: [] });
      });
    }

    lines.sort((a, b) => a.time - b.time);

    lines.forEach((line, index) => {
      const nextLine = lines[index + 1];
      const endTime =
        nextLine && nextLine.time > line.time
          ? nextLine.time
          : inferLastLineEnd(line, trackDuration);

      line.words = parseEnhancedWords(line.markedText, line.time, endTime);
    });

    return lines;
  }

  function findActiveLine(lines, time) {
    let low = 0;
    let high = lines.length - 1;
    let activeIndex = -1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (time >= lines[middle].time) {
        activeIndex = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    return activeIndex;
  }

  function getWordProgress(word, time) {
    if (time <= word.startTime) return 0;
    if (time >= word.endTime) return 1;

    const duration = word.endTime - word.startTime;
    if (duration <= 0) return 1;

    return (time - word.startTime) / duration;
  }

  function normalizeIdentityPart(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase()
      .replace(/\s+/g, " ");
  }

  function lyricsTrackKey(track, provider = "lrclib") {
    const trackId = normalizeIdentityPart(track && track.id);
    const sourceId = normalizeIdentityPart(track && track.sourceId);
    const trackIdentity = trackId
      ? `${sourceId || "unknown"}:${trackId}`
      : [
          track && track.title,
          track && track.artist,
          track && track.album,
        ].map(normalizeIdentityPart).join("|");
    return `${normalizeIdentityPart(provider) || "lrclib"}:${normalizeIdentityPart(trackIdentity)}`;
  }

  function normalizeLyricsOffset(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.round(Math.max(-5, Math.min(5, number)) * 100) / 100;
  }

  function createLyricsCacheEntry(payload, now = Date.now()) {
    return {
      payload: payload && typeof payload === "object" ? payload : {},
      savedAt: Number.isFinite(Number(now)) ? Number(now) : Date.now(),
    };
  }

  function readLyricsCacheEntry(value, now = Date.now(), ttlMs = DEFAULT_LYRICS_CACHE_TTL_MS) {
    if (!value || typeof value !== "object") return null;
    const savedAt = Number(value.savedAt);
    const safeNow = Number(now);
    const safeTtl = Math.max(0, Number(ttlMs) || 0);
    if (!Number.isFinite(savedAt) || !Number.isFinite(safeNow) || savedAt > safeNow + 60000) return null;
    if (safeNow - savedAt > safeTtl) return null;
    return value.payload && typeof value.payload === "object" ? value.payload : null;
  }

  return {
    DEFAULT_LYRICS_CACHE_TTL_MS,
    createLyricsCacheEntry,
    findActiveLine,
    getWordProgress,
    inferWordTimings,
    lyricsTrackKey,
    normalizeLyricsOffset,
    parseLrc,
    readLyricsCacheEntry,
  };
});
