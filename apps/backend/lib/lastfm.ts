import { createHash } from 'crypto';

const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';
const DEFAULT_TIMEOUT_MS = 8000;

export interface ProfileListenTrack {
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  sourceId?: string;
  id?: string;
  permalinkUrl?: string;
}

interface LastFmSubmitInput {
  sessionKey: string;
  track: ProfileListenTrack;
  timestamp?: number;
}

interface LastFmApiResponse {
  error?: number;
  message?: string;
}

export async function submitLastFmNowPlaying(input: LastFmSubmitInput) {
  return postLastFm({
    method: 'track.updateNowPlaying',
    sessionKey: input.sessionKey,
    track: input.track,
  });
}

export async function submitLastFmScrobble(input: LastFmSubmitInput) {
  if (!input.timestamp) {
    throw new Error('Last.fm scrobble requires a playback start timestamp.');
  }

  return postLastFm({
    method: 'track.scrobble',
    sessionKey: input.sessionKey,
    track: input.track,
    extraParams: {
      timestamp: String(input.timestamp),
    },
  });
}

async function postLastFm({
  method,
  sessionKey,
  track,
  extraParams = {},
}: {
  method: 'track.updateNowPlaying' | 'track.scrobble';
  sessionKey: string;
  track: ProfileListenTrack;
  extraParams?: Record<string, string>;
}) {
  const apiKey = process.env.LASTFM_API_KEY?.trim();
  const sharedSecret = process.env.LASTFM_SHARED_SECRET?.trim() || process.env.LASTFM_API_SECRET?.trim();
  if (!apiKey || !sharedSecret) {
    throw new Error('Set LASTFM_API_KEY and LASTFM_SHARED_SECRET to enable Last.fm profile updates.');
  }

  const params: Record<string, string> = {
    method,
    artist: track.artist,
    track: track.title,
    api_key: apiKey,
    sk: sessionKey,
    format: 'json',
    ...extraParams,
  };

  if (track.album) {
    params.album = track.album;
  }
  if (track.durationMs) {
    params.duration = String(Math.max(1, Math.round(track.durationMs / 1000)));
  }

  params.api_sig = signLastFmParams(params, sharedSecret);

  const response = await fetch(LASTFM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'SPICE-Music-Player/1.0',
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const data = await response.json().catch(() => ({})) as LastFmApiResponse;

  if (!response.ok || data.error) {
    throw new Error(data.message || `Last.fm profile update failed with status ${response.status}.`);
  }

  return data;
}

function signLastFmParams(params: Record<string, string>, sharedSecret: string) {
  const signatureBase = Object.entries(params)
    .filter(([key]) => key !== 'format' && key !== 'callback' && key !== 'api_sig')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}${value}`)
    .join('');

  return createHash('md5')
    .update(`${signatureBase}${sharedSecret}`, 'utf8')
    .digest('hex');
}
