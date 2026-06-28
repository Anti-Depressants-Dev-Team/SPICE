# SPICE Local Mode Feature Ledger

This ledger documents the product changes required by the local runtime split. The guiding rule is simple: heavy provider and media work runs on the user's PC; Vercel stays a thin control plane; Neon remains cloud-only.

## Active Lanes

| Lane | Owner | Status | Scope |
| --- | --- | --- | --- |
| Local PC runtime | User device | Required | Media search, scraping, stream extraction, lyrics, proxying, playback UI |
| Vercel cloud portal | SPICE cloud | Thin control plane | Auth, sync routing, metadata, feedback, install page, update manifest |
| Neon Postgres | SPICE database | Cloud only | Accounts, profiles, sync tables, feedback submissions, admin state |

## Features That Moved, Froze, Or Were Replaced

| Feature | Status | Why | Replacement |
| --- | --- | --- | --- |
| Hosted web media scraping | Removed from Vercel | Provider scraping and stream extraction are heavy, brittle serverless work. | Local runtime routes under `/api/local/*` on `127.0.0.1:3939`. |
| Direct hosted SPICE Music player | Replaced | The hosted page is now the cloud control plane, not the heavy media runtime. | Install or open the local PC runtime, then use cloud APIs through `/api/cloud/*`. |
| Home, Anime, Movie navigation inside the local app | Hidden and frozen | The active product focus is local SPICE Music plus cloud account services. | Source history stays intact; shelved routes show frozen placeholders. |
| Spice Anime and Spice Movie starter surfaces | Shelved | Those services would add cloud and provider load while the local split stabilizes. | Kept in source, removed from active discovery and launch flows. |
| Raw provider API strings in the client | Retired | Runtime routing must be explicit so local-only work cannot drift back to Vercel. | A single client API helper chooses `/api/local/*` or `/api/cloud/*`. |
| Local JSON feedback writes | Replaced | Vercel functions cannot depend on writable local files. | Feedback persists to Neon when configured, with log-only fallback. |
| Neon code and secrets in local ZIPs | Blocked | Local installs must not ship database connection strings, Neon clients, or database migrations. | Database env stays in Vercel; package scans verify the local bundle. |

## Optional Quality-Of-Life And Integrations

These features are not removed by default. The decision line is cost, privacy, and runtime locality rather than whether a feature is "small" or "nice to have."

| Feature | Status | Why | Operating rule |
| --- | --- | --- | --- |
| Floating mini player, queue polish, themes, and local profile UX | Keep local-first | These are mostly UI or local-storage conveniences and do not pressure Vercel or Neon during normal local playback. | Keep them inside the local runtime unless the user explicitly signs in or syncs. |
| Last.fm and ListenBrainz profile sync | Keep opt-in | They are profile update integrations, not playable search providers, and failures should never block playback. | Send only now-playing and scrobble-threshold writes; keep provider credentials in cloud env or account storage. |
| Spice Connect remote device control | Keep cost-gated | Same-account remote control is useful, but it uses cloud device state and queued commands. | Use stale-command expiry, polling backoff, same-account checks, and emergency austerity controls if traffic spikes. |
| Shared playlists and notification requests | Keep account-backed | Collaboration is a real account feature, but it should not be required for local-only playback. | Batch database reads, avoid polling storms, and sync only for signed-in users. |
| Listen Together sessions | Limit and monitor | Realtime session state is heavier than normal sync and can create avoidable cloud/database churn. | Keep sessions opt-in, clean up inactive listeners quickly, and pause this lane first during cost emergencies. |
| Discord Rich Presence backend route | Keep removed | The backend RPC path was scrapped and does not belong in the Vercel control plane. | If it returns, implement it as Electron or local-runtime-only desktop integration with no cloud API path. |

## Merge Readiness Checklist

- Vercel has only public install/update metadata and cloud APIs.
- Local Windows packages do not include database connection strings, Neon client packages, or database migrations.
- CORS stays limited to SPICE domains plus localhost and `127.0.0.1`.
- Update manifests stay public and cacheable.
- Neon connection strings stay in Vercel environment variables only.
- Anime, Movie, and legacy local Home routes remain frozen until there is a separate lane to revive them.
