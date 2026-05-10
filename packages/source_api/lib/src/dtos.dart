import 'package:meta/meta.dart';

enum SearchKind { all, tracks, albums, artists, playlists }

@immutable
class Artist {
  const Artist({
    required this.id,
    required this.name,
    this.artworkUrl,
  });

  final String id;
  final String name;
  final String? artworkUrl;
}

@immutable
class Album {
  const Album({
    required this.id,
    required this.title,
    this.artists = const [],
    this.artworkUrl,
    this.year,
  });

  final String id;
  final String title;
  final List<Artist> artists;
  final String? artworkUrl;
  final int? year;
}

@immutable
class Track {
  const Track({
    required this.sourceId,
    required this.id,
    required this.title,
    required this.artists,
    this.album,
    this.durationMs,
    this.artworkUrl,
  });

  /// The [MusicSource.id] this track came from. Required for correct routing
  /// when a queue mixes tracks across sources.
  final String sourceId;
  final String id;
  final String title;
  final List<Artist> artists;
  final Album? album;
  final int? durationMs;
  final String? artworkUrl;
}

@immutable
class PlaylistRef {
  const PlaylistRef({
    required this.id,
    required this.title,
    this.artworkUrl,
    this.trackCount,
  });

  final String id;
  final String title;
  final String? artworkUrl;
  final int? trackCount;
}

/// One playable rendition of a track. A source may return several (different
/// codecs / bitrates) so the player can pick what suits the platform.
@immutable
class StreamVariant {
  const StreamVariant({
    required this.url,
    required this.codec,
    required this.bitrate,
    required this.container,
    this.expiresAt,
  });

  final Uri url;
  final String codec;       // e.g. 'opus', 'mp4a.40.2'
  final int bitrate;        // bits per second
  final String container;   // e.g. 'webm', 'm4a'
  final DateTime? expiresAt;
}

@immutable
class TrackDetails {
  const TrackDetails({
    required this.track,
    required this.streams,
  });

  final Track track;
  final List<StreamVariant> streams;
}

@immutable
class SearchResults {
  const SearchResults({
    this.tracks = const [],
    this.albums = const [],
    this.artists = const [],
    this.playlists = const [],
  });

  final List<Track> tracks;
  final List<Album> albums;
  final List<Artist> artists;
  final List<PlaylistRef> playlists;
}
