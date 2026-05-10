import 'package:audio_service/audio_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/audio/audio_providers.dart';
import '../../services/audio/spice_audio_handler.dart';

class NowPlayingScreen extends ConsumerWidget {
  const NowPlayingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final handlerAsync = ref.watch(audioHandlerProvider);
    return handlerAsync.maybeWhen(
      data: (handler) => _NowPlayingBody(handler: handler),
      orElse: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

class _NowPlayingBody extends StatelessWidget {
  const _NowPlayingBody({required this.handler});
  final SpiceAudioHandler handler;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Close',
          icon: const Icon(Icons.expand_more),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Now playing'),
      ),
      body: StreamBuilder<MediaItem?>(
        stream: handler.mediaItem,
        builder: (context, mediaSnap) {
          final media = mediaSnap.data;
          if (media == null) {
            return const Center(child: Text('Nothing playing'));
          }
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: [
                  const Spacer(flex: 1),
                  _BigArtwork(media: media),
                  const Spacer(flex: 1),
                  Text(
                    media.title,
                    style: Theme.of(context).textTheme.headlineSmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    media.artist ?? '',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurfaceVariant,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 24),
                  _PositionSlider(handler: handler, duration: media.duration),
                  const SizedBox(height: 16),
                  _ControlsRow(handler: handler),
                  const SizedBox(height: 16),
                  _ModesRow(handler: handler),
                  const Spacer(flex: 2),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _BigArtwork extends StatelessWidget {
  const _BigArtwork({required this.media});
  final MediaItem media;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: media.artUri != null
            ? Image.network(
                media.artUri.toString(),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const ColoredBox(
                  color: Colors.black26,
                  child: Center(child: Icon(Icons.music_note, size: 64)),
                ),
              )
            : const ColoredBox(
                color: Colors.black26,
                child: Center(child: Icon(Icons.music_note, size: 64)),
              ),
      ),
    );
  }
}

class _PositionSlider extends StatelessWidget {
  const _PositionSlider({required this.handler, required this.duration});
  final SpiceAudioHandler handler;
  final Duration? duration;

  @override
  Widget build(BuildContext context) {
    final total = duration ?? Duration.zero;
    return StreamBuilder<Duration>(
      stream: handler.positionStream,
      builder: (context, snap) {
        final position = snap.data ?? Duration.zero;
        final max = total.inMilliseconds.toDouble();
        final clamped = position > total ? total : position;
        return Column(
          children: [
            Slider(
              value: max == 0
                  ? 0
                  : clamped.inMilliseconds.clamp(0, max).toDouble(),
              max: max == 0 ? 1 : max,
              onChanged: max == 0
                  ? null
                  : (v) => handler.seek(Duration(milliseconds: v.toInt())),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(_fmt(clamped),
                      style: Theme.of(context).textTheme.bodySmall),
                  Text(_fmt(total),
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  static String _fmt(Duration d) {
    if (d.inHours > 0) {
      final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
      final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
      return '${d.inHours}:$m:$s';
    }
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '${d.inMinutes}:$s';
  }
}

class _ControlsRow extends StatelessWidget {
  const _ControlsRow({required this.handler});
  final SpiceAudioHandler handler;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<PlaybackState>(
      stream: handler.playbackState,
      builder: (context, snap) {
        final state = snap.data;
        final playing = state?.playing ?? false;
        final loading = state?.processingState ==
                AudioProcessingState.loading ||
            state?.processingState == AudioProcessingState.buffering;
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            IconButton(
              iconSize: 36,
              tooltip: 'Previous',
              icon: const Icon(Icons.skip_previous),
              onPressed: handler.skipToPrevious,
            ),
            FilledButton(
              onPressed: loading
                  ? null
                  : (playing ? handler.pause : handler.play),
              style: FilledButton.styleFrom(
                shape: const CircleBorder(),
                padding: const EdgeInsets.all(20),
              ),
              child: loading
                  ? const SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  : Icon(playing ? Icons.pause : Icons.play_arrow, size: 32),
            ),
            IconButton(
              iconSize: 36,
              tooltip: 'Next',
              icon: const Icon(Icons.skip_next),
              onPressed: handler.skipToNext,
            ),
          ],
        );
      },
    );
  }
}

class _ModesRow extends StatelessWidget {
  const _ModesRow({required this.handler});
  final SpiceAudioHandler handler;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<PlaybackState>(
      stream: handler.playbackState,
      builder: (context, snap) {
        final state = snap.data;
        final shuffle = state?.shuffleMode ?? AudioServiceShuffleMode.none;
        final repeat = state?.repeatMode ?? AudioServiceRepeatMode.none;
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            IconButton(
              tooltip: switch (shuffle) {
                AudioServiceShuffleMode.none => 'Shuffle off',
                _ => 'Shuffle on',
              },
              icon: Icon(
                Icons.shuffle,
                color: shuffle == AudioServiceShuffleMode.none
                    ? null
                    : Theme.of(context).colorScheme.primary,
              ),
              onPressed: () => handler.setShuffleMode(
                shuffle == AudioServiceShuffleMode.none
                    ? AudioServiceShuffleMode.all
                    : AudioServiceShuffleMode.none,
              ),
            ),
            IconButton(
              tooltip: switch (repeat) {
                AudioServiceRepeatMode.none => 'Repeat off',
                AudioServiceRepeatMode.one => 'Repeat one',
                _ => 'Repeat all',
              },
              icon: Icon(
                switch (repeat) {
                  AudioServiceRepeatMode.one => Icons.repeat_one,
                  _ => Icons.repeat,
                },
                color: repeat == AudioServiceRepeatMode.none
                    ? null
                    : Theme.of(context).colorScheme.primary,
              ),
              onPressed: () => handler.setRepeatMode(_nextRepeat(repeat)),
            ),
          ],
        );
      },
    );
  }

  static AudioServiceRepeatMode _nextRepeat(AudioServiceRepeatMode current) {
    return switch (current) {
      AudioServiceRepeatMode.none => AudioServiceRepeatMode.all,
      AudioServiceRepeatMode.all => AudioServiceRepeatMode.one,
      _ => AudioServiceRepeatMode.none,
    };
  }
}
