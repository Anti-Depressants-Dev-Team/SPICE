import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router.dart';
import 'app/theme.dart';
import 'services/audio/audio_providers.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Show the system status bar and nav bar — no fullscreen / immersive mode.
  // On Android 15+, leaving this unset can render the app edge-to-edge under
  // the status bar, which reads as "fullscreen" even though the bar still
  // exists. Manual mode plus explicit overlays keeps things conventional.
  SystemChrome.setEnabledSystemUIMode(
    SystemUiMode.manual,
    overlays: const [SystemUiOverlay.top, SystemUiOverlay.bottom],
  );

  final container = ProviderContainer();
  // Pre-warm AudioService.init in the background so the first tap-to-play
  // doesn't pay the platform-channel startup cost.
  unawaited(container.read(audioHandlerProvider.future));

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const SpiceApp(),
    ),
  );
}

class SpiceApp extends ConsumerWidget {
  const SpiceApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Spice',
      theme: spiceTheme(brightness: Brightness.light),
      darkTheme: spiceTheme(brightness: Brightness.dark),
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}
