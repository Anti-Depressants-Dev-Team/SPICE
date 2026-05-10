import 'package:source_api/source_api.dart';
import 'package:source_youtube/source_youtube.dart';
import 'package:test/test.dart';

void main() {
  test('YtMusicNativeSource declares expected identity', () {
    final s = YtMusicNativeSource();
    expect(s.id, 'youtube_music');
    expect(s.displayName, 'YouTube Music');
    expect(s.capabilities, contains(SourceCapability.search));
  });
}
