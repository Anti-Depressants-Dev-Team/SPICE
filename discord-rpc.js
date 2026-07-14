/**
 * Discord Rich Presence for SPICE.
 *
 * The player is sampled several times per second, but Discord only permits five
 * activity updates per 20 seconds. Presence timestamps advance on Discord's
 * side, so continuous playback needs one anchored update—not a stream of ticks.
 */

const { Client } = require('@xhayper/discord-rpc');

const CLIENT_ID = '1464831676877111489';
const DOWNLOAD_SPICE_URL = 'https://install.spice-app.xyz/';
const MIN_ACTIVITY_UPDATE_INTERVAL_MS = 4_100;
const SEEK_DRIFT_SECONDS = 3;

let client = null;
let isReady = false;
let currentTrack = null;
let reconnectTimeout = null;
let pendingActivityTimeout = null;
let pendingTrack = null;
let lastSentTrack = null;
let lastActivityAt = 0;
let isEnabled = false;

async function connect() {
    isEnabled = true;
    if (client && isReady) return;

    cancelPendingActivity();
    if (client) {
        try {
            await client.destroy();
        } catch { }
        client = null;
        isReady = false;
    }

    try {
        console.log('[Discord RPC] Connecting...');
        client = new Client({ clientId: CLIENT_ID });

        client.on('ready', () => {
            console.log('[Discord RPC] Connected as:', client.user?.username);
            isReady = true;
            lastSentTrack = null;
            lastActivityAt = 0;

            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }

            if (currentTrack) void setActivity(currentTrack, { force: true });
        });

        client.on('disconnected', () => {
            console.log('[Discord RPC] Disconnected');
            isReady = false;
            cancelPendingActivity();
            scheduleReconnect(15_000);
        });

        await client.login();
        console.log('[Discord RPC] Login successful');
    } catch (error) {
        console.error('[Discord RPC] Error:', error.message);
        isReady = false;
        client = null;
        scheduleReconnect(30_000);
    }
}

function scheduleReconnect(delay) {
    if (!isEnabled || reconnectTimeout) return;

    console.log(`[Discord RPC] Retry in ${delay / 1000}s...`);
    reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        if (isEnabled) void connect();
    }, delay);
}

function cancelPendingActivity() {
    if (pendingActivityTimeout) {
        clearTimeout(pendingActivityTimeout);
        pendingActivityTimeout = null;
    }
    pendingTrack = null;
}

function cleanText(value, fallback) {
    const text = typeof value === 'string' ? value.trim() : '';
    return (text || fallback).substring(0, 128);
}

function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function publicHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
    } catch {
        return '';
    }
}

function spiceListenUrl(track) {
    const url = publicHttpUrl(track.listenUrl || track.url);
    return /^https:\/\/music\.spice-app\.xyz\/\?song=/u.test(url) ? url : '';
}

function serviceLabel(service) {
    if (service === 'yt') return 'YouTube Music';
    if (service === 'sc') return 'SoundCloud';
    if (service === 'spice_crazy') return 'SPICE Music';
    return 'SPICE';
}

function presenceTrackKey(track) {
    return [
        track.service || '',
        track.id || '',
        track.track || track.title || '',
        track.artist || '',
    ].join('|');
}

function snapshotTrack(track, observedAt) {
    return {
        key: presenceTrackKey(track),
        title: cleanText(track.track || track.title, 'Unknown Track'),
        artist: cleanText(track.artist, 'Unknown Artist'),
        album: cleanText(track.album, ''),
        albumArt: publicHttpUrl(track.albumArt || track.artwork),
        listenUrl: spiceListenUrl(track),
        service: track.service || '',
        paused: track.paused === true,
        currentTime: Math.max(0, finiteNumber(track.currentTime)),
        duration: Math.max(0, finiteNumber(track.duration)),
        observedAt,
    };
}

function shouldRefreshPresence(previous, nextTrack, now = Date.now()) {
    if (!previous) return true;
    const next = snapshotTrack(nextTrack, now);

    if (
        previous.key !== next.key
        || previous.title !== next.title
        || previous.artist !== next.artist
        || previous.album !== next.album
        || previous.albumArt !== next.albumArt
        || previous.listenUrl !== next.listenUrl
        || previous.service !== next.service
        || previous.paused !== next.paused
        || Math.abs(previous.duration - next.duration) > 0.5
    ) {
        return true;
    }

    const elapsedSeconds = Math.max(0, now - previous.observedAt) / 1000;
    const expectedTime = previous.paused
        ? previous.currentTime
        : previous.currentTime + elapsedSeconds;
    return Math.abs(next.currentTime - expectedTime) > SEEK_DRIFT_SECONDS;
}

function buildActivity(track, now = Date.now()) {
    const serviceName = serviceLabel(track.service);
    const title = cleanText(track.track || track.title, 'Unknown Track');
    const artist = cleanText(track.artist, 'Unknown Artist');
    const listenUrl = spiceListenUrl(track);
    const artworkUrl = publicHttpUrl(track.albumArt || track.artwork);
    const primaryUrl = listenUrl || DOWNLOAD_SPICE_URL;

    const activity = {
        type: 2,
        details: title,
        state: `by ${artist}`.substring(0, 128),
        largeImageKey: artworkUrl || 'spice',
        largeImageText: cleanText(track.album, `Listening on ${serviceName}`),
        largeImageUrl: primaryUrl,
        smallImageKey: 'spice',
        smallImageText: track.paused ? 'Paused in SPICE' : serviceName,
        buttons: [{
            label: listenUrl ? 'Listen on SPICE' : 'Download SPICE',
            url: primaryUrl,
        }],
        instance: false,
    };

    const duration = Math.max(0, finiteNumber(track.duration));
    const currentTime = Math.min(duration || Number.POSITIVE_INFINITY, Math.max(0, finiteNumber(track.currentTime)));
    if (!track.paused && duration > 0) {
        const startTimestamp = now - currentTime * 1000;
        activity.startTimestamp = Math.floor(startTimestamp);
        activity.endTimestamp = Math.floor(startTimestamp + duration * 1000);
    }

    return activity;
}

async function sendActivity(track) {
    pendingActivityTimeout = null;
    pendingTrack = null;
    if (!client || !isReady || !track) return false;

    const sentAt = Date.now();
    lastActivityAt = sentAt;
    const sentSnapshot = snapshotTrack(track, sentAt);
    lastSentTrack = sentSnapshot;
    try {
        await client.user?.setActivity(buildActivity(track, sentAt));
        return true;
    } catch (error) {
        if (lastSentTrack === sentSnapshot) lastSentTrack = null;
        console.error('[Discord RPC] Activity error:', error.message);
        if (error.message?.includes('Not connected')) {
            isReady = false;
            scheduleReconnect(5_000);
        }
        return false;
    }
}

async function setActivity(track, { force = false } = {}) {
    currentTrack = track;
    if (!client || !isReady || !track) return false;

    const now = Date.now();
    if (!force && !shouldRefreshPresence(lastSentTrack, track, now)) return false;

    pendingTrack = track;
    const delay = force ? 0 : Math.max(0, MIN_ACTIVITY_UPDATE_INTERVAL_MS - (now - lastActivityAt));
    if (delay === 0) {
        cancelPendingActivity();
        return sendActivity(track);
    }

    if (!pendingActivityTimeout) {
        pendingActivityTimeout = setTimeout(() => {
            const latestTrack = pendingTrack;
            void sendActivity(latestTrack);
        }, delay);
    }
    return false;
}

function updatePresence(track) {
    return setActivity(track);
}

async function clearPresence() {
    currentTrack = null;
    lastSentTrack = null;
    lastActivityAt = 0;
    cancelPendingActivity();
    if (client && isReady) {
        try {
            await client.user?.clearActivity();
        } catch { }
    }
}

async function disconnect() {
    isEnabled = false;
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    cancelPendingActivity();
    currentTrack = null;
    lastSentTrack = null;
    lastActivityAt = 0;
    isReady = false;
    if (client) {
        try {
            await client.destroy();
        } catch { }
        client = null;
    }
}

module.exports = {
    connect,
    disconnect,
    updatePresence,
    setActivity,
    clearPresence,
    buildActivity,
    shouldRefreshPresence,
    snapshotTrack,
};
