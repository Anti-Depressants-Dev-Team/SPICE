import type { NextRequest } from 'next/server';

/**
 * Phase 3: search YouTube Music via `youtubei.js` and return SearchResults.
 * The web client hits this; native clients call YT directly.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  if (!q) {
    return Response.json({ error: 'missing q' }, { status: 400 });
  }
  return Response.json(
    { error: 'not_implemented', phase: 3, query: q },
    { status: 501 },
  );
}
