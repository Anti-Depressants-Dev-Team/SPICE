/// YouTube Music adapter implementing [MusicSource] for Spice.
///
/// Native platforms (Android, Windows, Linux) call [YtMusicNativeSource], which
/// talks directly to YouTube's InnerTube API via [youtube_explode_dart] plus an
/// in-house wrapper for YT Music–specific endpoints. The web adapter lives in
/// the Flutter client (it routes through the Spice backend).
library;

export 'src/innertube_client.dart';
export 'src/yt_music_native_source.dart';
