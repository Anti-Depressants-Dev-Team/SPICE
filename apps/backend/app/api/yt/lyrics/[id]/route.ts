import type { NextRequest } from 'next/server';

import { jsonResponse, optionsResponse } from '@/lib/cors';
import { getTrackDetails, getYouTube } from '@/lib/youtube';

export const runtime = 'nodejs';

export function OPTIONS() {
  return optionsResponse();
}

function cleanTrackTitle(title: string): string {
  return title
    .replace(/\s*(?:\([^)]*(?:official|video|audio|visualizer|lyrics?|remastered)[^)]*\)|\[[^\]]*(?:official|video|audio|visualizer|lyrics?|remastered)[^\]]*\])/gi, '')
    .trim();
}

interface LrcLibTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

interface LyricsPayload {
  trackId: string;
  title: string;
  artist: string;
  durationMs: number;
  plainLyrics: string;
  syncedLyrics: string;
  isSynced: boolean;
}

const lyricsCache = new Map<string, { expiresAt: number; payload: LyricsPayload }>();
const LYRICS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MISSING_LYRICS_CACHE_TTL_MS = 10 * 60 * 1000;

function getCachedLyrics(id: string) {
  const cached = lyricsCache.get(id);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    lyricsCache.delete(id);
    return null;
  }
  return cached.payload;
}

function normalizeMatchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreLyricsMatch(track: LrcLibTrack, title: string, artist: string, durationSec: number) {
  const normalizedTitle = normalizeMatchText(title);
  const normalizedArtist = normalizeMatchText(artist);
  const candidateTitle = normalizeMatchText(track.trackName);
  const candidateArtist = normalizeMatchText(track.artistName);

  let score = 0;
  if (candidateTitle === normalizedTitle) score += 8;
  else if (candidateTitle.includes(normalizedTitle) || normalizedTitle.includes(candidateTitle)) score += 4;

  if (normalizedArtist && candidateArtist === normalizedArtist) score += 6;
  else if (normalizedArtist && (candidateArtist.includes(normalizedArtist) || normalizedArtist.includes(candidateArtist))) score += 3;

  const durationDifference = Math.abs(track.duration - durationSec);
  if (durationDifference <= 3) score += 3;
  else if (durationDifference <= 10) score += 1;

  if (track.syncedLyrics) score += 1;
  return score;
}

function selectLyricsMatch(results: LrcLibTrack[], title: string, artist: string, durationSec: number) {
  return results
    .filter((track) => track.syncedLyrics || track.plainLyrics)
    .map((track) => ({ track, score: scoreLyricsMatch(track, title, artist, durationSec) }))
    .filter(({ score }) => score >= 7)
    .sort((a, b) => b.score - a.score)[0]?.track;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  console.log(`[LYRICS API] Received request for track ID: "${id}"`);
  const cached = getCachedLyrics(id);
  if (cached) {
    console.log(`[LYRICS API] Returning cached ${cached.isSynced ? 'synced' : (cached.plainLyrics ? 'plain' : 'missing')} lyrics response.`);
    return jsonResponse(cached);
  }

  try {
    let title = '';
    let primaryArtist = '';
    let durationMs = 180000;

    try {
      console.log(`[LYRICS API] Fetching lightweight basic info for ID: "${id}"`);
      const yt = await getYouTube();
      const info = await yt.getBasicInfo(id);
      title = info.basic_info.title || '';
      primaryArtist = info.basic_info.author || '';
      durationMs = info.basic_info.duration ? info.basic_info.duration * 1000 : 180000;
      console.log(`[LYRICS API] getBasicInfo resolved: Title="${title}", Artist="${primaryArtist}", DurationMs=${durationMs}`);
    } catch (error) {
      console.log(`[LYRICS API] getBasicInfo failed, trying track details for ID: "${id}".`, error);
      const details = await getTrackDetails(id);
      title = details.track.title;
      primaryArtist = details.track.artists?.[0]?.name || '';
      durationMs = details.track.durationMs || 180000;
    }

    const durationSec = Math.round(durationMs / 1000);
    const cleanedTitle = cleanTrackTitle(title);
    let plainLyrics = '';
    let syncedLyrics = '';

    if (cleanedTitle) {
      const headers = { 'User-Agent': 'SPICE-Music-Player/1.0 (GitHub/razva)' };
      try {
        const queryParams = new URLSearchParams({
          track_name: cleanedTitle,
          artist_name: primaryArtist,
          duration: String(durationSec),
        });
        const getUrl = `https://lrclib.net/api/get?${queryParams.toString()}`;
        console.log(`[LYRICS API] Querying LRCLIB GET: ${getUrl}`);
        const response = await fetch(getUrl, {
          headers,
          signal: AbortSignal.timeout(4000),
        });

        if (response.ok) {
          const data = await response.json() as LrcLibTrack;
          plainLyrics = data.plainLyrics || '';
          syncedLyrics = data.syncedLyrics || '';
        } else {
          console.log(`[LYRICS API] LRCLIB GET failed with status: ${response.status}`);
        }

      } catch (error) {
        console.error('[LYRICS API] LRCLIB direct lookup failed:', error);
      }

      if (!plainLyrics && !syncedLyrics) {
        try {
          const searchParams = new URLSearchParams({
            track_name: cleanedTitle,
            artist_name: primaryArtist,
          });
          const searchUrl = `https://lrclib.net/api/search?${searchParams.toString()}`;
          console.log(`[LYRICS API] Trying ranked search fallback: ${searchUrl}`);
          const searchResponse = await fetch(searchUrl, {
            headers,
            signal: AbortSignal.timeout(4000),
          });

          if (searchResponse.ok) {
            const results = await searchResponse.json() as LrcLibTrack[];
            const match = selectLyricsMatch(results, cleanedTitle, primaryArtist, durationSec);
            console.log(`[LYRICS API] LRCLIB search returned ${results.length} results. Ranked match: ${match?.id ?? 'none'}`);
            plainLyrics = match?.plainLyrics || '';
            syncedLyrics = match?.syncedLyrics || '';
          } else {
            console.log(`[LYRICS API] LRCLIB search failed with status: ${searchResponse.status}`);
          }
        } catch (error) {
          console.error('[LYRICS API] LRCLIB ranked search failed:', error);
        }
      }
    }

    const isSynced = !!syncedLyrics;
    console.log(`[LYRICS API] Returning ${isSynced ? 'synced' : (plainLyrics ? 'plain' : 'missing')} lyrics response.`);
    const payload = {
      trackId: id,
      title,
      artist: primaryArtist,
      durationMs,
      plainLyrics,
      syncedLyrics,
      isSynced,
    };
    lyricsCache.set(id, {
      expiresAt: Date.now() + (plainLyrics || syncedLyrics ? LYRICS_CACHE_TTL_MS : MISSING_LYRICS_CACHE_TTL_MS),
      payload,
    });

    return jsonResponse(payload);
  } catch (error) {
    console.error('[LYRICS API] Fatal route processing error:', error);
    return jsonResponse(
      {
        trackId: id,
        plainLyrics: '',
        syncedLyrics: '',
        isSynced: false,
        error: error instanceof Error ? error.message : 'Could not resolve track details',
      },
      { status: 502 },
    );
  }
}
