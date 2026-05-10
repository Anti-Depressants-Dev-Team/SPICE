import 'dart:convert';
import 'dart:io' as io;

import 'package:http/http.dart' as http;
import 'package:source_api/source_api.dart';
import 'package:youtube_explode_dart/youtube_explode_dart.dart' as yt;

/// YT Music adapter that runs directly on the device (Android / Windows / Linux).
///
/// Two layers:
///
/// - **Search**: hits YouTube's InnerTube API directly (`/youtubei/v1/search`).
///   `youtube_explode_dart` 3.1.0's [yt.SearchClient] is broken on current YT
///   responses — it calls a Map extension method through a `dynamic` receiver
///   in `search_page.dart`, which dies at runtime with a `NoSuchMethodError`
///   on `getT<String>("text")`. Our own InnerTube call sidesteps that.
/// - **Stream resolution**: still uses the library, since `videos.streams.getManifest`
///   parses the player response (different code path) and works.
///
/// HTTP details:
/// - [io.HttpClientRequest.maxRedirects] is bumped to 20 so EU consent
///   chains can't trip Dart's default of 5.
/// - A `Cookie` header (`SOCS=CAI; CONSENT=YES+1; PREF=hl=en&tz=UTC`) is
///   injected to short-circuit Google's consent funnel and avoid a redirect
///   loop between `youtube.com` and `consent.youtube.com`.
/// - `getManifest` is asked for `ios` + `androidVr` clients — no PO Token,
///   no consent funnel, and `androidVr` provides high-bitrate audio.
class YtMusicNativeSource implements MusicSource {
  YtMusicNativeSource({http.Client? httpClient})
      : _http = httpClient ?? _MaxRedirectsClient() {
    _yt = yt.YoutubeExplode(httpClient: yt.YoutubeHttpClient(_http));
  }

  final http.Client _http;
  late final yt.YoutubeExplode _yt;

  /// Track metadata harvested from search results. [getTrack] consults this
  /// before falling back to the watch-page scrape, which YouTube rate-limits
  /// aggressively (`RequestLimitExceededException` on `/watch?v=...`). For the
  /// tap-search-result-to-play flow, the entry will always be hot, so the
  /// expensive request never fires.
  final Map<String, Track> _trackCache = {};

  /// Stream-manifest API clients tried in sequence, with results merged.
  ///
  /// Narrowed to two known-playable clients: `androidVr` serves high-bitrate
  /// audio without a PO Token, `ios` provides pre-decoded URLs that don't
  /// require signature decoding. The wider net (`androidMusic`,
  /// `mediaConnect`, etc.) returned URLs that ExoPlayer rejected as
  /// "source error 0" — they need either a matching User-Agent we can't
  /// always provide, or signature decoding that needs the watch page (which
  /// itself rate-limits).
  ///
  /// `tv` is the "bypass restrictions" client per the docs but requires a JS
  /// challenge solver (Deno subprocess), which can't run on Android.
  static final _streamClients = [
    yt.YoutubeApiClient.androidVr,
    yt.YoutubeApiClient.ios,
  ];

  static final _innertubeSearchUrl =
      Uri.parse('https://www.youtube.com/youtubei/v1/search?prettyPrint=false');

  static const _innertubeContext = {
    'context': {
      'client': {
        'clientName': 'WEB',
        'clientVersion': '2.20240101.00.00',
        'hl': 'en',
        'gl': 'US',
      },
    },
  };

  @override
  String get id => 'youtube_music';

  @override
  String get displayName => 'YouTube Music';

  @override
  Set<SourceCapability> get capabilities => const {
        SourceCapability.search,
        SourceCapability.streaming,
        SourceCapability.recommendations,
        SourceCapability.userLibrary,
      };

  @override
  Future<SearchResults> search(
    String query, {
    SearchKind kind = SearchKind.all,
    int limit = 20,
  }) async {
    if (query.trim().isEmpty) return const SearchResults();

    final response = await _http.post(
      _innertubeSearchUrl,
      headers: const {'content-type': 'application/json'},
      body: json.encode({
        ..._innertubeContext,
        'query': query,
        // Type=Video filter (param value is stable; equivalent to picking
        // the "Videos" tab in the YouTube search UI).
        'params': 'EgIQAQ%3D%3D',
      }),
    );

    if (response.statusCode != 200) {
      throw http.ClientException(
        'InnerTube search returned ${response.statusCode}',
        _innertubeSearchUrl,
      );
    }

    final body = json.decode(response.body);
    final tracks = <Track>[];
    for (final renderer in _walkVideoRenderers(body)) {
      if (tracks.length >= limit) break;
      final track = _parseVideoRenderer(renderer);
      if (track != null) {
        tracks.add(track);
        _trackCache[track.id] = track;
      }
    }
    return SearchResults(tracks: tracks);
  }

  @override
  Future<TrackDetails> getTrack(String trackId) async {
    final manifest = await _yt.videos.streams.getManifest(
      trackId,
      ytClients: _streamClients,
      // `ios`/`androidVr` serve pre-decoded URLs, so the watch-page scrape
      // (used for JS signature deciphering) is unnecessary. Skipping it
      // avoids YouTube's `/watch?v=...` rate limit, which is what was
      // throwing `RequestLimitExceededException` on every track tap.
      requireWatchPage: false,
    );

    // Prefer m4a/mp4 (AAC) over webm/opus — the AAC family is more reliably
    // decoded across Android device versions. Within each family, sort by
    // descending bitrate so playTrackDetails picks the best variant.
    final ranked = manifest.audioOnly.toList()
      ..sort((a, b) {
        final aIsAac = _isAacFamily(a.container.name);
        final bIsAac = _isAacFamily(b.container.name);
        if (aIsAac != bIsAac) return aIsAac ? -1 : 1;
        return b.bitrate.bitsPerSecond.compareTo(a.bitrate.bitsPerSecond);
      });

    final streams = ranked
        .map((s) => StreamVariant(
              url: s.url,
              codec: s.audioCodec,
              bitrate: s.bitrate.bitsPerSecond,
              container: s.container.name,
            ))
        .toList();

    final track = _trackCache[trackId] ?? await _fetchTrackMetadata(trackId);
    return TrackDetails(track: track, streams: streams);
  }

  /// Last-resort metadata fetch for ids we didn't see in a recent search.
  /// Hits the watch page, which YouTube rate-limits — keep this off the hot path.
  Future<Track> _fetchTrackMetadata(String trackId) async {
    final video = await _yt.videos.get(trackId);
    return Track(
      sourceId: id,
      id: video.id.value,
      title: video.title,
      artists: [Artist(id: video.author, name: video.author)],
      durationMs: video.duration?.inMilliseconds,
      artworkUrl: video.thumbnails.highResUrl,
    );
  }

  @override
  Future<List<Track>> getPlaylist(String playlistId) async {
    final videos = await _yt.playlists.getVideos(playlistId).toList();
    return videos
        .map((v) => Track(
              sourceId: id,
              id: v.id.value,
              title: v.title,
              artists: [Artist(id: v.author, name: v.author)],
              durationMs: v.duration?.inMilliseconds,
              artworkUrl: v.thumbnails.highResUrl,
            ))
        .toList();
  }

  static bool _isAacFamily(String containerName) {
    final c = containerName.toLowerCase();
    return c == 'mp4' || c == 'm4a';
  }

  void close() {
    _yt.close();
  }

  /// Maps an exception thrown by [search] / [getTrack] / [getPlaylist] to a
  /// short user-facing message. Lives here (not in the app) so the app
  /// doesn't have to depend on `youtube_explode_dart` directly.
  static String friendlyMessage(Object error) {
    if (error is yt.VideoUnplayableException) {
      return 'YouTube blocked this video on the clients we can use. '
          'Try another result.';
    }
    if (error is yt.RequestLimitExceededException) {
      return 'YouTube is rate-limiting. Wait a minute and try again.';
    }
    if (error is yt.VideoUnavailableException) {
      return 'This video is unavailable.';
    }
    // Unknown error type — surface the first line of `toString()` so we don't
    // have to dig through the console to find out what broke.
    final firstLine = error.toString().split('\n').first.trim();
    final truncated =
        firstLine.length > 140 ? '${firstLine.substring(0, 140)}…' : firstLine;
    return "Couldn't play: $truncated";
  }

  // ── InnerTube response parsing ─────────────────────────────────────────────

  /// Walks the InnerTube response and yields every `videoRenderer` payload it
  /// finds. The response shape isn't stable enough to address by path; a
  /// recursive walk is more resilient to YT shuffling things around.
  Iterable<Map<String, dynamic>> _walkVideoRenderers(dynamic node) sync* {
    if (node is Map<String, dynamic>) {
      final vr = node['videoRenderer'];
      if (vr is Map<String, dynamic>) yield vr;
      for (final value in node.values) {
        yield* _walkVideoRenderers(value);
      }
    } else if (node is List) {
      for (final item in node) {
        yield* _walkVideoRenderers(item);
      }
    }
  }

  Track? _parseVideoRenderer(Map<String, dynamic> r) {
    final videoId = r['videoId'];
    if (videoId is! String) return null;

    final title = _firstRunText(r['title']) ?? _simpleText(r['title']);
    if (title == null || title.isEmpty) return null;

    final author = _firstRunText(r['longBylineText']) ??
        _firstRunText(r['shortBylineText']) ??
        _firstRunText(r['ownerText']) ??
        '';

    final lengthText = _simpleText(r['lengthText']);
    final duration = lengthText == null ? null : _parseLength(lengthText);

    return Track(
      sourceId: id,
      id: videoId,
      title: title,
      artists: author.isEmpty ? const [] : [Artist(id: author, name: author)],
      durationMs: duration?.inMilliseconds,
      artworkUrl: 'https://i.ytimg.com/vi/$videoId/hqdefault.jpg',
    );
  }

  String? _firstRunText(dynamic node) {
    if (node is Map<String, dynamic>) {
      final runs = node['runs'];
      if (runs is List && runs.isNotEmpty) {
        final first = runs.first;
        if (first is Map<String, dynamic>) {
          final text = first['text'];
          if (text is String) return text;
        }
      }
    }
    return null;
  }

  String? _simpleText(dynamic node) {
    if (node is Map<String, dynamic>) {
      final text = node['simpleText'];
      if (text is String) return text;
    }
    return null;
  }

  /// Parses YouTube's `lengthText` (`"3:33"` or `"1:02:45"`) into a [Duration].
  Duration? _parseLength(String s) {
    final parts = s.split(':');
    final ints = parts.map(int.tryParse).toList();
    if (ints.any((p) => p == null)) return null;
    return switch (ints.length) {
      2 => Duration(minutes: ints[0]!, seconds: ints[1]!),
      3 => Duration(hours: ints[0]!, minutes: ints[1]!, seconds: ints[2]!),
      _ => null,
    };
  }
}

/// `package:http` Client that:
///
/// 1. Bumps [io.HttpClientRequest.maxRedirects] so EU consent chains can't
///    trip Dart's default of 5.
/// 2. Injects a `Cookie` header that short-circuits Google's EU consent flow.
///    Without it, requests bounce in a *loop* between `youtube.com` and
///    `consent.youtube.com` — `SOCS=CAI` signals "consent already handled".
class _MaxRedirectsClient extends http.BaseClient {
  _MaxRedirectsClient();

  static const int _maxRedirects = 20;
  static const String _consentCookie =
      'SOCS=CAI; CONSENT=YES+1; PREF=hl=en&tz=UTC';

  final io.HttpClient _client = io.HttpClient();

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final ioRequest = await _client.openUrl(request.method, request.url);
    ioRequest
      ..followRedirects = request.followRedirects
      ..maxRedirects = _maxRedirects
      ..persistentConnection = request.persistentConnection;

    request.headers.forEach(ioRequest.headers.set);

    final existingCookie = request.headers['cookie'];
    final mergedCookie = existingCookie == null || existingCookie.isEmpty
        ? _consentCookie
        : '$existingCookie; $_consentCookie';
    ioRequest.headers.set('cookie', mergedCookie);

    if (request.contentLength != null) {
      ioRequest.contentLength = request.contentLength!;
    }

    final bodyBytes = await request.finalize().toBytes();
    if (bodyBytes.isNotEmpty) {
      ioRequest.add(bodyBytes);
    }

    final ioResponse = await ioRequest.close();

    final headers = <String, String>{};
    ioResponse.headers.forEach((name, values) {
      headers[name] = values.join(',');
    });

    return http.StreamedResponse(
      ioResponse,
      ioResponse.statusCode,
      contentLength:
          ioResponse.contentLength == -1 ? null : ioResponse.contentLength,
      request: request,
      headers: headers,
      isRedirect: ioResponse.isRedirect,
      persistentConnection: ioResponse.persistentConnection,
      reasonPhrase: ioResponse.reasonPhrase,
    );
  }

  @override
  void close() {
    _client.close(force: true);
    super.close();
  }
}
