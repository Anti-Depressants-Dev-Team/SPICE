/// Capabilities a [MusicSource] may declare it supports.
///
/// Adapters expose this set so feature code can render or hide UI affordances
/// rather than catching `UnsupportedError` at call sites.
enum SourceCapability {
  search,
  streaming,
  lyrics,
  recommendations,
  userLibrary,
  highQualityAudio,
}
