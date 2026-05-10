import 'package:source_api/source_api.dart';
import 'package:test/test.dart';

void main() {
  test('SearchResults defaults to empty lists', () {
    const r = SearchResults();
    expect(r.tracks, isEmpty);
    expect(r.albums, isEmpty);
    expect(r.artists, isEmpty);
    expect(r.playlists, isEmpty);
  });

  test('SourceCapability includes core entries', () {
    expect(SourceCapability.values, contains(SourceCapability.search));
    expect(SourceCapability.values, contains(SourceCapability.userLibrary));
  });
}
