import 'package:audio_service/audio_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'spice_audio_handler.dart';

/// Resolves to the singleton [SpiceAudioHandler] once `audio_service` has
/// finished platform-side init. Reading via `ref.read(...future)` only blocks
/// the first time — subsequent reads are instant.
final audioHandlerProvider = FutureProvider<SpiceAudioHandler>((ref) async {
  final handler = await AudioService.init<SpiceAudioHandler>(
    builder: SpiceAudioHandler.new,
    config: const AudioServiceConfig(
      androidNotificationChannelId: 'com.spice.channel.audio',
      androidNotificationChannelName: 'Spice playback',
      androidNotificationOngoing: true,
      androidStopForegroundOnPause: true,
    ),
  );
  return handler;
});
