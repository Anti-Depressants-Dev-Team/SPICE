import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:source_api/source_api.dart';
import 'package:source_youtube/source_youtube.dart';

/// The active [MusicSource]. For Phase 1 this is hardcoded to YT Music's
/// native adapter; later phases will swap in [YtMusicWebSource] on web (`kIsWeb`)
/// and let the user pick between sources from settings.
final musicSourceProvider = Provider<MusicSource>((ref) {
  return YtMusicNativeSource();
});
