import type { NextRequest } from 'next/server';

import { jsonResponse, optionsResponse } from '@/lib/cors';
import { searchLastFmTracks } from '@/lib/lastfm';

export const runtime = 'nodejs';

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  if (!q) {
    return jsonResponse({ error: 'missing q' }, { status: 400 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '20');
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(50, Math.trunc(limitParam)))
    : 20;

  try {
    return jsonResponse({ tracks: await searchLastFmTracks(q, limit) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Last.fm search failed.';
    return jsonResponse(
      {
        error: 'lastfm_search_failed',
        message,
      },
      { status: message.includes('LASTFM_API_KEY') ? 501 : 502 },
    );
  }
}
