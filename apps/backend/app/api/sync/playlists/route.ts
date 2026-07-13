import { jsonResponse, optionsResponse } from '@/lib/cors';
import { verifySession } from '@/lib/auth';
import { db } from '@/db';
import { playlists, playlistItems, playlistMembers, playlistInvites } from '@/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { trackSnapshotColumns } from '@/lib/track-snapshot';
import type { TrackSnapshotInput } from '@/lib/track-snapshot';
import { getPlaylistSnapshotsBatch } from '@/lib/shared-playlists';
import {
  isUuid,
  playlistItemsMatch,
  playlistMetadataMatches,
  playlistMetadataValues,
} from '@/lib/playlist-sync';

export const runtime = 'nodejs';

interface ClientPlaylistPayload {
  id?: string;
  title?: string;
  description?: string;
  gradient?: string;
  coverUrl?: string;
  tracks?: TrackSnapshotInput[];
  shared?: boolean;
  isPublic?: boolean;
}

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized', message: 'Missing auth header.' }, { status: 401 });
    }

    const token = auth.substring(7);
    const session = await verifySession(token);

    if (!process.env.DATABASE_URL) {
      return jsonResponse({ error: 'database_not_configured', message: 'Backend DATABASE_URL environment variable is not configured.' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId') || 'default';

    const userPlaylists = await db.query.playlists.findMany({
      where: and(
        eq(playlists.userId, session.userId),
        eq(playlists.profileId, profileId),
        isNull(playlists.deletedAt)
      ),
      orderBy: playlists.sortIndex,
    });

    const results = [];
    const playlistIds = userPlaylists.map(pl => pl.id);
    let allMemberRows: typeof playlistMembers.$inferSelect[] = [];
    let allInviteRows: typeof playlistInvites.$inferSelect[] = [];

    if (playlistIds.length > 0) {
      allMemberRows = await db.select().from(playlistMembers).where(inArray(playlistMembers.playlistId, playlistIds));
      allInviteRows = await db.select().from(playlistInvites).where(inArray(playlistInvites.playlistId, playlistIds));
    }

    const membersByPlaylist = new Set(allMemberRows.map(r => r.playlistId));
    const invitesByPlaylist = new Set(allInviteRows.map(r => r.playlistId));

    const optionsMap: Record<string, { shared?: boolean; includeMembers?: boolean; shareRole?: string }> = {};
    for (const id of playlistIds) {
      const isShared = membersByPlaylist.has(id) || invitesByPlaylist.has(id);
      optionsMap[id] = {
        shared: isShared,
        includeMembers: isShared,
        shareRole: isShared ? 'owner' : undefined,
      };
    }

    const snapshots = await getPlaylistSnapshotsBatch(playlistIds, optionsMap);
    results.push(...snapshots);

    const memberRows = await db.select().from(playlistMembers).where(and(eq(playlistMembers.userId, session.userId), eq(playlistMembers.status, 'accepted')));
    const sharedPlaylistIds = memberRows.map(m => m.playlistId);

    if (sharedPlaylistIds.length > 0) {
      const sharedOptionsMap: Record<string, { shared?: boolean; shareRole?: string }> = {};
      for (const membership of memberRows) {
        sharedOptionsMap[membership.playlistId] = {
          shared: true,
          shareRole: membership.role,
        };
      }
      const sharedSnapshots = await getPlaylistSnapshotsBatch(sharedPlaylistIds, sharedOptionsMap);
      for (const snapshot of sharedSnapshots) {
        if (snapshot.ownerId !== session.userId) {
          results.push(snapshot);
        }
      }
    }

    return jsonResponse({ playlists: results });
  } catch (error) {
    return jsonResponse(
      {
        error: 'sync_get_playlists_failed',
        message: error instanceof Error ? error.message : 'Failed to retrieve cloud playlists.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized', message: 'Missing auth header.' }, { status: 401 });
    }

    const token = auth.substring(7);
    const session = await verifySession(token);
    const {
      playlists: clientPlaylists,
      profileId: payloadProfileId,
      includeSnapshots: payloadIncludeSnapshots,
    } = await request.json();
    const profileId = payloadProfileId || 'default';
    const includeSnapshots = payloadIncludeSnapshots !== false;

    if (!Array.isArray(clientPlaylists)) {
      return jsonResponse({ error: 'invalid_payload', message: 'Playlists payload must be an array.' }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return jsonResponse({ error: 'database_not_configured', message: 'Backend DATABASE_URL environment variable is not configured.' }, { status: 500 });
    }

    const ownedClientPlaylists = (clientPlaylists as ClientPlaylistPayload[]).filter((clientPl) => (
      clientPl && !clientPl.shared
    ));

    const existing = await db.select({
      id: playlists.id,
      title: playlists.title,
      description: playlists.description,
      gradient: playlists.gradient,
      coverUrl: playlists.coverUrl,
      sortIndex: playlists.sortIndex,
      isPublic: playlists.isPublic,
      deletedAt: playlists.deletedAt,
    }).from(playlists).where(
      and(
        eq(playlists.userId, session.userId),
        eq(playlists.profileId, profileId)
      )
    );

    const privatePlaylists = [];
    const existingIds = existing.map((pl) => pl.id);

    if (existingIds.length > 0) {
      const allMembers = await db.select({ playlistId: playlistMembers.playlistId }).from(playlistMembers).where(inArray(playlistMembers.playlistId, existingIds));
      const allInvites = await db.select({ playlistId: playlistInvites.playlistId }).from(playlistInvites).where(inArray(playlistInvites.playlistId, existingIds));

      const sharedPlaylistIds = new Set([
        ...allMembers.map((m) => m.playlistId),
        ...allInvites.map((i) => i.playlistId)
      ]);

      for (const pl of existing) {
        if (!sharedPlaylistIds.has(pl.id)) {
          privatePlaylists.push(pl);
        }
      }
    }

    const privatePlaylistIds = privatePlaylists.map((playlist) => playlist.id);
    const storedItems = privatePlaylistIds.length > 0
      ? await db.select({
          playlistId: playlistItems.playlistId,
          position: playlistItems.position,
          sourceId: playlistItems.sourceId,
          trackId: playlistItems.trackId,
          title: playlistItems.title,
          artistsJson: playlistItems.artistsJson,
          artworkUrl: playlistItems.artworkUrl,
          durationMs: playlistItems.durationMs,
        }).from(playlistItems).where(inArray(playlistItems.playlistId, privatePlaylistIds))
      : [];
    const itemsByPlaylist = new Map<string, typeof storedItems>();
    for (const item of storedItems) {
      const current = itemsByPlaylist.get(item.playlistId) || [];
      current.push(item);
      itemsByPlaylist.set(item.playlistId, current);
    }

    const existingPrivateById = new Map(privatePlaylists.map((playlist) => [playlist.id, playlist]));
    const clientIds = new Set(
      ownedClientPlaylists
        .map((playlist) => playlist.id)
        .filter(isUuid),
    );
    const batch = [];

    for (const playlist of privatePlaylists) {
      if (!clientIds.has(playlist.id)) {
        batch.push(db.delete(playlists).where(eq(playlists.id, playlist.id)));
      }
    }

    for (let i = 0; i < ownedClientPlaylists.length; i++) {
      const clientPl = ownedClientPlaylists[i];
      const playlistId = isUuid(clientPl.id) ? clientPl.id : crypto.randomUUID();
      const storedPlaylist = existingPrivateById.get(playlistId);
      const metadataMatches = storedPlaylist
        ? playlistMetadataMatches(storedPlaylist, clientPl, i)
        : false;
      const itemsMatch = storedPlaylist
        ? playlistItemsMatch(itemsByPlaylist.get(playlistId) || [], clientPl.tracks)
        : false;

      if (!storedPlaylist) {
        batch.push(db.insert(playlists).values({
          id: playlistId,
          userId: session.userId,
          profileId,
          ...playlistMetadataValues(clientPl, i),
        }));
      } else if (!metadataMatches || !itemsMatch) {
        batch.push(db
          .update(playlists)
          .set({
            ...playlistMetadataValues(clientPl, i),
            deletedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(playlists.id, playlistId)));
      }

      if (storedPlaylist && !itemsMatch) {
        batch.push(db.delete(playlistItems).where(eq(playlistItems.playlistId, playlistId)));
      }

      if ((!storedPlaylist || !itemsMatch) && Array.isArray(clientPl.tracks) && clientPl.tracks.length > 0) {
        const itemsPayload = clientPl.tracks.map((t, pos: number) => ({
          playlistId: playlistId as string,
          position: pos,
          sourceId: t.sourceId || 'youtube_music',
          trackId: t.id,
          ...trackSnapshotColumns(t, t.id),
        }));
        batch.push(db.insert(playlistItems).values(itemsPayload));
      }
    }

    if (batch.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.batch(batch as any);
    }

    if (!includeSnapshots) {
      return jsonResponse({ success: true, count: ownedClientPlaylists.length });
    }

    const userPlaylists = await db.query.playlists.findMany({
      where: and(
        eq(playlists.userId, session.userId),
        eq(playlists.profileId, profileId),
        isNull(playlists.deletedAt)
      ),
      orderBy: playlists.sortIndex,
    });

    const results = [];
    const playlistIds = userPlaylists.map(pl => pl.id);
    let allMemberRows: typeof playlistMembers.$inferSelect[] = [];
    let allInviteRows: typeof playlistInvites.$inferSelect[] = [];

    if (playlistIds.length > 0) {
      allMemberRows = await db.select().from(playlistMembers).where(inArray(playlistMembers.playlistId, playlistIds));
      allInviteRows = await db.select().from(playlistInvites).where(inArray(playlistInvites.playlistId, playlistIds));
    }

    const membersByPlaylist = new Set(allMemberRows.map(r => r.playlistId));
    const invitesByPlaylist = new Set(allInviteRows.map(r => r.playlistId));

    const optionsMap: Record<string, { shared?: boolean; includeMembers?: boolean; shareRole?: string }> = {};
    for (const id of playlistIds) {
      const isShared = membersByPlaylist.has(id) || invitesByPlaylist.has(id);
      optionsMap[id] = {
        shared: isShared,
        includeMembers: isShared,
        shareRole: isShared ? 'owner' : undefined,
      };
    }

    const snapshots = await getPlaylistSnapshotsBatch(playlistIds, optionsMap);
    results.push(...snapshots);

    return jsonResponse({ success: true, count: ownedClientPlaylists.length, playlists: results });
  } catch (error) {
    return jsonResponse(
      {
        error: 'sync_post_playlists_failed',
        message: error instanceof Error ? error.message : 'Failed to synchronize playlists.',
      },
      { status: 500 }
    );
  }
}
