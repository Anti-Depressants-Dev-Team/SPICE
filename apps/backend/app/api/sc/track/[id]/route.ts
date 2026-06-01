import type { NextRequest } from 'next/server';

import { jsonResponse, optionsResponse } from '@/lib/cors';
import { getSoundCloudTrackDetails } from '@/lib/soundcloud';
import { buildSignedStreamUrl } from '@/lib/stream-signing';

export const runtime = 'nodejs';

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestedQuality = request.nextUrl.searchParams.get('quality');
  const quality = requestedQuality === 'high' || requestedQuality === 'low'
    ? requestedQuality
    : 'standard';

  try {
    const details = await getSoundCloudTrackDetails(id, quality);
    const expiresAt = Date.now() + 10 * 60 * 1000;
    return jsonResponse({
      track: details.track,
      streams: details.streams.map((stream) => ({
        ...stream,
        url: stream.protocol === 'progressive'
          ? buildSignedStreamUrl(request.nextUrl.origin, {
              id,
              itag: stream.itag,
              upstreamUrl: stream.url,
              expiresAt,
            }, '/api/sc/stream')
          : stream.url,
        expiresAt: new Date(expiresAt).toISOString(),
      })),
    });
  } catch (error) {
    return jsonResponse(
      {
        error: 'sc_track_failed',
        message: error instanceof Error ? error.message : 'Could not resolve this SoundCloud track.',
      },
      { status: 502 },
    );
  }
}
