import type { SpiceTrack } from './youtube';

const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';
const LASTFM_SOURCE_ID = 'lastfm';
const LASTFM_TRACK_PREFIX = `${LASTFM_SOURCE_ID}:`;
const DEFAULT_TIMEOUT_MS = 8000;

interface LastFmImage {
  '#text'?: string;
  size?: string;
}

interface LastFmTrack {
  name?: string;
  artist?: string;
  mbid?: string;
  url?: string;
  listeners?: string;
  image?: LastFmImage[] | LastFmImage;
}

interface LastFmSearchResponse {
  results?: {
    trackmatches?: {
      track?: LastFmTrack[] | LastFmTrack;
    };
  };
  error?: number;
  message?: string;
}

export interface LastFmDiscoveryTrack extends SpiceTrack {
  permalinkUrl?: string;
}

export async function searchLastFmTracks(query: string, limit: number) {
  const apiKey = process.env.LASTFM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Set LASTFM_API_KEY to enable Last.fm discovery search.');
  }

  const params = new URLSearchParams({
    method: 'track.search',
    track: query,
    api_key: apiKey,
    format: 'json',
    limit: String(limit),
  });

  const response = await fetch(`${LASTFM_API_URL}?${params.toString()}`, {
    headers: { 'User-Agent': 'SPICE-Music-Player/1.0' },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Last.fm search failed with status ${response.status}.`);
  }

  const data = await response.json() as LastFmSearchResponse;
  if (data.error) {
    throw new Error(data.message || `Last.fm API error ${data.error}.`);
  }

  return normalizeArray(data.results?.trackmatches?.track)
    .filter((track) => track.name && track.artist)
    .map(lastFmTrackToSpiceTrack)
    .slice(0, limit);
}

function lastFmTrackToSpiceTrack(track: LastFmTrack): LastFmDiscoveryTrack {
  const artistName = track.artist || 'Last.fm Artist';
  const trackName = track.name || 'Last.fm Track';

  return {
    sourceId: LASTFM_SOURCE_ID,
    id: `${LASTFM_TRACK_PREFIX}${track.mbid || encodeTrackKey(artistName, trackName)}`,
    title: trackName,
    artists: [{ id: `${LASTFM_SOURCE_ID}:artist:${artistName}`, name: artistName }],
    artworkUrl: bestImage(track.image),
    permalinkUrl: track.url,
  };
}

function normalizeArray<T>(value: T[] | T | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function encodeTrackKey(artist: string, title: string) {
  return Buffer.from(`${artist}\0${title}`).toString('base64url');
}

function bestImage(images: LastFmImage[] | LastFmImage | undefined) {
  return normalizeArray(images)
    .slice()
    .reverse()
    .map((image) => image['#text'])
    .find((url) => !!url);
}
