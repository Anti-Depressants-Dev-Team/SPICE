import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routeUrl = new URL('../app/api/playlists/shared/[playlistId]/tracks/route.ts', import.meta.url);
const schemaUrl = new URL('../db/schema.ts', import.meta.url);

test('shared playlist saves serialize repeat taps without changing private playlist semantics', async () => {
  const [route, schema] = await Promise.all([
    readFile(routeUrl, 'utf8'),
    readFile(schemaUrl, 'utf8'),
  ]);

  assert.match(route, /pg_advisory_xact_lock\(hashtextextended/);
  assert.match(route, /eq\(playlistMembers\.status, 'accepted'\)/);
  assert.match(route, /HAVING NOT EXISTS \(SELECT 1 FROM existing\)/);
  assert.match(route, /ON CONFLICT \(playlist_id, position\) DO NOTHING/);
  assert.match(route, /eq\(playlistItems\.addedByUserId, session\.userId\)/);
  assert.match(route, /\.returning\(\{ position: playlistItems\.position \}\)/);
  assert.match(route, /if \(!deletedItems\[0\]\)/);
  assert.doesNotMatch(schema, /playlist_items_track_identity_unique/);
});
