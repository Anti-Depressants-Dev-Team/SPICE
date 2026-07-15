// Lyrics rendering and playback synchronization for the floating lyrics window.

const {
    createLyricsCacheEntry,
    findActiveLine,
    getWordProgress,
    lyricsTrackKey,
    normalizeLyricsOffset,
    parseLrc,
    readLyricsCacheEntry
} = window.LyricsCore;

const SYNC_OFFSET_SECONDS = 0.08;
const LYRICS_CACHE_PREFIX = 'spice_lyrics_cache_v1:';
const LYRICS_OFFSET_PREFIX = 'spice_lyrics_offset_v1:';

let currentTrack = null;
let currentLyrics = [];
let isStaticMode = false;
let activeLineIndex = -1;
let lyricsRequestId = 0;
let karaokeAnimationFrame = null;
let currentLyricsKey = '';
let currentSyncOffset = 0;
let lastPlaybackProgress = {
    currentTime: 0,
    duration: 0,
    paused: true,
    receivedAt: performance.now()
};

const titleEl = document.getElementById('track-title');
const artistEl = document.getElementById('track-artist');
const containerEl = document.getElementById('lyrics-container');
const modeBtn = document.getElementById('mode-btn');
const iconSync = document.getElementById('icon-sync');
const iconStatic = document.getElementById('icon-static');
const providerSelect = document.getElementById('provider-select');
const offsetValueEl = document.getElementById('offset-value');
const cacheStatusEl = document.getElementById('cache-status');

function cacheStorageKey(key) {
    return `${LYRICS_CACHE_PREFIX}${encodeURIComponent(key)}`;
}

function offsetStorageKey(key) {
    return `${LYRICS_OFFSET_PREFIX}${encodeURIComponent(key)}`;
}

function readCachedLyrics(key) {
    try {
        const entry = JSON.parse(localStorage.getItem(cacheStorageKey(key)) || 'null');
        return readLyricsCacheEntry(entry);
    } catch {
        localStorage.removeItem(cacheStorageKey(key));
        return null;
    }
}

function saveCachedLyrics(key, payload) {
    try {
        localStorage.setItem(cacheStorageKey(key), JSON.stringify(createLyricsCacheEntry(payload)));
    } catch {
        // Lyrics continue to work when storage is full or unavailable.
    }
}

function loadLyricsOffset(key) {
    currentSyncOffset = normalizeLyricsOffset(localStorage.getItem(offsetStorageKey(key)) || 0);
    updateOffsetUI();
}

function saveLyricsOffset(value) {
    currentSyncOffset = normalizeLyricsOffset(value);
    if (currentLyricsKey) {
        localStorage.setItem(offsetStorageKey(currentLyricsKey), String(currentSyncOffset));
    }
    updateOffsetUI();
    syncLyrics(getEstimatedPlaybackTime());
}

function updateOffsetUI() {
    const sign = currentSyncOffset > 0 ? '+' : '';
    offsetValueEl.textContent = `Offset ${sign}${currentSyncOffset.toFixed(1)}s`;
}

function applyShellTheme(value) {
    const accents = ['pink', 'blue', 'orange', 'green', 'gold', 'crimson', 'deeppurple'];
    const surfaces = ['midnight', 'glass', 'solid', 'aurora'];
    const theme = value && typeof value === 'object' ? value : {};
    const root = document.documentElement;
    root.dataset.spiceAccent = accents.includes(theme.accent) ? theme.accent : 'deeppurple';
    root.dataset.spiceSurface = surfaces.includes(theme.surface) ? theme.surface : 'midnight';
    const custom = theme.custom;
    ['--accent', '--accent-hover', '--accent-secondary', '--accent-rgb', '--accent-gradient', '--shell-background', '--shell-surface', '--border-glass', '--bg-obsidian', '--card-bg']
        .forEach((property) => root.style.removeProperty(property));
    if (custom && typeof custom === 'object') {
        root.style.setProperty('--accent', custom.primary);
        root.style.setProperty('--accent-hover', custom.highlight);
        root.style.setProperty('--accent-secondary', custom.secondary);
        root.style.setProperty('--accent-rgb', custom.primaryRgb);
        root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${custom.secondary}, ${custom.primary})`);
        root.style.setProperty('--shell-background', custom.background);
        root.style.setProperty('--shell-surface', custom.glass);
        root.style.setProperty('--border-glass', custom.border);
        root.style.setProperty('--bg-obsidian', custom.background);
        root.style.setProperty('--card-bg', custom.surface);
    }
}

function setLyricsMessage(message, className = 'no-lyrics') {
    const messageEl = document.createElement('div');
    messageEl.className = className;
    messageEl.textContent = message;
    containerEl.replaceChildren(messageEl);
}

function resetWordHighlighting(lineEl) {
    if (!lineEl) return;

    lineEl.querySelectorAll('.lyric-word').forEach((wordEl) => {
        wordEl.classList.remove('sung', 'current');
        wordEl.style.setProperty('--word-progress', '0%');
    });
}

function clearActiveLyrics() {
    document.querySelectorAll('.lyric-line.active').forEach((lineEl) => {
        lineEl.classList.remove('active');
        resetWordHighlighting(lineEl);
    });
    activeLineIndex = -1;
}

function stopKaraokeAnimation() {
    if (karaokeAnimationFrame !== null) {
        cancelAnimationFrame(karaokeAnimationFrame);
        karaokeAnimationFrame = null;
    }
}

function getEstimatedPlaybackTime() {
    const elapsedSeconds = lastPlaybackProgress.paused
        ? 0
        : (performance.now() - lastPlaybackProgress.receivedAt) / 1000;
    return lastPlaybackProgress.currentTime + elapsedSeconds;
}

function requestKaraokeAnimation() {
    if (
        karaokeAnimationFrame !== null ||
        isStaticMode ||
        lastPlaybackProgress.paused ||
        currentLyrics.length === 0
    ) {
        return;
    }

    karaokeAnimationFrame = requestAnimationFrame(() => {
        karaokeAnimationFrame = null;
        syncLyrics(getEstimatedPlaybackTime());
        requestKaraokeAnimation();
    });
}

function updatePlaybackProgress(progress) {
    const currentTime = Number(progress && progress.currentTime);
    if (!Number.isFinite(currentTime)) return;

    lastPlaybackProgress = {
        currentTime,
        duration: Number(progress.duration) || lastPlaybackProgress.duration,
        paused: Boolean(progress.paused),
        receivedAt: performance.now()
    };

    if (!isStaticMode) {
        syncLyrics(getEstimatedPlaybackTime());
    }

    if (lastPlaybackProgress.paused) {
        stopKaraokeAnimation();
    } else {
        requestKaraokeAnimation();
    }
}

// Window Controls
document.getElementById('close-btn').addEventListener('click', () => {
    window.close();
});

// Mode Toggle
modeBtn.addEventListener('click', () => {
    // Non-LRCLIB providers only expose plain lyrics.
    if (providerSelect.value !== 'lrclib') return;

    isStaticMode = !isStaticMode;
    updateModeUI();
});

// Provider Change
providerSelect.addEventListener('change', () => {
    console.log('Provider changed to:', providerSelect.value);

    if (providerSelect.value !== 'lrclib') {
        isStaticMode = true;
        updateModeUI();
        modeBtn.style.opacity = '0.3';
        modeBtn.style.pointerEvents = 'none';
        modeBtn.title = 'Sync unavailable for this provider';
    } else {
        isStaticMode = false;
        updateModeUI();
        modeBtn.style.opacity = '1';
        modeBtn.style.pointerEvents = 'auto';
        modeBtn.title = 'Toggle Sync/Static';
    }

    if (currentTrack) {
        updateLyrics(currentTrack);
    }
});

document.getElementById('offset-minus').addEventListener('click', () => saveLyricsOffset(currentSyncOffset - 0.5));
document.getElementById('offset-plus').addEventListener('click', () => saveLyricsOffset(currentSyncOffset + 0.5));
document.getElementById('offset-reset').addEventListener('click', () => saveLyricsOffset(0));
document.getElementById('refresh-lyrics').addEventListener('click', () => {
    if (currentTrack) updateLyrics(currentTrack, true);
});

function updateModeUI() {
    if (isStaticMode) {
        iconSync.style.display = 'none';
        iconStatic.style.display = 'block';
        modeBtn.title = 'Switch to Synced (Animated)';
        containerEl.classList.add('static-mode');
        clearActiveLyrics();
        stopKaraokeAnimation();
    } else {
        iconSync.style.display = 'block';
        iconStatic.style.display = 'none';
        modeBtn.title = 'Switch to Static (Text)';
        containerEl.classList.remove('static-mode');
        syncLyrics(getEstimatedPlaybackTime());
        requestKaraokeAnimation();
    }
}

// Initial load
(async () => {
    setLyricsMessage('Initializing...', 'lyrics-status');

    if (!window.api) {
        setLyricsMessage('Error: API not found', 'lyrics-error');
        return;
    }

    try {
        const settings = await window.api.getSettings?.();
        applyShellTheme(settings && settings.shellTheme);
        const track = await window.api.getNowPlaying();
        if (track) {
            updateLyrics(track);
        } else {
            setLyricsMessage('No track playing yet...', 'lyrics-status');
        }
    } catch (error) {
        setLyricsMessage(`Error getting track: ${error.message}`, 'lyrics-error');
    }
})();

if (window.api && window.api.onShellThemeChanged) {
    window.api.onShellThemeChanged(applyShellTheme);
}

if (window.api && window.api.onLyricsTrackUpdate) {
    window.api.onLyricsTrackUpdate((track) => {
        updateLyrics(track);
    });
}

if (window.api && window.api.onLyricsProgressUpdate) {
    window.api.onLyricsProgressUpdate((progress) => {
        updatePlaybackProgress(progress);
    });
}

async function updateLyrics(track, force = false) {
    if (!track) return;

    const provider = providerSelect.value;
    const nextLyricsKey = lyricsTrackKey(track, provider);
    if (!force && currentLyricsKey === nextLyricsKey) {
        return;
    }

    const requestId = ++lyricsRequestId;
    currentTrack = track;
    currentLyricsKey = nextLyricsKey;
    loadLyricsOffset(nextLyricsKey);
    titleEl.textContent = track.title;
    artistEl.textContent = track.artist;
    setLyricsMessage(`Loading from ${provider}...`);
    currentLyrics = [];
    clearActiveLyrics();
    stopKaraokeAnimation();

    if (!force) {
        const cachedLyrics = readCachedLyrics(nextLyricsKey);
        if (cachedLyrics) {
            cacheStatusEl.textContent = 'Loaded from the on-device cache';
            renderLyricsPayload(cachedLyrics, provider);
            return;
        }
    }

    try {
        if (!window.api || !window.api.fetchLyrics) {
            console.error('fetchLyrics API not available');
            setLyricsMessage('API Error');
            return;
        }

        const lyrics = await window.api.fetchLyrics({
            title: track.title,
            artist: track.artist,
            album: track.album,
            provider
        });

        if (requestId !== lyricsRequestId) return;
        if (lyrics && (lyrics.syncedLyrics || lyrics.plainLyrics)) saveCachedLyrics(nextLyricsKey, lyrics);
        cacheStatusEl.textContent = lyrics && (lyrics.syncedLyrics || lyrics.plainLyrics)
            ? 'Fetched now and cached on this device'
            : 'No lyrics cached for this track';
        renderLyricsPayload(lyrics, provider);
    } catch (error) {
        if (requestId !== lyricsRequestId) return;

        console.error('Error fetching lyrics:', error);
        setLyricsMessage('Error loading lyrics');
    }
}

function renderLyricsPayload(lyrics, provider) {
    if (lyrics && lyrics.syncedLyrics) {
        renderLyrics(lyrics.syncedLyrics);
    } else if (lyrics && lyrics.plainLyrics) {
        renderPlainLyrics(lyrics.plainLyrics);
    } else {
        setLyricsMessage(`No lyrics found on ${provider}`);
    }
}

function renderLyrics(lrcText) {
    currentLyrics = parseLrc(lrcText, {
        duration: Number(currentTrack && currentTrack.duration) || 0
    });
    activeLineIndex = -1;
    containerEl.replaceChildren();

    if (currentLyrics.length === 0) {
        setLyricsMessage('No synced lyrics found');
        return;
    }

    currentLyrics.forEach((line, index) => {
        const lineEl = document.createElement('button');
        lineEl.type = 'button';
        lineEl.className = 'lyric-line';
        lineEl.dataset.index = index;
        lineEl.dataset.time = line.time;
        lineEl.title = 'Jump to this lyric';
        lineEl.setAttribute('aria-label', `Jump to ${formatTimestamp(line.time)}: ${line.text}`);

        line.words.forEach((word) => {
            const wordEl = document.createElement('span');
            wordEl.className = 'lyric-word';
            wordEl.textContent = word.text;
            lineEl.appendChild(wordEl);
        });

        lineEl.addEventListener('click', () => {
            seekToTimestamp(line.time);
        });
        containerEl.appendChild(lineEl);
    });

    syncLyrics(getEstimatedPlaybackTime());
    requestKaraokeAnimation();
}

function renderPlainLyrics(text) {
    currentLyrics = [];
    clearActiveLyrics();
    stopKaraokeAnimation();

    const plainLyricsEl = document.createElement('div');
    plainLyricsEl.className = 'plain-lyrics';
    plainLyricsEl.textContent = text;
    containerEl.replaceChildren(plainLyricsEl);
}

function formatTimestamp(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function seekToTimestamp(time) {
    if (!window.api || !window.api.seekPlayback) return;

    window.api.seekPlayback(time);
    updatePlaybackProgress({
        currentTime: time,
        duration: lastPlaybackProgress.duration,
        paused: lastPlaybackProgress.paused
    });
}

function syncLyrics(time) {
    if (currentLyrics.length === 0 || isStaticMode) return;

    const adjustedTime = Math.max(0, time + SYNC_OFFSET_SECONDS + currentSyncOffset);
    const nextActiveLineIndex = findActiveLine(currentLyrics, adjustedTime);

    if (nextActiveLineIndex === -1) {
        clearActiveLyrics();
        return;
    }

    highlightLine(nextActiveLineIndex);
    highlightWords(nextActiveLineIndex, adjustedTime);
}

function highlightLine(index) {
    if (activeLineIndex === index) return;

    const lines = document.querySelectorAll('.lyric-line');
    const activeLine = lines[index];
    if (!activeLine) return;

    if (activeLineIndex >= 0 && lines[activeLineIndex]) {
        lines[activeLineIndex].classList.remove('active');
        resetWordHighlighting(lines[activeLineIndex]);
    }

    activeLine.classList.add('active');
    activeLineIndex = index;
    activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function highlightWords(lineIndex, time) {
    const line = currentLyrics[lineIndex];
    const lineEl = document.querySelector(`.lyric-line[data-index="${lineIndex}"]`);
    if (!line || !lineEl) return;

    const wordEls = lineEl.querySelectorAll('.lyric-word');
    line.words.forEach((word, index) => {
        const wordEl = wordEls[index];
        if (!wordEl) return;

        const progress = getWordProgress(word, time);
        wordEl.classList.toggle('sung', progress >= 1);
        wordEl.classList.toggle('current', progress > 0 && progress < 1);
        wordEl.style.setProperty('--word-progress', `${progress * 100}%`);
    });
}
