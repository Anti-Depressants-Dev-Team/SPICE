# SPICE Walkthrough

## v1.0.11

- Replace emoji-based UI decoration and text-glyph controls with a consistent inline SVG icon set across navigation, category cards, settings, status messages, lyrics, and all player layouts.
- Convert diagnostic sync marks to readable ASCII status tags and refresh the PWA service-worker cache.

## v1.0.10

- Persist complete track snapshots for Neon likes, history, and playlist items so restored library entries retain titles, artists, durations, and thumbnails.
- Scope automatic likes, history, and playlist saves to the active profile.
- Add bounded local track snapshots, saved search results, and per-profile playback save states.
- Restore the most recent cached search after reload and use exact-query cached results while the network refreshes.
- Replace generated placeholder lyrics with ranked LRCLIB matching, timeout-safe search fallback, a short server cache, real plain-lyrics fallback, and an unsynced UI state.
