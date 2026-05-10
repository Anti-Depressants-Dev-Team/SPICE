/**
 * Phase 3: resolve a YT video id to playable stream variants.
 * Returns short-TTL signed URLs the web client passes to /api/yt/stream.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return Response.json(
    { error: 'not_implemented', phase: 3, trackId: id },
    { status: 501 },
  );
}
