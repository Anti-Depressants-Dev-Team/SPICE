package xyz.spiceapp.mobile.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface LibraryDao {
    @Query(
        """
        SELECT tracks.*
        FROM tracks
        INNER JOIN liked_tracks ON liked_tracks.trackId = tracks.id
        ORDER BY liked_tracks.likedAt DESC
        """,
    )
    fun observeLikedTracks(): Flow<List<TrackEntity>>

    @Query(
        """
        SELECT tracks.*
        FROM tracks
        INNER JOIN history_tracks ON history_tracks.trackId = tracks.id
        ORDER BY history_tracks.playedAt DESC
        LIMIT 50
        """,
    )
    fun observeHistoryTracks(): Flow<List<TrackEntity>>

    @Query(
        """
        SELECT
            downloads.id AS downloadId,
            downloads.filePath AS filePath,
            downloads.fileName AS fileName,
            downloads.mimeType AS mimeType,
            downloads.bytes AS bytes,
            downloads.downloadedAt AS downloadedAt,
            tracks.id AS trackId,
            tracks.title AS trackTitle,
            tracks.artist AS trackArtist,
            tracks.album AS trackAlbum,
            tracks.durationMs AS trackDurationMs,
            tracks.artworkUrl AS trackArtworkUrl,
            tracks.sourceId AS trackSourceId
        FROM downloads
        INNER JOIN tracks ON tracks.id = downloads.trackId
        ORDER BY downloads.downloadedAt DESC
        """,
    )
    fun observeDownloads(): Flow<List<DownloadRow>>

    @Query(
        """
        SELECT
            playlists.id AS playlistId,
            playlists.title AS playlistTitle,
            playlists.description AS playlistDescription,
            playlists.coverUrl AS playlistCoverUrl,
            playlists.shared AS playlistShared,
            playlists.shareRole AS playlistShareRole,
            playlists.isPublic AS playlistIsPublic,
            playlists.sortIndex AS playlistSortIndex,
            tracks.id AS trackId,
            tracks.title AS trackTitle,
            tracks.artist AS trackArtist,
            tracks.album AS trackAlbum,
            tracks.durationMs AS trackDurationMs,
            tracks.artworkUrl AS trackArtworkUrl,
            tracks.sourceId AS trackSourceId,
            playlist_tracks.position AS trackPosition
        FROM playlists
        LEFT JOIN playlist_tracks ON playlist_tracks.playlistId = playlists.id
        LEFT JOIN tracks ON tracks.id = playlist_tracks.trackId
        ORDER BY playlists.sortIndex ASC, playlist_tracks.position ASC
        """,
    )
    fun observePlaylistRows(): Flow<List<PlaylistTrackRow>>

    @Query(
        """
        SELECT tracks.*
        FROM tracks
        INNER JOIN liked_tracks ON liked_tracks.trackId = tracks.id
        ORDER BY liked_tracks.likedAt DESC
        """,
    )
    suspend fun likedTracks(): List<TrackEntity>

    @Query(
        """
        SELECT tracks.*
        FROM tracks
        INNER JOIN history_tracks ON history_tracks.trackId = tracks.id
        ORDER BY history_tracks.playedAt DESC
        LIMIT 50
        """,
    )
    suspend fun historyTracks(): List<TrackEntity>

    @Query(
        """
        SELECT
            downloads.id AS downloadId,
            downloads.filePath AS filePath,
            downloads.fileName AS fileName,
            downloads.mimeType AS mimeType,
            downloads.bytes AS bytes,
            downloads.downloadedAt AS downloadedAt,
            tracks.id AS trackId,
            tracks.title AS trackTitle,
            tracks.artist AS trackArtist,
            tracks.album AS trackAlbum,
            tracks.durationMs AS trackDurationMs,
            tracks.artworkUrl AS trackArtworkUrl,
            tracks.sourceId AS trackSourceId
        FROM downloads
        INNER JOIN tracks ON tracks.id = downloads.trackId
        ORDER BY downloads.downloadedAt DESC
        """,
    )
    suspend fun downloads(): List<DownloadRow>

    @Query(
        """
        SELECT
            playlists.id AS playlistId,
            playlists.title AS playlistTitle,
            playlists.description AS playlistDescription,
            playlists.coverUrl AS playlistCoverUrl,
            playlists.shared AS playlistShared,
            playlists.shareRole AS playlistShareRole,
            playlists.isPublic AS playlistIsPublic,
            playlists.sortIndex AS playlistSortIndex,
            tracks.id AS trackId,
            tracks.title AS trackTitle,
            tracks.artist AS trackArtist,
            tracks.album AS trackAlbum,
            tracks.durationMs AS trackDurationMs,
            tracks.artworkUrl AS trackArtworkUrl,
            tracks.sourceId AS trackSourceId,
            playlist_tracks.position AS trackPosition
        FROM playlists
        LEFT JOIN playlist_tracks ON playlist_tracks.playlistId = playlists.id
        LEFT JOIN tracks ON tracks.id = playlist_tracks.trackId
        ORDER BY playlists.sortIndex ASC, playlist_tracks.position ASC
        """,
    )
    suspend fun playlistRows(): List<PlaylistTrackRow>

    @Query("SELECT EXISTS(SELECT 1 FROM liked_tracks WHERE trackId = :trackId)")
    suspend fun isLiked(trackId: String): Boolean

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTrack(track: TrackEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertLikedTrack(track: LikedTrackEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertHistoryTrack(track: HistoryTrackEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDownload(download: DownloadEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertPlaylist(playlist: PlaylistEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertPlaylistTrack(track: PlaylistTrackEntity)

    @Query("DELETE FROM liked_tracks WHERE trackId = :trackId")
    suspend fun deleteLikedTrack(trackId: String)

    @Query("DELETE FROM liked_tracks")
    suspend fun clearLikedTracks()

    @Query("DELETE FROM history_tracks")
    suspend fun clearHistoryTracks()

    @Query("DELETE FROM downloads WHERE id = :downloadId")
    suspend fun deleteDownload(downloadId: String)

    @Query("DELETE FROM playlists")
    suspend fun clearPlaylists()

    @Query("DELETE FROM playlist_tracks WHERE playlistId = :playlistId")
    suspend fun clearPlaylistTracks(playlistId: String)

    @Query("SELECT COALESCE(MAX(sortIndex), -1) FROM playlists")
    suspend fun maxPlaylistSortIndex(): Int

    @Query("SELECT COALESCE(MAX(position), -1) FROM playlist_tracks WHERE playlistId = :playlistId")
    suspend fun maxPlaylistTrackPosition(playlistId: String): Int

    @Query("SELECT EXISTS(SELECT 1 FROM playlist_tracks WHERE playlistId = :playlistId AND trackId = :trackId)")
    suspend fun playlistHasTrack(playlistId: String, trackId: String): Boolean

    @Query(
        """
        DELETE FROM history_tracks
        WHERE trackId NOT IN (
            SELECT trackId
            FROM history_tracks
            ORDER BY playedAt DESC
            LIMIT 50
        )
        """,
    )
    suspend fun trimHistory()
}
