import type { NextRequest } from 'next/server';

import { jsonResponse, optionsResponse } from '@/lib/cors';
import { createLastFmAuthToken, createLastFmSession, createLastFmWebAuthUrl } from '@/lib/lastfm';

export const runtime = 'nodejs';

interface LastFmAuthRequest {
  action?: 'web_auth' | 'token' | 'session';
  apiKey?: string;
  sharedSecret?: string;
  token?: string;
}

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  let body: LastFmAuthRequest;
  try {
    body = await request.json() as LastFmAuthRequest;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    if (body.action === 'web_auth') {
      return jsonResponse(createLastFmWebAuthUrl(
        {
          apiKey: body.apiKey,
          sharedSecret: body.sharedSecret,
        },
        `${request.nextUrl.origin}/api/lastfm/callback`,
      ));
    }

    if (body.action === 'token') {
      return jsonResponse(await createLastFmAuthToken({
        apiKey: body.apiKey,
        sharedSecret: body.sharedSecret,
      }));
    }

    if (body.action === 'session') {
      if (!body.token?.trim()) {
        return jsonResponse({ error: 'missing_token' }, { status: 400 });
      }

      return jsonResponse(await createLastFmSession({
        apiKey: body.apiKey,
        sharedSecret: body.sharedSecret,
        token: body.token,
      }));
    }

    return jsonResponse({ error: 'invalid_action' }, { status: 400 });
  } catch (error) {
    return jsonResponse(
      {
        error: 'lastfm_auth_failed',
        message: error instanceof Error ? error.message : 'Last.fm auth failed.',
      },
      { status: 502 },
    );
  }
}
