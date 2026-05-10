import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:source_api/source_api.dart';

import '../../services/source/source_providers.dart';

class SearchNotifier extends AsyncNotifier<SearchResults> {
  @override
  Future<SearchResults> build() async => const SearchResults();

  Future<void> search(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      state = const AsyncData(SearchResults());
      return;
    }
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final source = ref.read(musicSourceProvider);
      return source.search(trimmed, limit: 30);
    });
  }
}

final searchProvider =
    AsyncNotifierProvider<SearchNotifier, SearchResults>(SearchNotifier.new);
