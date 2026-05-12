import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

part 'database.g.dart';

// ─── Tables ────────────────────────────────────────────────────────────────

/// Spice-native playlists. Mirrors `playlists` on the backend (minus the
/// `user_id` since the device is single-user pre-Phase-4).
@DataClassName('SpicePlaylistRow')
class SpicePlaylists extends Table {
  TextColumn get id => text().clientDefault(() => const Uuid().v4())();
  TextColumn get title => text()();
  TextColumn get description => text().nullable()();
  IntColumn get sortIndex => integer().withDefault(const Constant(0))();
  DateTimeColumn get updatedAt =>
      dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get deletedAt => dateTime().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

/// Items in a playlist. Track metadata is denormalized here so the library
/// can render without resolving each track through the source (which would
/// burn rate-limits and break offline).
@DataClassName('SpicePlaylistItemRow')
class SpicePlaylistItems extends Table {
  TextColumn get playlistId => text()
      .references(SpicePlaylists, #id, onDelete: KeyAction.cascade)();
  IntColumn get position => integer()();
  TextColumn get sourceId => text()();
  TextColumn get trackId => text()();
  TextColumn get title => text()();
  TextColumn get artist => text().withDefault(const Constant(''))();
  IntColumn get durationMs => integer().nullable()();
  TextColumn get artworkUrl => text().nullable()();
  DateTimeColumn get addedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column<Object>> get primaryKey => {playlistId, position};
}

/// User likes (the heart button). Same denormalization as playlist items.
@DataClassName('SpiceLikeRow')
class SpiceLikes extends Table {
  TextColumn get sourceId => text()();
  TextColumn get trackId => text()();
  TextColumn get title => text()();
  TextColumn get artist => text().withDefault(const Constant(''))();
  IntColumn get durationMs => integer().nullable()();
  TextColumn get artworkUrl => text().nullable()();
  DateTimeColumn get likedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column<Object>> get primaryKey => {sourceId, trackId};
}

/// Playback history. One row per "this track played, this long." Used for
/// listening stats later; also synced upstream in Phase 4.
@DataClassName('SpiceHistoryRow')
class SpiceHistory extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get sourceId => text()();
  TextColumn get trackId => text()();
  TextColumn get title => text()();
  TextColumn get artist => text().withDefault(const Constant(''))();
  TextColumn get artworkUrl => text().nullable()();
  DateTimeColumn get playedAt =>
      dateTime().withDefault(currentDateAndTime)();
  IntColumn get msListened => integer().withDefault(const Constant(0))();
}

// ─── Database ──────────────────────────────────────────────────────────────

@DriftDatabase(tables: [
  SpicePlaylists,
  SpicePlaylistItems,
  SpiceLikes,
  SpiceHistory,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);
  factory AppDatabase.open() => AppDatabase(_openConnection());

  @override
  int get schemaVersion => 1;
}

QueryExecutor _openConnection() {
  return LazyDatabase(() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File(p.join(dir.path, 'spice.sqlite'));
    // `createInBackground` runs the actual sqlite work off the UI isolate.
    return NativeDatabase.createInBackground(file);
  });
}
