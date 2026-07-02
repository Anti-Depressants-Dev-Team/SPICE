package xyz.spiceapp.mobile.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.migration.Migration
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        TrackEntity::class,
        LikedTrackEntity::class,
        HistoryTrackEntity::class,
        DownloadEntity::class,
        PlaylistEntity::class,
        PlaylistTrackEntity::class,
    ],
    version = 4,
    exportSchema = true,
)
abstract class SpiceDatabase : RoomDatabase() {
    abstract fun libraryDao(): LibraryDao

    companion object {
        @Volatile
        private var instance: SpiceDatabase? = null

        fun get(context: Context): SpiceDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    SpiceDatabase::class.java,
                    "spice_mobile.db",
                )
                    .addMigrations(MIGRATION_1_2)
                    .addMigrations(MIGRATION_2_3)
                    .addMigrations(MIGRATION_3_4)
                    .fallbackToDestructiveMigration(false)
                    .build()
                    .also { instance = it }
            }

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `playlists` (
                        `id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `description` TEXT NOT NULL,
                        `coverUrl` TEXT NOT NULL,
                        `shared` INTEGER NOT NULL,
                        `isPublic` INTEGER NOT NULL,
                        `sortIndex` INTEGER NOT NULL,
                        `updatedAt` INTEGER NOT NULL,
                        PRIMARY KEY(`id`)
                    )
                    """.trimIndent(),
                )
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `playlist_tracks` (
                        `playlistId` TEXT NOT NULL,
                        `trackId` TEXT NOT NULL,
                        `position` INTEGER NOT NULL,
                        PRIMARY KEY(`playlistId`, `trackId`),
                        FOREIGN KEY(`playlistId`) REFERENCES `playlists`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
                        FOREIGN KEY(`trackId`) REFERENCES `tracks`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
                    )
                    """.trimIndent(),
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_playlist_tracks_playlistId` ON `playlist_tracks` (`playlistId`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_playlist_tracks_trackId` ON `playlist_tracks` (`trackId`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_playlist_tracks_position` ON `playlist_tracks` (`position`)")
            }
        }

        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `downloads` (
                        `id` TEXT NOT NULL,
                        `trackId` TEXT NOT NULL,
                        `filePath` TEXT NOT NULL,
                        `fileName` TEXT NOT NULL,
                        `mimeType` TEXT NOT NULL,
                        `bytes` INTEGER NOT NULL,
                        `downloadedAt` INTEGER NOT NULL,
                        PRIMARY KEY(`id`),
                        FOREIGN KEY(`trackId`) REFERENCES `tracks`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
                    )
                    """.trimIndent(),
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_downloads_trackId` ON `downloads` (`trackId`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_downloads_downloadedAt` ON `downloads` (`downloadedAt`)")
            }
        }

        private val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `playlists` ADD COLUMN `shareRole` TEXT NOT NULL DEFAULT ''")
            }
        }
    }
}
