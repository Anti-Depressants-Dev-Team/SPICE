import type { NextRequest } from 'next/server';

import { jsonResponse, optionsResponse } from '@/lib/cors';
import { searchListenBrainzRecordings } from '@/lib/listenbrainz';

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
    return jsonResponse({ tracks: await searchListenBrainzRecordings(q, limit) });
  } catch (error) {
    return jsonResponse(
      {
        error: 'listenbrainz_search_failed',
        message: error instanceof Error ? error.message : 'ListenBrainz metadata search failed.',
      },
      { status: 502 },
    );
  }
}
