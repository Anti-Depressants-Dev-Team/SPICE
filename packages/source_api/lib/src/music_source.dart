import 'capability.dart';
import 'dtos.dart';

/// A pluggable music backend.
///
/// Adapters implement this directly and declare their [capabilities]. UI code
/// branches on capabilities rather than checking concrete types — that keeps
/// the abstraction honest as new sources land.
abstract interface class MusicSource {
  String get id;
  String get displayName;
  Set<SourceCapability> get capabilities;

  Future<SearchResults> search(
    String query, {
    SearchKind kind = SearchKind.all,
    int limit = 20,
  });

  /// Returns the track plus its currently-resolvable [StreamVariant]s.
  /// Variants may carry short TTLs, so resolve close to playback time.
  Future<TrackDetails> getTrack(String trackId);

  Future<List<Track>> getPlaylist(String playlistId);
}

/// Optional sub-interface. Implemented by sources that can read a signed-in
/// user's library (e.g. YouTube Music after Google OAuth).
abstract interface class UserLibrarySource {
  Future<List<Track>> getLikedTracks();
  Future<List<PlaylistRef>> getUserPlaylists();
}
