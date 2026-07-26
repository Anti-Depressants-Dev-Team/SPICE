export type SupportedMediaLink =
  | { provider: 'youtube'; kind: 'track'; id: string; url: string }
  | { provider: 'youtube'; kind: 'playlist'; id: string; url: string }
  | { provider: 'youtube'; kind: 'album'; id: string; url: string }
  | { provider: 'soundcloud'; kind: 'url'; url: string };

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'www.music.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const SOUNDCLOUD_HOSTS = new Set([
  'soundcloud.com',
  'www.soundcloud.com',
  'm.soundcloud.com',
  'on.soundcloud.com',
]);
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,160}$/;
const YOUTUBE_ALBUM_ID_PATTERN = /^MPRE[A-Za-z0-9_-]{4,156}$/;
const MEDIA_HOST_PREFIX = /^(?:(?:www|m|music|on)\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be|soundcloud\.com)\//i;

export function parseSupportedMediaLink(input: string): SupportedMediaLink | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;

  let parsed = parseMediaUrl(value);
  if (!parsed) return null;
  parsed = unwrapYouTubeRedirect(parsed);
  if (!parsed) return null;

  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;

  const host = parsed.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host)) {
    const videoId = youtubeVideoId(parsed);
    const playlistId = parsed.searchParams.get('list')?.trim() || '';
    const albumId = youtubeAlbumId(parsed);
    if (videoId && YOUTUBE_ID_PATTERN.test(videoId)) {
      return {
        provider: 'youtube',
        kind: 'track',
        id: videoId,
        url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      };
    }
    if (playlistId && YOUTUBE_ID_PATTERN.test(playlistId)) {
      return {
        provider: 'youtube',
        kind: 'playlist',
        id: playlistId,
        url: `https://music.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
      };
    }
    if (albumId && YOUTUBE_ALBUM_ID_PATTERN.test(albumId)) {
      return {
        provider: 'youtube',
        kind: 'album',
        id: albumId,
        url: `https://music.youtube.com/browse/${encodeURIComponent(albumId)}`,
      };
    }
    return null;
  }

  if (SOUNDCLOUD_HOSTS.has(host)) {
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (host !== 'on.soundcloud.com' && pathParts.length < 2) return null;
    const normalizedHost = host === 'on.soundcloud.com' ? host : 'soundcloud.com';
    const secretToken = parsed.searchParams.get('secret_token')?.trim();
    const privateQuery = secretToken ? `?secret_token=${encodeURIComponent(secretToken)}` : '';
    return {
      provider: 'soundcloud',
      kind: 'url',
      url: `https://${normalizedHost}${normalizedPath(parsed.pathname)}${privateQuery}`,
    };
  }

  return null;
}

function parseMediaUrl(value: string) {
  const candidate = MEDIA_HOST_PREFIX.test(value) ? `https://${value}` : value;
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

function unwrapYouTubeRedirect(initial: URL) {
  let parsed = initial;
  for (let depth = 0; depth < 3; depth += 1) {
    const host = parsed.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host) || parsed.pathname !== '/redirect') return parsed;
    const target = parsed.searchParams.get('q') || parsed.searchParams.get('url');
    if (!target) return null;
    const unwrapped = parseMediaUrl(target);
    if (!unwrapped) return null;
    parsed = unwrapped;
  }
  return null;
}

function normalizedPath(pathname: string) {
  const collapsed = pathname.replace(/\/{2,}/g, '/');
  return collapsed === '/' ? collapsed : collapsed.replace(/\/+$/, '');
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

function youtubeAlbumId(url: URL) {
  const parts = url.pathname.split('/').filter(Boolean);
  return parts[0] === 'browse' ? parts[1] || '' : '';
}
