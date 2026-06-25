import { db } from '@/db';
import { playlistItems, playlistMembers, playlists, users, profiles } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

import { trackSnapshotFromRow } from './track-snapshot';

interface SharedPlaylistOptions {
  shared?: boolean;
  shareRole?: string;
  includeMembers?: boolean;
}

interface MemberInfo {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: string;
}

type UserInfo = { username: string | null; displayName: string; avatarUrl: string | null };

async function getUserInfo(userId: string): Promise<UserInfo> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.userId, userId), eq(profiles.id, 'default')),
  });
  return {
    username: user?.username || null,
    displayName: profile?.displayName || user?.email || 'Unknown',
    avatarUrl: profile?.avatarUrl || null,
  };
}

async function getBatchUserInfo(userIds: string[]): Promise<Record<string, UserInfo>> {
  if (userIds.length === 0) return {};

  const fetchedUsers = await db.query.users.findMany({ where: inArray(users.id, userIds) });
  const fetchedProfiles = await db.query.profiles.findMany({
    where: and(inArray(profiles.userId, userIds), eq(profiles.id, 'default')),
  });

  const profileMap = new Map(fetchedProfiles.map(p => [p.userId, p]));
  const userMap = new Map(fetchedUsers.map(u => [u.id, u]));

  const result: Record<string, UserInfo> = {};
  for (const uid of userIds) {
    const user = userMap.get(uid);
    const profile = profileMap.get(uid);
    if (user) {
      result[uid] = {
        username: user.username || null,
        displayName: profile?.displayName || user.email || 'Unknown',
        avatarUrl: profile?.avatarUrl || null,
      };
    }
  }
  return result;
}

export async function getPlaylistSnapshot(playlistId: string, options: SharedPlaylistOptions = {}) {
  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });

  if (!playlist || playlist.deletedAt) {
    return null;
  }

  const items = await db.query.playlistItems.findMany({
    where: eq(playlistItems.playlistId, playlist.id),
    orderBy: playlistItems.position,
  });

  // Collect all user IDs to fetch in one batch
  const allUserIds = new Set<string>();
  allUserIds.add(playlist.userId);

  // Build addedBy map for attribution
  const addedByUserIds = new Set(
    items.map((item) => item.addedByUserId).filter((id): id is string => !!id),
  );
  for (const uid of addedByUserIds) {
    allUserIds.add(uid);
  }

  // Collect members if requested
  let memberRows: any[] = [];
  if (options.includeMembers || options.shared) {
    memberRows = await db.select().from(playlistMembers).where(and(eq(playlistMembers.playlistId, playlist.id), eq(playlistMembers.status, 'accepted')));
    for (const row of memberRows) {
      if (row.userId !== playlist.userId) {
        allUserIds.add(row.userId);
      }
    }
  }

  // Fetch all user info in a single batch
  const userInfos = await getBatchUserInfo(Array.from(allUserIds));

  const addedByMap: Record<string, { username: string | null; displayName: string }> = {};
  for (const uid of addedByUserIds) {
    const info = userInfos[uid];
    if (info) {
      addedByMap[uid] = { username: info.username, displayName: info.displayName };
    }
  }

  const tracks = items.map((item) => {
    const base = trackSnapshotFromRow(item);
    const addedBy = item.addedByUserId && addedByMap[item.addedByUserId]
      ? { userId: item.addedByUserId, ...addedByMap[item.addedByUserId] }
      : undefined;
    return {
      ...base,
      position: item.position,
      ...(addedBy ? { addedBy } : {}),
    };
  });

  // Optionally include member list
  let members: MemberInfo[] | undefined;
  if (options.includeMembers || options.shared) {
    members = [];
    for (const row of memberRows) {
      if (row.userId === playlist.userId) continue;
      const info = userInfos[row.userId];
      if (info) {
        members.push({
          userId: row.userId,
          username: info.username,
          displayName: info.displayName,
          avatarUrl: info.avatarUrl,
          role: row.role,
        });
      }
    }
  }

  // Get owner info
  const ownerInfo = userInfos[playlist.userId] || { username: null, displayName: 'Unknown', avatarUrl: null };

  return {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description || '',
    createdAt: playlist.updatedAt.toISOString(),
    gradient: playlist.gradient,
    coverUrl: playlist.coverUrl || null,
    tracks,
    ownerId: playlist.userId,
    ownerUsername: ownerInfo.username,
    ownerDisplayName: ownerInfo.displayName,
    ...(options.shared ? { shared: true } : {}),
    ...(options.shareRole ? { shareRole: options.shareRole } : {}),
    ...(members ? { members } : {}),
  };
}
