export type SupportedMediaLink =
  | { provider: 'youtube'; kind: 'track'; id: string; url: string }
  | { provider: 'youtube'; kind: 'playlist'; id: string; url: string }
  | { provider: 'soundcloud'; kind: 'url'; url: string };

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);
const SOUNDCLOUD_HOSTS = new Set([
  'soundcloud.com',
  'www.soundcloud.com',
  'm.soundcloud.com',
  'on.soundcloud.com',
]);
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,160}$/;

export function parseSupportedMediaLink(input: string): SupportedMediaLink | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;

  const host = parsed.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host)) {
    const videoId = youtubeVideoId(parsed);
    const playlistId = parsed.searchParams.get('list')?.trim() || '';
    if (videoId && YOUTUBE_ID_PATTERN.test(videoId)) {
      return { provider: 'youtube', kind: 'track', id: videoId, url: parsed.toString() };
    }
    if (playlistId && YOUTUBE_ID_PATTERN.test(playlistId)) {
      return { provider: 'youtube', kind: 'playlist', id: playlistId, url: parsed.toString() };
    }
    return null;
  }

  if (SOUNDCLOUD_HOSTS.has(host)) {
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (host !== 'on.soundcloud.com' && pathParts.length < 2) return null;
    return { provider: 'soundcloud', kind: 'url', url: parsed.toString() };
  }

  return null;
}

function youtubeVideoId(url: URL) {
  if (url.hostname.toLowerCase() === 'youtu.be') {
    return url.pathname.split('/').filter(Boolean)[0] || '';
  }
  if (url.pathname === '/watch') return url.searchParams.get('v')?.trim() || '';
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
    return parts[1] || '';
  }
  return '';
}
