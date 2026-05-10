/// Offline-first sync against the Spice backend.
///
/// Phase 0: skeleton. Phase 4 implements push/pull of playlists, likes, and
/// listening history; conflict resolution is `updated_at` last-write-wins.
class SyncService {
  Future<void> push() async {
    throw UnimplementedError('Phase 4');
  }

  Future<void> pull() async {
    throw UnimplementedError('Phase 4');
  }
}
