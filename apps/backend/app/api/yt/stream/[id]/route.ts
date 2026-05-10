import type { NextRequest } from 'next/server';

/**
 * Phase 3: range-aware proxy for the web client's <audio>.
 *
 * Must:
 *   - Forward the incoming `Range` header to googlevideo
 *   - Reflect googlevideo's 206 Partial Content status, `Content-Range`,
 *     and `Content-Length` back to the browser
 *   - Verify a short-lived HMAC on the request so the route isn't a free CDN
 *
 * Streamed responses fit comfortably in the 300 s Fluid Compute timeout.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const range = request.headers.get('range');
  return new Response(
    JSON.stringify({ error: 'not_implemented', phase: 3, trackId: id, range }),
    { status: 501, headers: { 'Content-Type': 'application/json' } },
  );
}
