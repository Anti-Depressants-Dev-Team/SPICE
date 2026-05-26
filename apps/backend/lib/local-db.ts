import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DB_PATH = path.join(process.cwd(), 'local_db.json');

export interface LocalUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface LocalPlaylist {
  id: string;
  userId: string;
  title: string;
  description: string;
  tracks: { id: string; sourceId: string }[];
  updatedAt: string;
}

export interface LocalLike {
  userId: string;
  trackId: string;
  sourceId: string;
}

export interface LocalHistoryItem {
  userId: string;
  trackId: string;
  sourceId: string;
  playedAt: string;
}

interface LocalSchema {
  users: LocalUser[];
  playlists: LocalPlaylist[];
  likes: LocalLike[];
  history: LocalHistoryItem[];
}

function readDb(): LocalSchema {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { users: [], playlists: [], likes: [], history: [] };
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read local DB:', e);
    return { users: [], playlists: [], likes: [], history: [] };
  }
}

function writeDb(data: LocalSchema) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write local DB:', e);
  }
}

export async function getLocalUsers(): Promise<LocalUser[]> {
  return readDb().users;
}

export async function findLocalUserByEmail(email: string): Promise<LocalUser | null> {
  const normEmail = email.toLowerCase().trim();
  const db = readDb();
  return db.users.find(u => u.email === normEmail) || null;
}

export async function addLocalUser(email: string, passwordHash: string): Promise<LocalUser> {
  const db = readDb();
  const newUser: LocalUser = {
    id: crypto.randomUUID(),
    email: email.toLowerCase().trim(),
    passwordHash,
    createdAt: new Date().toISOString()
  };
  db.users.push(newUser);
  writeDb(db);
  return newUser;
}

export async function getLocalPlaylists(userId: string): Promise<any[]> {
  const db = readDb();
  const userPls = db.playlists.filter(p => p.userId === userId);
  return userPls.map(pl => ({
    id: pl.id,
    title: pl.title,
    description: pl.description || '',
    createdAt: pl.updatedAt,
    gradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
    tracks: pl.tracks.map(t => ({
      id: t.id,
      title: 'Track',
      artists: [],
      sourceId: t.sourceId
    }))
  }));
}

export async function saveLocalPlaylists(userId: string, plsPayload: any[]): Promise<void> {
  const db = readDb();
  db.playlists = db.playlists.filter(p => p.userId !== userId);
  
  for (const pl of plsPayload) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pl.id);
    const newPl: LocalPlaylist = {
      id: isUUID ? pl.id : crypto.randomUUID(),
      userId,
      title: pl.title,
      description: pl.description || '',
      tracks: (pl.tracks || []).map((t: any) => ({
        id: t.id,
        sourceId: t.sourceId || 'youtube_music'
      })),
      updatedAt: new Date().toISOString()
    };
    db.playlists.push(newPl);
  }
  writeDb(db);
}

export async function getLocalLikes(userId: string): Promise<string[]> {
  const db = readDb();
  return db.likes.filter(l => l.userId === userId).map(l => l.trackId);
}

export async function saveLocalLikes(userId: string, likedTrackIds: string[]): Promise<void> {
  const db = readDb();
  db.likes = db.likes.filter(l => l.userId !== userId);
  const uniqueTracks = Array.from(new Set(likedTrackIds));
  for (const tid of uniqueTracks) {
    db.likes.push({
      userId,
      trackId: tid,
      sourceId: 'youtube_music'
    });
  }
  writeDb(db);
}

export async function getLocalHistory(userId: string): Promise<any[]> {
  const db = readDb();
  const userHistory = db.history.filter(h => h.userId === userId);
  userHistory.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
  return userHistory.slice(0, 50).map(h => ({
    id: h.trackId,
    title: 'Track',
    artists: [],
    sourceId: h.sourceId
  }));
}

export async function saveLocalHistory(userId: string, historyTracks: any[]): Promise<void> {
  const db = readDb();
  db.history = db.history.filter(h => h.userId !== userId);
  for (let i = 0; i < historyTracks.length; i++) {
    const h = historyTracks[i];
    db.history.push({
      userId,
      trackId: h.id,
      sourceId: h.sourceId || 'youtube_music',
      playedAt: new Date(Date.now() - i * 1000).toISOString()
    });
  }
  writeDb(db);
}
