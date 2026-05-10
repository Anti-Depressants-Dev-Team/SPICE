/// Thin wrapper around YouTube's internal InnerTube API for YT Music endpoints.
///
/// The shipped library `youtube_explode_dart` handles plain YouTube video
/// resolution and signature deciphering. YT Music–specific endpoints
/// (`browse`, `search`, `next`, `get_library`, ...) require the `WEB_REMIX`
/// client context — that's what this class will own.
///
/// Phase 0: stub. Real implementation lands in Phase 1 alongside
/// [YtMusicNativeSource.search].
class InnertubeClient {
  InnertubeClient({this.clientName = 'WEB_REMIX', this.clientVersion = '1.20240101.00.00'});

  final String clientName;
  final String clientVersion;

  Future<Map<String, dynamic>> browse(String browseId, {Map<String, dynamic>? params}) {
    throw UnimplementedError('Phase 1');
  }

  Future<Map<String, dynamic>> search(String query, {String? params}) {
    throw UnimplementedError('Phase 1');
  }

  Future<Map<String, dynamic>> next(String videoId) {
    throw UnimplementedError('Phase 1');
  }
}
