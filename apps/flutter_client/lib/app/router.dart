import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/player/now_playing_screen.dart';
import '../features/search/search_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const SearchScreen(),
        routes: [
          GoRoute(
            path: 'player',
            pageBuilder: (context, state) => const MaterialPage(
              fullscreenDialog: true,
              child: NowPlayingScreen(),
            ),
          ),
        ],
      ),
    ],
  );
});
