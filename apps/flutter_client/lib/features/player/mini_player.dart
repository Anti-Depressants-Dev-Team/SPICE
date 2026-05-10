import 'package:audio_service/audio_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../services/audio/audio_providers.dart';
import '../../services/audio/spice_audio_handler.dart';

class MiniPlayer extends ConsumerWidget {
  const MiniPlayer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final handlerAsync = ref.watch(audioHandlerProvider);
    return handlerAsync.maybeWhen(
      data: (handler) => _LoadedMiniPlayer(handler: handler),
      orElse: () => const SizedBox.shrink(),
    );
  }
}

class _LoadedMiniPlayer extends StatelessWidget {
  const _LoadedMiniPlayer({required this.handler});

  final SpiceAudioHandler handler;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<MediaItem?>(
      stream: handler.mediaItem,
      builder: (context, mediaSnap) {
        final media = mediaSnap.data;
        if (media == null) return const SizedBox.shrink();
        return Material(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          elevation: 4,
          child: InkWell(
            onTap: () => context.push('/player'),
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _ProgressStrip(handler: handler),
                  StreamBuilder<PlaybackState>(
                    stream: handler.playbackState,
                    builder: (context, stateSnap) {
                      final state = stateSnap.data;
                      final playing = state?.playing ?? false;
                      final loading = state?.processingState ==
                              AudioProcessingState.loading ||
                          state?.processingState ==
                              AudioProcessingState.buffering;
                      return Padding(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        child: Row(
                          children: [
                            _Artwork(media: media),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    media.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style:
                                        Theme.of(context).textTheme.bodyMedium,
                                  ),
                                  Text(
                                    media.artist ?? '',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurfaceVariant,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              tooltip: 'Previous',
                              icon: const Icon(Icons.skip_previous),
                              onPressed: handler.skipToPrevious,
                            ),
                            IconButton(
                              tooltip: playing ? 'Pause' : 'Play',
                              icon: loading
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    )
                                  : Icon(playing
                                      ? Icons.pause
                                      : Icons.play_arrow),
                              onPressed: loading
                                  ? null
                                  : (playing ? handler.pause : handler.play),
                            ),
                            IconButton(
                              tooltip: 'Next',
                              icon: const Icon(Icons.skip_next),
                              onPressed: handler.skipToNext,
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Artwork extends StatelessWidget {
  const _Artwork({required this.media});
  final MediaItem media;

  @override
  Widget build(BuildContext context) {
    if (media.artUri == null) {
      return const SizedBox(
        width: 44,
        height: 44,
        child: Icon(Icons.music_note),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: Image.network(
        media.artUri.toString(),
        width: 44,
        height: 44,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => const Icon(Icons.music_note),
      ),
    );
  }
}

/// Thin draggable position slider above the mini-player row.
class _ProgressStrip extends StatelessWidget {
  const _ProgressStrip({required this.handler});

  final SpiceAudioHandler handler;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<MediaItem?>(
      stream: handler.mediaItem,
      builder: (context, mediaSnap) {
        final duration = mediaSnap.data?.duration ?? Duration.zero;
        return StreamBuilder<Duration>(
          stream: handler.positionStream,
          builder: (context, posSnap) {
            final position = posSnap.data ?? Duration.zero;
            final clamped = position > duration ? duration : position;
            final max = duration.inMilliseconds.toDouble();
            return SliderTheme(
              data: SliderTheme.of(context).copyWith(
                trackHeight: 2,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 4),
                overlayShape:
                    const RoundSliderOverlayShape(overlayRadius: 12),
              ),
              child: Slider(
                value: max == 0
                    ? 0
                    : clamped.inMilliseconds.clamp(0, max).toDouble(),
                max: max == 0 ? 1 : max,
                onChanged: max == 0
                    ? null
                    : (v) =>
                        handler.seek(Duration(milliseconds: v.toInt())),
              ),
            );
          },
        );
      },
    );
  }
}
