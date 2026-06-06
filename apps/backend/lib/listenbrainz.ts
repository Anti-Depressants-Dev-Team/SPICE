import type { SpiceTrack } from './youtube';

const LISTENBRAINZ_RECORDING_SEARCH_URL = 'https://labs.api.listenbrainz.org/recording-search/json';
const LISTENBRAINZ_SOURCE_ID = 'listenbrainz';
const LISTENBRAINZ_TRACK_PREFIX = `${LISTENBRAINZ_SOURCE_ID}:`;
const DEFAULT_TIMEOUT_MS = 8000;

interface ListenBrainzRecordingSearchItem {
  recording_name?: string;
  recording_mbid?: string;
  release_name?: string;
  release_mbid?: string;
  artist_credit_name?: string;
  artist_credit_id?: number | string;
}

interface ListenBrainzRecordingSearchResponse {
  value?: ListenBrainzRecordingSearchItem[];
  Count?: number;
}

export interface ListenBrainzDiscoveryTrack extends SpiceTrack {
  permalinkUrl?: string;
}

export async function searchListenBrainzRecordings(query: string, limit: number) {
  const params = new URLSearchParams({
    query,
  });

  const response = await fetch(`${LISTENBRAINZ_RECORDING_SEARCH_URL}?${params.toString()}`, {
    headers: { 'User-Agent': 'SPICE-Music-Player/1.0 ( https://github.com/razva )' },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`ListenBrainz metadata search failed with status ${response.status}.`);
  }

  const data = await response.json() as ListenBrainzRecordingSearchResponse | ListenBrainzRecordingSearchItem[];
  const recordings = Array.isArray(data) ? data : data.value ?? [];

  return recordings
    .filter((recording) => recording.recording_mbid && recording.recording_name)
    .map(recordingSearchItemToSpiceTrack)
    .slice(0, limit);
}

function recordingSearchItemToSpiceTrack(recording: ListenBrainzRecordingSearchItem): ListenBrainzDiscoveryTrack {
  const recordingId = recording.recording_mbid || 'unknown-recording';
  const artistName = recording.artist_credit_name || 'Unknown Artist';
  return {
    sourceId: LISTENBRAINZ_SOURCE_ID,
    id: `${LISTENBRAINZ_TRACK_PREFIX}${recordingId}`,
    title: recording.recording_name || 'ListenBrainz Recording',
    artists: [{
      id: `${LISTENBRAINZ_SOURCE_ID}:artist:${recording.artist_credit_id || artistName}`,
      name: artistName,
    }],
    album: recording.release_name
      ? {
          id: recording.release_mbid || `${recordingId}:release`,
          title: recording.release_name,
          artists: [{
            id: `${LISTENBRAINZ_SOURCE_ID}:artist:${recording.artist_credit_id || artistName}`,
            name: artistName,
          }],
        }
      : undefined,
    permalinkUrl: `https://musicbrainz.org/recording/${recordingId}`,
  };
}
