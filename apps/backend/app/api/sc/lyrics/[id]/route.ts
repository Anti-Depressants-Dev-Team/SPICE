import type { NextRequest } from 'next/server';

import { jsonResponse, optionsResponse } from '@/lib/cors';
import { resolveLyrics } from '@/lib/lrclib';
import { getSoundCloudTrackMetadata } from '@/lib/soundcloud';

export const runtime = 'nodejs';

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const track = await getSoundCloudTrackMetadata(id);
    return jsonResponse(await resolveLyrics({
      trackId: track.id,
      title: track.title,
      artist: track.artists[0]?.name || '',
      durationMs: track.durationMs || 180000,
    }));
  } catch (error) {
    return jsonResponse(
      {
        trackId: id,
        plainLyrics: '',
        syncedLyrics: '',
        isSynced: false,
        error: error instanceof Error ? error.message : 'Could not resolve SoundCloud lyrics.',
      },
      { status: 502 },
    );
  }
}
