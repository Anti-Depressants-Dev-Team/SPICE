package xyz.spiceapp.mobile

import xyz.spiceapp.mobile.model.Playlist

internal fun findPortableSpiceConnectPlaylist(
    playlists: List<Playlist>,
    playlistId: String,
    playlistTitle: String,
): Playlist? {
    playlists.firstOrNull { it.id == playlistId }?.let { return it }
    val normalizedTitle = playlistTitle.trim()
    if (normalizedTitle.isEmpty()) return null
    return playlists.firstOrNull {
        !it.shared && it.title.trim().equals(normalizedTitle, ignoreCase = true)
    }
}
