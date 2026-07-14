import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

import { verifySession } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/cors';
import { submitLastFmNowPlaying, submitLastFmScrobble, type ProfileListenTrack } from '@/lib/lastfm';
import { submitListenBrainzNowPlaying, submitListenBrainzScrobble } from '@/lib/listenbrainz';
import { resolveLastFmSessionKey, resolveListenBrainzToken } from '@/lib/profile-listens';
import { getLastFmConnection, getListenBrainzConnection } from '@/lib/profile-connections';

export const runtime = 'nodejs';

type ListenSubmissionType = 'playing_now' | 'scrobble';

interface ProfileListenRequest {
  type?: ListenSubmissionType;
  providers?: {
    lastfm?: {
      sessionKey?: string;
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
  const requestId = request.headers.get('x-vercel-id') || randomUUID();
  let body: ProfileListenRequest;
  try {
    body = await request.json() as ProfileListenRequest;
  } catch {
    logProfileListen(requestId, 'rejected', { reason: 'invalid_json' });
    return jsonResponse({ error: 'invalid_json' }, { status: 400 });
  }

  if (body.type !== 'playing_now' && body.type !== 'scrobble') {
    logProfileListen(requestId, 'rejected', { reason: 'invalid_listen_type' });
    return jsonResponse({ error: 'invalid_listen_type' }, { status: 400 });
  }

  if (!body.track?.title || !body.track.artist) {
    logProfileListen(requestId, 'rejected', { reason: 'invalid_track', type: body.type });
    return jsonResponse({ error: 'invalid_track' }, { status: 400 });
  }

  logProfileListen(requestId, 'started', {
    type: body.type,
    providers: {
      lastfm: body.providers?.lastfm !== undefined,
      listenbrainz: body.providers?.listenbrainz !== undefined,
    },
  });

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

  const lastFmSessionKey = await resolveLastFmSessionKey({
    provider: body.providers?.lastfm,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    getSessionUserId: async () => (await optionalSession(request))?.userId ?? null,
    getConnection: getLastFmConnection,
  });

  if (lastFmSessionKey) {
    tasks.push((async () => {
      try {
        if (body.type === 'playing_now') {
          await submitLastFmNowPlaying({ sessionKey: lastFmSessionKey, track });
        } else {
          await submitLastFmScrobble({ sessionKey: lastFmSessionKey, track, timestamp: listenedAt });
        }
        results.lastfm = { ok: true };
      } catch (error) {
        results.lastfm = { ok: false, error: errorMessage(error) };
      }
    })());
  }

  const listenBrainzToken = await resolveListenBrainzToken({
    provider: body.providers?.listenbrainz,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    getSessionUserId: async () => (await optionalSession(request))?.userId ?? null,
    getConnection: getListenBrainzConnection,
  });
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

  logProfileListen(requestId, 'completed', {
    type: body.type,
    providers: {
      lastfm: providerLogResult(results.lastfm),
      listenbrainz: providerLogResult(results.listenbrainz),
    },
  });

  return jsonResponse({ requestId, results });
}

function logProfileListen(requestId: string, event: string, details: Record<string, unknown>) {
  console.info('[profile-listens]', JSON.stringify({ requestId, event, ...details }));
}

function providerLogResult(result: ProviderResult) {
  if (result.skipped) return 'skipped';
  return result.ok ? 'ok' : 'failed';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Profile update failed.';
}

async function optionalSession(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;

  try {
    return await verifySession(auth.substring(7));
  } catch {
    return null;
  }
}
