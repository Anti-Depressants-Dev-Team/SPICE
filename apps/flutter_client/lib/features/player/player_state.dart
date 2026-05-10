import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The track id currently being resolved + loaded.
///
/// While this is non-null, the search screen should:
///   - render a spinner on the matching row;
///   - ignore taps on every row (including the loading one), so spam taps
///     don't fan out into multiple in-flight `getTrack`/`setUrl` calls
///     fighting each other.
final loadingTrackIdProvider = StateProvider<String?>((ref) => null);
