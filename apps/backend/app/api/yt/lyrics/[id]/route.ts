import type { NextRequest } from 'next/server';

import { jsonResponse, optionsResponse } from '@/lib/cors';
import { resolveLyrics } from '@/lib/lrclib';
import { getTrackDetails, getYouTube } from '@/lib/youtube';

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
    let title = '';
    let artist = '';
    let durationMs = 180000;

    try {
      const yt = await getYouTube();
      const info = await yt.getBasicInfo(id);
      title = info.basic_info.title || '';
      artist = info.basic_info.author || '';
      durationMs = info.basic_info.duration ? info.basic_info.duration * 1000 : 180000;
    } catch {
      const details = await getTrackDetails(id);
      title = details.track.title;
      artist = details.track.artists?.[0]?.name || '';
      durationMs = details.track.durationMs || 180000;
    }

    return jsonResponse(await resolveLyrics({
      trackId: id,
      title,
      artist,
      durationMs,
    }));
  } catch (error) {
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
