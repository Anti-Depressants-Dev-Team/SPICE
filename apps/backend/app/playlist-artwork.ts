export interface PlaylistArtworkTrack {
  id?: string;
  sourceId?: string;
  artworkUrl?: string;
  album?: { artworkUrl?: string };
}

export interface PlaylistArtworkSource {
  coverUrl?: string;
  tracks?: PlaylistArtworkTrack[];
}

const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/u;

const cleanArtworkUrl = (value: string | undefined) => value?.trim() || '';

const youtubeArtworkUrl = (track: PlaylistArtworkTrack) => {
  const sourceId = track.sourceId || 'youtube_music';
  if (sourceId !== 'youtube_music' && sourceId !== 'youtube_video') return '';

  const videoId = track.id?.trim() || '';
  return youtubeVideoIdPattern.test(videoId)
    ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
    : '';
};

export function playlistArtworkCandidates(playlist: PlaylistArtworkSource): string[] {
  const candidates = [
    cleanArtworkUrl(playlist.coverUrl),
    ...(playlist.tracks || []).flatMap((track) => [
      cleanArtworkUrl(track.artworkUrl),
      cleanArtworkUrl(track.album?.artworkUrl),
      youtubeArtworkUrl(track),
    ]),
  ];

  return [...new Set(candidates.filter(Boolean))];
}
