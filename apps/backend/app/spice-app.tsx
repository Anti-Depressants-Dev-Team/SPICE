'use client';

/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { type FormEvent, useEffect, useRef, useState } from 'react';

// ── Icons ──────────────────────────────────────────────────────────
const Icons = {
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  ),
  prev: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
    </svg>
  ),
  next: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  heartFilled: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" width="16" height="16">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  library: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  account: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  volume: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  ),
  playlist: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="18" r="1" fill="currentColor" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
};

// ── Types ──────────────────────────────────────────────────────────
interface Artist {
  id: string;
  name: string;
  artworkUrl?: string;
}

interface Album {
  id: string;
  title: string;
  artists: Artist[];
  artworkUrl?: string;
  year?: number;
}

interface Track {
  id: string;
  title: string;
  artists: Artist[];
  album?: Album;
  durationMs?: number;
  artworkUrl?: string;
}

interface Playlist {
  id: string;
  title: string;
  description?: string;
  tracks: Track[];
  gradient: string;
  createdAt: string;
}

interface Profile {
  displayName: string;
  bio: string;
  gradient: string;
  songsPlayed: number;
  joinedAt: string;
}

const PRESET_GRADIENTS = [
  'linear-gradient(135deg, #a855f7, #ec4899)',
  'linear-gradient(135deg, #f97316, #ef4444)',
  'linear-gradient(135deg, #06b6d4, #3b82f6)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #6366f1, #4f46e5)',
];

const genres = [
  { name: 'Pop Hits', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)', emoji: '🎤' },
  { name: 'Hip-Hop', gradient: 'linear-gradient(135deg, #f97316, #ef4444)', emoji: '🎧' },
  { name: 'Rock Charts', gradient: 'linear-gradient(135deg, #64748b, #334155)', emoji: '🎸' },
  { name: 'Lofi Chill', gradient: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', emoji: '☕' },
  { name: 'Electronic', gradient: 'linear-gradient(135deg, #d97706, #b45309)', emoji: '🎹' },
  { name: 'Jazz Beats', gradient: 'linear-gradient(135deg, #059669, #0d9488)', emoji: '🎺' },
];

export default function SpiceApp() {
  const [currentPage, setCurrentPage] = useState<'home' | 'search' | 'library' | 'account'>('home');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  
  const [currentTrack, setCurrentTrack] = useState<Track>({
    id: 'Starboy',
    title: 'Starboy',
    artists: [{ id: 'The Weeknd', name: 'The Weeknd' }],
    artworkUrl: 'https://lh3.googleusercontent.com/e44T8B4s4HwT1kX5j1Y0qN_fRj5fLwVvDkO04EwU8T2v9K51hVd6qO9yPZ5zPZ5v=w120-h120'
  });
  
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);

  // Lazy loaders for persistent states
  const [likedTracks, setLikedTracks] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const savedLikes = localStorage.getItem('spice_likes');
      if (savedLikes) {
        try { return new Set(JSON.parse(savedLikes)); } catch (e) { console.error(e); }
      }
    }
    return new Set();
  });

  const [queue, setQueue] = useState<Track[]>([currentTrack]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [libraryView, setLibraryView] = useState<'list' | 'grid'>('list');
  const [libraryFilter, setLibraryFilter] = useState<'playlists' | 'liked' | 'history'>('playlists');
  
  // Custom user playlists
  const [customPlaylists, setCustomPlaylists] = useState<Playlist[]>(() => {
    if (typeof window !== 'undefined') {
      const savedPlaylists = localStorage.getItem('spice_playlists');
      if (savedPlaylists) {
        try { return JSON.parse(savedPlaylists); } catch (e) { console.error(e); }
      }
    }
    return [];
  });
  
  // Playback History
  const [history, setHistory] = useState<Track[]>(() => {
    if (typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem('spice_history');
      if (savedHistory) {
        try { return JSON.parse(savedHistory); } catch (e) { console.error(e); }
      }
    }
    return [];
  });

  // Local Accounts Settings
  const [profile, setProfile] = useState<Profile>(() => {
    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('spice_profile');
      if (savedProfile) {
        try { return JSON.parse(savedProfile); } catch (e) { console.error(e); }
      }
    }
    return {
      displayName: 'Spice Listener',
      bio: 'Chasing the craziest tunes.',
      gradient: PRESET_GRADIENTS[0],
      songsPlayed: 0,
      joinedAt: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long' }),
    };
  });

  // Dialog & Form states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlTitle, setNewPlTitle] = useState('');
  const [newPlDesc, setNewPlDesc] = useState('');

  // Editable Profile
  const [editName, setEditName] = useState(profile.displayName);
  const [editBio, setEditBio] = useState(profile.bio);
  const [editGradient, setEditGradient] = useState(profile.gradient);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Dynamic Home Page Queries
  const [homeTrending, setHomeTrending] = useState<Track[]>([]);
  const [homeChill, setHomeChill] = useState<Track[]>([]);
  const [homeEnergy, setHomeEnergy] = useState<Track[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string>();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch dynamic content on mount
  useEffect(() => {
    async function loadHomeContent() {
      setIsLoadingHome(true);
      try {
        const trendRes = await fetch(`/api/yt/search?q=${encodeURIComponent('Top Hits 2026')}&limit=8`);
        const chillRes = await fetch(`/api/yt/search?q=${encodeURIComponent('Chill Study Lofi Beats')}&limit=8`);
        const energyRes = await fetch(`/api/yt/search?q=${encodeURIComponent('Workout Gym Power')}&limit=8`);

        const trendData = trendRes.ok ? await trendRes.json() : { tracks: [] };
        const chillData = chillRes.ok ? await chillRes.json() : { tracks: [] };
        const energyData = energyRes.ok ? await energyRes.json() : { tracks: [] };

        if (trendData.tracks?.length > 0) {
          setHomeTrending(trendData.tracks);
          // Set a cool trending song as initial track if queue only contains default
          const firstTrack = trendData.tracks[0];
          setQueue(prevQueue => {
            if (prevQueue.length === 1 && prevQueue[0].id === 'Starboy') {
              return [firstTrack];
            }
            return prevQueue;
          });
          setCurrentTrack(prevTrack => {
            if (prevTrack.id === 'Starboy') {
              return firstTrack;
            }
            return prevTrack;
          });
        }
        if (chillData.tracks?.length > 0) setHomeChill(chillData.tracks);
        if (energyData.tracks?.length > 0) setHomeEnergy(energyData.tracks);

      } catch (err) {
        console.error('Failed to load dynamic home feeds:', err);
      } finally {
        setIsLoadingHome(false);
      }
    }

    loadHomeContent();

    // Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Spice Service Worker registered:', reg.scope))
        .catch((err) => console.error('Spice SW registration failed:', err));
    }
  }, []);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Synchronize profile edits when entering editing mode (instead of useEffect to prevent cascading renders)

  // Audio Handlers
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    // Increment songs played on completion
    setProfile(prev => {
      const updated = { ...prev, songsPlayed: prev.songsPlayed + 1 };
      localStorage.setItem('spice_profile', JSON.stringify(updated));
      return updated;
    });
    handleNext();
  };

  const handleAudioError = () => {
    setIsPlaying(false);
    setIsLoadingStream(false);
    setError('Failed to play stream. Upstream YouTube Music connection reset.');
  };

  // Play a track
  const playTrack = async (track: Track, newQueue?: Track[]) => {
    setError(undefined);
    setIsPlaying(false);
    setStreamUrl(null);
    setCurrentTrack(track);
    setIsLoadingStream(true);

    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      setQueueIndex(idx >= 0 ? idx : 0);
    } else {
      if (!queue.some(t => t.id === track.id)) {
        const updated = [...queue];
        updated.splice(queueIndex + 1, 0, track);
        setQueue(updated);
        setQueueIndex(queueIndex + 1);
      } else {
        const idx = queue.findIndex(t => t.id === track.id);
        setQueueIndex(idx >= 0 ? idx : 0);
      }
    }

    try {
      // Direct stream URL fetch from YouTube endpoint
      const resTrack = await fetch(`/api/yt/track/${encodeURIComponent(track.id)}`);
      if (!resTrack.ok) throw new Error('Could not resolve audio streams for this track.');
      
      const payload = await resTrack.json();
      const streams = payload.streams ?? [];
      if (streams.length === 0) throw new Error('No compatible stream format discovered.');

      // Stale-While-Revalidate proxy routing
      const bestStream = streams[0];
      setStreamUrl(bestStream.url);
      setIsPlaying(true);

      // Track playback in history
      setHistory(prev => {
        const filtered = prev.filter(t => t.id !== track.id);
        const updated = [track, ...filtered].slice(0, 50);
        localStorage.setItem('spice_history', JSON.stringify(updated));
        return updated;
      });

      // Update played stats (incrementing upon start as well)
      setProfile(prev => {
        const updated = { ...prev, songsPlayed: prev.songsPlayed + 1 };
        localStorage.setItem('spice_profile', JSON.stringify(updated));
        return updated;
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Playback connection failed.');
    } finally {
      setIsLoadingStream(false);
    }
  };

  const togglePlayPause = () => {
    if (!streamUrl && !isLoadingStream) {
      playTrack(currentTrack);
      return;
    }
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(handleAudioError);
      }
    }
  };

  const handlePrev = () => {
    if (progress > 3) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        setProgress(0);
      }
      return;
    }
    const prevIdx = (queueIndex - 1 + queue.length) % queue.length;
    playTrack(queue[prevIdx]);
  };

  const handleNext = () => {
    const nextIdx = (queueIndex + 1) % queue.length;
    playTrack(queue[nextIdx]);
  };

  const toggleLike = (track: Track) => {
    const updated = new Set(likedTracks);
    if (updated.has(track.id)) {
      updated.delete(track.id);
    } else {
      updated.add(track.id);
    }
    setLikedTracks(updated);
    localStorage.setItem('spice_likes', JSON.stringify(Array.from(updated)));

    // Ensure stateful songs preserve references
    const savedLikedDetails = JSON.parse(localStorage.getItem('spice_liked_details') || '{}');
    if (updated.has(track.id)) {
      savedLikedDetails[track.id] = track;
    } else {
      delete savedLikedDetails[track.id];
    }
    localStorage.setItem('spice_liked_details', JSON.stringify(savedLikedDetails));
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const seekTime = pct * duration;
    audioRef.current.currentTime = seekTime;
    setProgress(seekTime);
  };

  // Search logic (debounced)
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const searchParams = new URLSearchParams({
          q: query,
          kind: 'tracks',
          limit: '20',
        });
        const res = await fetch(`/api/yt/search?${searchParams}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setSearchResults(data.tracks ?? []);
      } catch (err: any) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  // Playlists Operations
  const createPlaylist = (e: FormEvent) => {
    e.preventDefault();
    if (!newPlTitle.trim()) return;

    const gradients = [
      'linear-gradient(135deg, #1e1b4b, #4c1d95)',
      'linear-gradient(135deg, #7c2d12, #dc2626)',
      'linear-gradient(135deg, #164e63, #0891b2)',
      'linear-gradient(135deg, #78350f, #d97706)',
      'linear-gradient(135deg, #14532d, #16a34a)',
    ];
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      title: newPlTitle,
      description: newPlDesc || 'Custom Spice compilation.',
      tracks: [],
      gradient: gradients[Math.floor(Math.random() * gradients.length)],
      createdAt: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    };

    const updated = [...customPlaylists, newPlaylist];
    setCustomPlaylists(updated);
    localStorage.setItem('spice_playlists', JSON.stringify(updated));

    setNewPlTitle('');
    setNewPlDesc('');
    setShowCreateDialog(false);
  };

  const deletePlaylist = (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    const updated = customPlaylists.filter(pl => pl.id !== playlistId);
    setCustomPlaylists(updated);
    localStorage.setItem('spice_playlists', JSON.stringify(updated));
    setSelectedPlaylist(null);
  };

  const addTrackToPlaylist = (track: Track, playlistId: string) => {
    const updated = customPlaylists.map(pl => {
      if (pl.id === playlistId) {
        if (pl.tracks.some(t => t.id === track.id)) return pl;
        return { ...pl, tracks: [...pl.tracks, track] };
      }
      return pl;
    });
    setCustomPlaylists(updated);
    localStorage.setItem('spice_playlists', JSON.stringify(updated));

    // If currently viewing this playlist, sync details view
    if (selectedPlaylist && selectedPlaylist.id === playlistId) {
      setSelectedPlaylist(updated.find(p => p.id === playlistId) || null);
    }
  };

  const removeTrackFromPlaylist = (trackId: string, playlistId: string) => {
    const updated = customPlaylists.map(pl => {
      if (pl.id === playlistId) {
        return { ...pl, tracks: pl.tracks.filter(t => t.id !== trackId) };
      }
      return pl;
    });
    setCustomPlaylists(updated);
    localStorage.setItem('spice_playlists', JSON.stringify(updated));

    if (selectedPlaylist && selectedPlaylist.id === playlistId) {
      setSelectedPlaylist(updated.find(p => p.id === playlistId) || null);
    }
  };

  const getLikedTracksList = (): Track[] => {
    if (typeof window === 'undefined') return [];
    const savedLikedDetails = JSON.parse(localStorage.getItem('spice_liked_details') || '{}');
    return Object.values(savedLikedDetails);
  };

  const clearHistory = () => {
    if (!confirm('Clear all recently played tracks?')) return;
    setHistory([]);
    localStorage.removeItem('spice_history');
  };

  // Account saving
  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    const updated = {
      ...profile,
      displayName: editName.trim() || 'Spice Listener',
      bio: editBio.trim() || 'No bio written yet.',
      gradient: editGradient,
    };
    setProfile(updated);
    localStorage.setItem('spice_profile', JSON.stringify(updated));
    setIsEditingProfile(false);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="app">
      {/* Hidden Audio Element */}
      {streamUrl && (
        <audio
          ref={audioRef}
          src={streamUrl}
          autoPlay={isPlaying}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleAudioEnded}
          onError={handleAudioError}
        />
      )}

      {/* ═══ Sidebar Panel ═══ */}
      <aside className="sidebar">
        <div className="sidebar__logo" onClick={() => { setCurrentPage('home'); setSelectedPlaylist(null); }}>
          <div className="sidebar__logo-icon" style={{ background: profile.gradient }}>
            <span style={{ fontSize: '1rem', fontWeight: 900, color: '#fff' }}>S</span>
          </div>
          <span className="sidebar__logo-text">Spice</span>
        </div>

        <nav className="sidebar__nav">
          <button
            className={`sidebar__nav-item ${currentPage === 'home' && !selectedPlaylist ? 'active' : ''}`}
            onClick={() => { setCurrentPage('home'); setSelectedPlaylist(null); }}
          >
            {Icons.home}
            <span className="sidebar__nav-label">Home</span>
          </button>
          <button
            className={`sidebar__nav-item ${currentPage === 'search' && !selectedPlaylist ? 'active' : ''}`}
            onClick={() => { setCurrentPage('search'); setSelectedPlaylist(null); }}
          >
            {Icons.search}
            <span className="sidebar__nav-label">Search</span>
          </button>
          <button
            className={`sidebar__nav-item ${currentPage === 'library' && !selectedPlaylist ? 'active' : ''}`}
            onClick={() => { setCurrentPage('library'); setSelectedPlaylist(null); }}
          >
            {Icons.library}
            <span className="sidebar__nav-label">Library</span>
          </button>
          <button
            className={`sidebar__nav-item ${currentPage === 'account' && !selectedPlaylist ? 'active' : ''}`}
            onClick={() => { setCurrentPage('account'); setSelectedPlaylist(null); }}
          >
            {Icons.account}
            <span className="sidebar__nav-label">Account</span>
          </button>
        </nav>

        <div className="sidebar__divider"></div>
        <div className="sidebar__header-row">
          <div className="sidebar__section-title">Playlists</div>
          <button className="sidebar__add-btn" onClick={() => setShowCreateDialog(true)} title="Create Playlist">+</button>
        </div>

        <div className="sidebar__playlists">
          {customPlaylists.length === 0 ? (
            <div className="sidebar__empty">No playlists yet</div>
          ) : (
            customPlaylists.map(pl => (
              <button
                key={pl.id}
                className={`sidebar__playlist-item ${selectedPlaylist?.id === pl.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedPlaylist(pl);
                  setCurrentPage('library');
                }}
              >
                {Icons.playlist}
                <span className="truncate">{pl.title}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ═══ Main Content Area ═══ */}
      <main className="main" id="main">
        <div className="main__content">
          
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 20px', borderRadius: '8px', marginBottom: '24px', color: '#f87171', display: 'flex', alignItems: 'center' }}>
              <span>⚠️ {error}</span>
              <button onClick={() => setError(undefined)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
          )}

          {/* ── Playlist Details View (Intercepts regular screens) ── */}
          {selectedPlaylist ? (
            <div className="animate-in">
              <button 
                onClick={() => setSelectedPlaylist(null)} 
                className="btn btn--ghost" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '6px 12px', fontSize: '0.85rem' }}
              >
                {Icons.back} Back to Library
              </button>

              <div className="playlist-detail-banner" style={{ background: selectedPlaylist.gradient }}>
                <div className="playlist-detail-banner__overlay"></div>
                <div className="playlist-detail-banner__content">
                  <div className="playlist-detail-banner__cover" style={{ background: selectedPlaylist.gradient }}>
                    {selectedPlaylist.tracks.length > 0 ? (
                      <img src={selectedPlaylist.tracks[0].artworkUrl} alt={selectedPlaylist.title} />
                    ) : (
                      <span style={{ fontSize: '4rem' }}>🎵</span>
                    )}
                  </div>
                  <div className="playlist-detail-banner__info">
                    <span className="playlist-detail-banner__tag">Playlist</span>
                    <h1 className="playlist-detail-banner__title">{selectedPlaylist.title}</h1>
                    <p className="playlist-detail-banner__desc">{selectedPlaylist.description}</p>
                    <p className="playlist-detail-banner__meta">
                      Created on {selectedPlaylist.createdAt} · {selectedPlaylist.tracks.length} tracks
                    </p>
                    <div className="playlist-detail-banner__actions">
                      {selectedPlaylist.tracks.length > 0 && (
                        <button 
                          className="btn btn--primary" 
                          onClick={() => playTrack(selectedPlaylist.tracks[0], selectedPlaylist.tracks)}
                        >
                          {Icons.play} Play
                        </button>
                      )}
                      <button 
                        className="btn btn--danger" 
                        onClick={() => deletePlaylist(selectedPlaylist.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                      >
                        {Icons.trash} Delete Playlist
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <section className="section" style={{ marginTop: '32px' }}>
                {selectedPlaylist.tracks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-secondary)', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#fff' }}>This playlist is empty</p>
                    <p style={{ fontSize: '0.9rem', marginBottom: '16px' }}>Search and add your favorite tracks</p>
                    <button className="btn btn--primary" onClick={() => { setSelectedPlaylist(null); setCurrentPage('search'); }}>
                      Search Tracks
                    </button>
                  </div>
                ) : (
                  <div className="library-list">
                    {selectedPlaylist.tracks.map((song, i) => {
                      const isLiked = likedTracks.has(song.id);
                      const isPlayingCurrent = currentTrack.id === song.id;
                      return (
                        <div key={song.id} className="library-item animate-in">
                          <span className="library-item__index" style={{ width: '24px', color: 'var(--text-secondary)' }}>{i + 1}</span>
                          <img className="library-item__art" src={song.artworkUrl || '/icon.svg'} alt={song.title} onClick={() => playTrack(song, selectedPlaylist.tracks)} />
                          <div className="library-item__info" onClick={() => playTrack(song, selectedPlaylist.tracks)}>
                            <span className="library-item__title" style={isPlayingCurrent ? { color: 'var(--accent-pink)' } : {}}>
                              {song.title}
                            </span>
                            <span className="library-item__subtitle">
                              {song.artists.map(a => a.name).join(', ')}
                            </span>
                          </div>

                          <button
                            className="library-item__action"
                            style={{ opacity: 1, color: '#ef4444', marginRight: '8px' }}
                            onClick={() => removeTrackFromPlaylist(song.id, selectedPlaylist.id)}
                            title="Remove from playlist"
                          >
                            {Icons.trash}
                          </button>

                          <button
                            className="library-item__action"
                            style={{ opacity: 1, color: isLiked ? 'var(--accent-pink)' : 'var(--text-muted)' }}
                            onClick={() => toggleLike(song)}
                          >
                            {isLiked ? Icons.heartFilled : Icons.heart}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <>
              {/* ── Home Page ── */}
              {currentPage === 'home' && (
                <>
                  {/* cover art hero fetched dynamically */}
                  {isLoadingHome ? (
                    <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '32px' }}>
                      <span className="loader-glow" style={{ fontSize: '1.25rem' }}>Loading dynamic Spice music...</span>
                    </div>
                  ) : homeTrending.length > 0 ? (
                    <section className="hero">
                      <div className="hero__bg">
                        <img src={homeTrending[0].artworkUrl} alt="" />
                      </div>
                      <div className="hero__overlay"></div>
                      <div className="hero__content">
                        <img className="hero__art" src={homeTrending[0].artworkUrl} alt={homeTrending[0].title} />
                        <div className="hero__info">
                          <span className="hero__label">Trending Top Pick</span>
                          <h1 className="hero__title">{homeTrending[0].title}</h1>
                          <p className="hero__meta">{homeTrending[0].artists.map(a => a.name).join(', ')}</p>
                          <div className="hero__actions">
                            <button className="btn btn--primary" onClick={() => playTrack(homeTrending[0], homeTrending)}>
                              {Icons.play} Stream Now
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {/* Recently Played */}
                  {history.length > 0 && (
                    <section className="section animate-in">
                      <div className="section__header">
                        <h2 className="section__title">Recently Played</h2>
                        <button onClick={clearHistory} style={{ background: 'none', border: 'none', color: 'var(--accent-pink)', fontSize: '0.85rem', cursor: 'pointer' }}>Clear</button>
                      </div>
                      <div className="carousel-wrapper">
                        <div className="carousel">
                          {history.map((song) => (
                            <div key={song.id} className="card card--round animate-in" onClick={() => playTrack(song, history)}>
                              <div className="card__art-wrapper">
                                <img className="card__art" src={song.artworkUrl || '/icon.svg'} alt={song.title} />
                                <div className="card__play-overlay">{Icons.play}</div>
                              </div>
                              <div className="card__title truncate">{song.title}</div>
                              <div className="card__subtitle truncate">{song.artists.map(a => a.name).join(', ')}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Quick Picks (dynamic charts) */}
                  <section className="section">
                    <div className="section__header">
                      <h2 className="section__title">Quick Picks</h2>
                    </div>
                    {isLoadingHome ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                        {[...Array(6)].map((_, i) => (
                          <div key={i} style={{ height: '80px', background: 'var(--card-bg)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }}></div>
                        ))}
                      </div>
                    ) : (
                      <div className="quick-grid">
                        {homeTrending.slice(1, 7).map((song) => (
                          <div key={song.id} className="quick-card animate-in" onClick={() => playTrack(song, homeTrending)}>
                            <img className="quick-card__art" src={song.artworkUrl || '/icon.svg'} alt={song.title} />
                            <span className="quick-card__title truncate">{song.title}</span>
                            <div className="quick-card__play">{Icons.play}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Chill & Focus (dynamic charts) */}
                  <section className="section animate-in">
                    <div className="section__header">
                      <h2 className="section__title">Lofi & Chill Beats</h2>
                    </div>
                    <div className="carousel-wrapper">
                      <div className="carousel">
                        {isLoadingHome ? (
                          [...Array(4)].map((_, i) => (
                            <div key={i} style={{ width: '180px', height: '220px', background: 'var(--card-bg)', borderRadius: '12px', flexShrink: 0 }} />
                          ))
                        ) : (
                          homeChill.map((song) => (
                            <div key={song.id} className="card" onClick={() => playTrack(song, homeChill)}>
                              <div className="card__art-wrapper">
                                <img className="card__art" src={song.artworkUrl || '/icon.svg'} alt={song.title} />
                                <div className="card__play-overlay">{Icons.play}</div>
                              </div>
                              <div className="card__title truncate">{song.title}</div>
                              <div className="card__subtitle truncate">{song.artists.map(a => a.name).join(', ')}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Workout Energy (dynamic charts) */}
                  <section className="section animate-in">
                    <div className="section__header">
                      <h2 className="section__title">Workout Energy</h2>
                    </div>
                    <div className="carousel-wrapper">
                      <div className="carousel">
                        {isLoadingHome ? (
                          [...Array(4)].map((_, i) => (
                            <div key={i} style={{ width: '180px', height: '220px', background: 'var(--card-bg)', borderRadius: '12px', flexShrink: 0 }} />
                          ))
                        ) : (
                          homeEnergy.map((song) => (
                            <div key={song.id} className="card" onClick={() => playTrack(song, homeEnergy)}>
                              <div className="card__art-wrapper">
                                <img className="card__art" src={song.artworkUrl || '/icon.svg'} alt={song.title} />
                                <div className="card__play-overlay">{Icons.play}</div>
                              </div>
                              <div className="card__title truncate">{song.title}</div>
                              <div className="card__subtitle truncate">{song.artists.map(a => a.name).join(', ')}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </section>
                </>
              )}

              {/* ── Search Page ── */}
              {currentPage === 'search' && (
                <>
                  <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: 800, marginBottom: '24px' }}>Search</h1>
                  
                  <div className="search-container">
                    <div className="search-bar">
                      {Icons.search}
                      <input
                        type="text"
                        placeholder="Search tracks on YouTube Music..."
                        value={searchQuery}
                        onChange={handleSearchInput}
                        autoComplete="off"
                        autoFocus
                      />
                      {isSearching && <span className="loader-glow" style={{ fontSize: '0.85rem' }}>Searching...</span>}
                    </div>
                  </div>

                  {searchResults.length > 0 ? (
                    <section className="section animate-in">
                      <div className="section__header">
                        <h2 className="section__title">Search Results</h2>
                      </div>
                      <div className="library-list">
                        {searchResults.map((song) => {
                          const isLiked = likedTracks.has(song.id);
                          const isPlayingCurrent = currentTrack.id === song.id;
                          return (
                            <div key={song.id} className="library-item animate-in">
                              <img className="library-item__art" src={song.artworkUrl || '/icon.svg'} alt={song.title} onClick={() => playTrack(song, searchResults)} />
                              <div className="library-item__info" onClick={() => playTrack(song, searchResults)}>
                                <span className="library-item__title" style={isPlayingCurrent ? { color: 'var(--accent-pink)' } : {}}>
                                  {song.title}
                                </span>
                                <span className="library-item__subtitle">
                                  {song.artists.map(a => a.name).join(', ')} {song.durationMs ? `· ${formatTime(song.durationMs / 1000)}` : ''}
                                </span>
                              </div>
                              
                              {/* Custom Playlist Selector */}
                              {customPlaylists.length > 0 && (
                                <select 
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      addTrackToPlaylist(song, e.target.value);
                                      e.target.value = '';
                                      alert(`Added track to playlist!`);
                                    }
                                  }}
                                  style={{ background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', padding: '6px 10px', cursor: 'pointer', outline: 'none', marginRight: '8px' }}
                                >
                                  <option value="">+ Add Playlist</option>
                                  {customPlaylists.map(pl => (
                                    <option key={pl.id} value={pl.id}>{pl.title}</option>
                                  ))}
                                </select>
                              )}

                              <button
                                className="library-item__action"
                                style={{ opacity: 1, color: isLiked ? 'var(--accent-pink)' : 'var(--text-muted)' }}
                                onClick={() => toggleLike(song)}
                              >
                                {isLiked ? Icons.heartFilled : Icons.heart}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : (
                    <section className="section animate-in">
                      <div className="section__header">
                        <h2 className="section__title">Browse All Categories</h2>
                      </div>
                      <div className="genre-grid">
                        {genres.map((g, i) => (
                          <div key={i} className="genre-card animate-in" style={{ background: g.gradient }} onClick={() => {
                            setSearchQuery(g.name);
                            handleSearchInput({ target: { value: g.name } } as any);
                          }}>
                            <span className="genre-card__title">{g.name}</span>
                            <span className="genre-card__emoji">{g.emoji}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* ── Library Page ── */}
              {currentPage === 'library' && (
                <>
                  <div className="library-header animate-in">
                    <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: 800 }}>Your Library</h1>
                    <div className="library-header__actions">
                      <button className="btn btn--primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={() => setShowCreateDialog(true)}>
                        + Create Playlist
                      </button>
                      <button className={`library-view-btn ${libraryView === 'list' ? 'active' : ''}`} onClick={() => setLibraryView('list')}>
                        {Icons.list}
                      </button>
                      <button className={`library-view-btn ${libraryView === 'grid' ? 'active' : ''}`} onClick={() => setLibraryView('grid')}>
                        {Icons.grid}
                      </button>
                    </div>
                  </div>

                  <div className="chips animate-in">
                    <button className={`chip ${libraryFilter === 'playlists' ? 'active' : ''}`} onClick={() => setLibraryFilter('playlists')}>
                      Playlists
                    </button>
                    <button className={`chip ${libraryFilter === 'liked' ? 'active' : ''}`} onClick={() => setLibraryFilter('liked')}>
                      Liked Songs
                    </button>
                    <button className={`chip ${libraryFilter === 'history' ? 'active' : ''}`} onClick={() => setLibraryFilter('history')}>
                      History
                    </button>
                  </div>

                  {/* Playlists view */}
                  {libraryFilter === 'playlists' && (
                    <div className="playlist-grid animate-in">
                      {customPlaylists.length === 0 ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '64px 0', color: 'var(--text-secondary)' }}>
                          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📁</div>
                          <p style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Create your first custom playlist</p>
                          <p style={{ marginBottom: '16px' }}>Build custom compilations from YouTube Music streams</p>
                          <button className="btn btn--primary" onClick={() => setShowCreateDialog(true)}>Create Playlist</button>
                        </div>
                      ) : (
                        customPlaylists.map((pl) => (
                          <div key={pl.id} className="playlist-card animate-in" onClick={() => setSelectedPlaylist(pl)}>
                            <div className="playlist-card__bg" style={{ background: pl.gradient }}></div>
                            <div className="playlist-card__overlay"></div>
                            <div className="playlist-card__info">
                              <h3 className="playlist-card__title truncate">{pl.title}</h3>
                              <p className="playlist-card__desc">{pl.tracks.length} songs</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Liked songs view */}
                  {libraryFilter === 'liked' && (
                    <div className="library-list animate-in">
                      {getLikedTracksList().length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-secondary)' }}>
                          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>💜</div>
                          <p style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Songs you like will appear here</p>
                          <p>Tap the heart icon next to any search results to save tracks</p>
                        </div>
                      ) : (
                        getLikedTracksList().map((song) => {
                          const isPlayingCurrent = currentTrack.id === song.id;
                          return (
                            <div key={song.id} className="library-item animate-in" onClick={() => playTrack(song, getLikedTracksList())}>
                              <img className="library-item__art" src={song.artworkUrl || '/icon.svg'} alt={song.title} />
                              <div className="library-item__info">
                                <span className="library-item__title" style={isPlayingCurrent ? { color: 'var(--accent-pink)' } : {}}>
                                  {song.title}
                                </span>
                                <span className="library-item__subtitle">
                                  {song.artists.map(a => a.name).join(', ')}
                                </span>
                              </div>
                              <button
                                className="library-item__action"
                                style={{ opacity: 1, color: 'var(--accent-pink)' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLike(song);
                                }}
                              >
                                {Icons.heartFilled}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Playback History view */}
                  {libraryFilter === 'history' && (
                    <div className="library-list animate-in">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Recently Played Tracks</span>
                        {history.length > 0 && (
                          <button className="btn btn--ghost" onClick={clearHistory} style={{ fontSize: '0.8rem', padding: '6px 12px', border: '1px solid var(--border-color)' }}>
                            Clear History
                          </button>
                        )}
                      </div>

                      {history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-secondary)' }}>
                          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🕒</div>
                          <p style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>No playback history yet</p>
                          <p>Tracks you listen to will be preserved locally in chronological order</p>
                        </div>
                      ) : (
                        history.map((song) => {
                          const isPlayingCurrent = currentTrack.id === song.id;
                          return (
                            <div key={song.id} className="library-item animate-in" onClick={() => playTrack(song, history)}>
                              <img className="library-item__art" src={song.artworkUrl || '/icon.svg'} alt={song.title} />
                              <div className="library-item__info">
                                <span className="library-item__title" style={isPlayingCurrent ? { color: 'var(--accent-pink)' } : {}}>
                                  {song.title}
                                </span>
                                <span className="library-item__subtitle">
                                  {song.artists.map(a => a.name).join(', ')}
                                </span>
                              </div>
                              {customPlaylists.length > 0 && (
                                <select 
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      addTrackToPlaylist(song, e.target.value);
                                      e.target.value = '';
                                      alert(`Added track to playlist!`);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', padding: '6px 10px', cursor: 'pointer', outline: 'none', marginRight: '8px' }}
                                >
                                  <option value="">+ Add Playlist</option>
                                  {customPlaylists.map(pl => (
                                    <option key={pl.id} value={pl.id}>{pl.title}</option>
                                  ))}
                                </select>
                              )}
                              <button
                                className="library-item__action"
                                style={{ opacity: 1, color: likedTracks.has(song.id) ? 'var(--accent-pink)' : 'var(--text-muted)' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLike(song);
                                }}
                              >
                                {likedTracks.has(song.id) ? Icons.heartFilled : Icons.heart}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Account/Profile Page ── */}
              {currentPage === 'account' && (
                <div className="animate-in" style={{ maxWidth: '640px', margin: '0 auto' }}>
                  <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: 800, marginBottom: '24px' }}>Profile Settings</h1>

                  {/* Sleek dynamic gradient avatar card */}
                  <div className="profile-card animate-in" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div 
                      style={{ width: '80px', height: '80px', borderRadius: '50%', background: profile.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 900, color: '#fff', textShadow: '0 4px 12px rgba(0,0,0,0.3)', flexShrink: 0 }}
                    >
                      {profile.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px 0', fontFamily: 'Outfit, sans-serif' }}>{profile.displayName}</h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 12px 0' }}>{profile.bio}</p>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '12px' }}>
                        Member since {profile.joinedAt}
                      </span>
                    </div>
                  </div>

                  {/* Playback statistics */}
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', fontFamily: 'Outfit, sans-serif' }}>Analytics & Stats</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' }}>
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-pink)', marginBottom: '4px' }}>
                        {profile.songsPlayed}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Songs Played</div>
                    </div>
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-purple)', marginBottom: '4px' }}>
                        {likedTracks.size}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Favorites</div>
                    </div>
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', marginBottom: '4px' }}>
                        {customPlaylists.length}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Playlists</div>
                    </div>
                  </div>

                  {/* Edit profile dialog/form */}
                  {isEditingProfile ? (
                    <form onSubmit={saveProfile} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '24px', borderRadius: '16px' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', fontFamily: 'Outfit, sans-serif' }}>Update Account Information</h3>
                      
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Display Name</label>
                        <input 
                          type="text" 
                          value={editName} 
                          onChange={(e) => setEditName(e.target.value)} 
                          placeholder="Your spicy name..."
                          style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                          required
                        />
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Short Biography</label>
                        <textarea 
                          value={editBio} 
                          onChange={(e) => setEditBio(e.target.value)} 
                          placeholder="Tell the community about your audio taste..."
                          style={{ width: '100%', height: '80px', padding: '10px 14px', background: '#0a0a0a', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', outline: 'none', resize: 'none' }}
                        />
                      </div>

                      <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>Theme Avatar Gradient</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          {PRESET_GRADIENTS.map((g, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setEditGradient(g)}
                              style={{ width: '32px', height: '32px', borderRadius: '50%', background: g, border: editGradient === g ? '2px solid #fff' : 'none', cursor: 'pointer', outline: 'none', boxShadow: editGradient === g ? '0 0 10px rgba(255,255,255,0.4)' : 'none' }}
                            />
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn--ghost" onClick={() => setIsEditingProfile(false)}>Cancel</button>
                        <button type="submit" className="btn btn--primary">Save Changes</button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '24px', borderRadius: '16px', textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>Customizations remain secure and saved inside your browser session.</p>
                      <button className="btn btn--primary" onClick={() => {
                        setEditName(profile.displayName);
                        setEditBio(profile.bio);
                        setEditGradient(profile.gradient);
                        setIsEditingProfile(true);
                      }}>
                        Edit Profile Details
                      </button>
                    </div>
                  )}

                  {/* Mock server sync */}
                  <div style={{ background: 'rgba(168, 85, 247, 0.04)', border: '1px solid rgba(168, 85, 247, 0.1)', borderRadius: '16px', padding: '24px', marginTop: '32px' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 8px 0', fontFamily: 'Outfit, sans-serif', color: 'var(--accent-pink)' }}>Cloud Account Synchronization</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                      Spice standardizes accounts locally first. Phase 4 synchronizations let you connect a closed-source secure Spice Server database to backup playlists, favorites, and history.
                    </p>
                    <button className="btn btn--ghost" disabled style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', cursor: 'not-allowed', color: 'var(--text-muted)' }}>
                      Connect Database (Locked)
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </main>

      {/* ═══ Create Custom Playlist Dialog ═══ */}
      {showCreateDialog && (
        <div className="dialog-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <h2>Create Playlist</h2>
            <form onSubmit={createPlaylist}>
              <label style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Playlist Name</label>
              <input
                type="text"
                value={newPlTitle}
                onChange={(e) => setNewPlTitle(e.target.value)}
                placeholder="Spicy selection..."
                required
                autoFocus
              />
              <label style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Description (optional)</label>
              <input
                type="text"
                value={newPlDesc}
                onChange={(e) => setNewPlDesc(e.target.value)}
                placeholder="Late night vibe compiles..."
              />
              <div className="dialog-box__actions">
                <button type="button" className="btn btn--ghost" style={{ padding: '8px 16px' }} onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" style={{ padding: '8px 16px' }}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Now Playing Bar Panel ═══ */}
      <footer className="now-playing">
        {/* Left: playback controls */}
        <div className="now-playing__left-controls">
          <button className="now-playing__btn" onClick={handlePrev} aria-label="Previous">
            {Icons.prev}
          </button>
          <button className="now-playing__btn now-playing__btn--play" onClick={togglePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? Icons.pause : Icons.play}
          </button>
          <button className="now-playing__btn" onClick={handleNext} aria-label="Next">
            {Icons.next}
          </button>
          <button
            className={`now-playing__like ${likedTracks.has(currentTrack.id) ? 'liked' : ''}`}
            onClick={() => toggleLike(currentTrack)}
            aria-label="Like"
          >
            {likedTracks.has(currentTrack.id) ? Icons.heartFilled : Icons.heart}
          </button>
        </div>

        {/* Center: song info & seek slider */}
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, width: '100%' }}>
          <div className="now-playing__song">
            <img className="now-playing__art" src={currentTrack.artworkUrl || '/icon.svg'} alt={currentTrack.title} />
            <div className="now-playing__info">
              <span className="now-playing__title truncate">{currentTrack.title}</span>
              <span className="now-playing__artist truncate">{currentTrack.artists.map(a => a.name).join(', ')}</span>
            </div>
            
            {/* Animative waveform */}
            <div className={`now-playing__waveform ${!isPlaying ? 'paused' : ''}`}>
              <div className="now-playing__waveform-bar"></div>
              <div className="now-playing__waveform-bar"></div>
              <div className="now-playing__waveform-bar"></div>
              <div className="now-playing__waveform-bar"></div>
              <div className="now-playing__waveform-bar"></div>
            </div>
          </div>

          <div className="now-playing__seek">
            <span>{formatTime(progress)}</span>
            <div className="now-playing__seek-track" onClick={handleSeek}>
              <div
                className="now-playing__progress-fill"
                style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
              ></div>
            </div>
            <span>{formatTime(duration)}</span>
            {isLoadingStream && <span className="loader-glow">Resolving stream...</span>}
          </div>
        </div>

        {/* Right: volume controls */}
        <div className="now-playing__right-controls">
          <div className="now-playing__volume">
            <button className="now-playing__volume-btn" onClick={() => setVolume(volume === 0 ? 70 : 0)}>
              {Icons.volume}
            </button>
            <input
              type="range"
              className="now-playing__volume-slider"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
