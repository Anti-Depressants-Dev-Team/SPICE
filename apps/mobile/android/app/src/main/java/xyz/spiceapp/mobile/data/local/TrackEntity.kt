package xyz.spiceapp.mobile.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import xyz.spiceapp.mobile.model.Track

@Entity(tableName = "tracks")
data class TrackEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val durationMs: Long,
    val artworkUrl: String,
    val sourceId: String,
    val updatedAt: Long,
)

fun Track.toEntity(updatedAt: Long = System.currentTimeMillis()): TrackEntity =
    TrackEntity(
        id = id,
        title = title,
        artist = artist,
        album = album,
        durationMs = durationMs,
        artworkUrl = artworkUrl,
        sourceId = sourceId,
        updatedAt = updatedAt,
    )

fun TrackEntity.toTrack(): Track =
    Track(
        id = id,
        title = title,
        artist = artist,
        album = album,
        durationMs = durationMs,
        artworkUrl = artworkUrl,
        sourceId = sourceId,
    )
