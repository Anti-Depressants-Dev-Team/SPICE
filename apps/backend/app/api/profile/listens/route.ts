import type { NextRequest } from 'next/server';

import { jsonResponse, optionsResponse } from '@/lib/cors';
import { submitLastFmNowPlaying, submitLastFmScrobble, type ProfileListenTrack } from '@/lib/lastfm';
import { submitListenBrainzNowPlaying, submitListenBrainzScrobble } from '@/lib/listenbrainz';

export const runtime = 'nodejs';

type ListenSubmissionType = 'playing_now' | 'scrobble';

interface ProfileListenRequest {
  type?: ListenSubmissionType;
  providers?: {
    lastfm?: {
      sessionKey?: string;
      apiKey?: string;
      sharedSecret?: string;
    };
    listenbrainz?: {
      token?: string;
    };
  };
  track?: Partial<ProfileListenTrack>;
  listenedAt?: number;
}

interface ProviderResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  let body: ProfileListenRequest;
  try {
    body = await request.json() as ProfileListenRequest;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 });
  }

  if (body.type !== 'playing_now' && body.type !== 'scrobble') {
    return jsonResponse({ error: 'invalid_listen_type' }, { status: 400 });
  }

  if (!body.track?.title || !body.track.artist) {
    return jsonResponse({ error: 'invalid_track' }, { status: 400 });
  }

  const listenedAt = Number.isFinite(body.listenedAt)
    ? Math.trunc(body.listenedAt as number)
    : Math.floor(Date.now() / 1000);
  const track: ProfileListenTrack = {
    title: body.track.title,
    artist: body.track.artist,
    album: body.track.album,
    durationMs: body.track.durationMs,
    sourceId: body.track.sourceId,
    id: body.track.id,
    permalinkUrl: body.track.permalinkUrl,
  };
  const results: Record<'lastfm' | 'listenbrainz', ProviderResult> = {
    lastfm: { ok: false, skipped: true },
    listenbrainz: { ok: false, skipped: true },
  };
  const tasks: Promise<void>[] = [];

  const lastFmSessionKey = body.providers?.lastfm?.sessionKey?.trim();
  if (lastFmSessionKey) {
    const credentials = {
      apiKey: body.providers?.lastfm?.apiKey,
      sharedSecret: body.providers?.lastfm?.sharedSecret,
    };
    tasks.push((async () => {
      try {
        if (body.type === 'playing_now') {
          await submitLastFmNowPlaying({ sessionKey: lastFmSessionKey, track, credentials });
        } else {
          await submitLastFmScrobble({ sessionKey: lastFmSessionKey, track, timestamp: listenedAt, credentials });
        }
        results.lastfm = { ok: true };
      } catch (error) {
        results.lastfm = { ok: false, error: errorMessage(error) };
      }
    })());
  }

  const listenBrainzToken = body.providers?.listenbrainz?.token?.trim();
  if (listenBrainzToken) {
    tasks.push((async () => {
      try {
        if (body.type === 'playing_now') {
          await submitListenBrainzNowPlaying({ token: listenBrainzToken, track });
        } else {
          await submitListenBrainzScrobble({ token: listenBrainzToken, track, timestamp: listenedAt });
        }
        results.listenbrainz = { ok: true };
      } catch (error) {
        results.listenbrainz = { ok: false, error: errorMessage(error) };
      }
    })());
  }

  await Promise.all(tasks);

  return jsonResponse({ results });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Profile update failed.';
}
