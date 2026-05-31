// Lyrics rendering and playback synchronization for the floating lyrics window.

const { findActiveLine, getWordProgress, parseLrc } = window.LyricsCore;

const SYNC_OFFSET_SECONDS = 0.08;

let currentTrack = null;
let currentLyrics = [];
let isStaticMode = false;
let activeLineIndex = -1;
let lyricsRequestId = 0;
let karaokeAnimationFrame = null;
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
        updateLyrics(currentTrack, true);
    }
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
    if (!force && currentTrack && currentTrack.title === track.title && currentTrack.artist === track.artist) {
        return;
    }

    const requestId = ++lyricsRequestId;
    currentTrack = track;
    titleEl.textContent = track.title;
    artistEl.textContent = track.artist;
    setLyricsMessage(`Loading from ${provider}...`);
    currentLyrics = [];
    clearActiveLyrics();
    stopKaraokeAnimation();

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

        if (lyrics && lyrics.syncedLyrics) {
            renderLyrics(lyrics.syncedLyrics);
        } else if (lyrics && lyrics.plainLyrics) {
            renderPlainLyrics(lyrics.plainLyrics);
        } else {
            setLyricsMessage(`No lyrics found on ${provider}`);
        }
    } catch (error) {
        if (requestId !== lyricsRequestId) return;

        console.error('Error fetching lyrics:', error);
        setLyricsMessage('Error loading lyrics');
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

    const adjustedTime = Math.max(0, time + SYNC_OFFSET_SECONDS);
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
