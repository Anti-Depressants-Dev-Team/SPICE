/// Pluggable music source abstraction for Spice clients.
///
/// Every source (YouTube Music, SoundCloud, local files, ...) implements
/// [MusicSource]. Application code depends on this package and never on a
/// specific source, so adding a new source is a new adapter — never a refactor.
library;

export 'src/capability.dart';
export 'src/dtos.dart';
export 'src/music_source.dart';
