/**
 * Phase 4: pull (GET) and push (POST) Spice-native playlists.
 * Server resolves with `updated_at` last-write-wins; tombstones via `deleted_at`.
 */
export async function GET(_request: Request) {
  return Response.json({ error: 'not_implemented', phase: 4 }, { status: 501 });
}

export async function POST(_request: Request) {
  return Response.json({ error: 'not_implemented', phase: 4 }, { status: 501 });
}
