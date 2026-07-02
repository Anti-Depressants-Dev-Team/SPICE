# Repository Guidelines

## Project Overview

Spice is an Electron desktop client for YouTube Music, SoundCloud, and the local SPICE runtime. The root app is CommonJS-based and starts from `main.js`. The Android preview client lives under `apps/mobile` and is built with native Android tooling behind npm wrapper scripts.

## Repository Layout

- `main.js`, `preload.js`, `preload-view.js`, `index.html`, `styles.css`: primary Electron desktop shell and UI.
- `lyrics-core.js`, `lyrics.js`, `lyrics.html`: lyrics fetching and lyrics window behavior.
- `discord-rpc.js`, `scrobbler.js`, `spice-local-runtime-manager.js`: desktop integrations and local runtime management.
- `scripts/`: desktop helper scripts, including native runtime preparation.
- `test/`: Node test files for root desktop logic.
- `apps/mobile/`: native Android mobile app and its npm command wrappers.
- `native-runtime/`: prepared local runtime bundle content; do not assume it is checked in or current.
- `src/extensions/`: bundled browser extension assets. Keep changes here narrow and intentional.

## Commands

Run commands from the repository root unless noted.

- `npm install`: install root dependencies.
- `npm start`: run the standard Electron desktop app.
- `npm run start:native`: run the SPICE-only native-mode desktop shell for development.
- `npm test`: run the root Node test suite.
- `npm run dist`: build the standard desktop installer/package.
- `npm run dist:native`: prepare and build the separate Windows native package.
- `npm run mobile:test`: run the Android check pipeline through `apps/mobile`.
- `npm run mobile:build` or `npm run mobile:android:debug`: build a debug Android APK.
- `npm run mobile:android:check`: run Android lint, JVM tests, and debug APK assembly.

## Development Notes

- Preserve the CommonJS style used by the root desktop code.
- Keep root desktop changes and `apps/mobile` changes scoped separately when possible.
- Avoid committing generated logs, debug dumps, build output, or local runtime artifacts.
- Treat existing uncommitted changes as user work. Do not revert or reformat unrelated files.
- When editing browser extension assets under `src/extensions`, avoid broad vendored-code churn.
- Prefer small, focused tests near the changed behavior. Root tests use Node's built-in test runner.

## Mobile Notes

- The mobile app expects JDK 21 and Android SDK compile SDK 36.
- Mobile wrapper scripts are defined in `apps/mobile/package.json`.
- The debug APK is emitted under `apps/mobile/android/app/build/outputs/apk/debug/`.
- Native background playback depends on direct HTTPS audio URLs; do not add WebView or iframe playback paths without confirming the product direction.

## Verification

- For desktop logic changes, run `npm test`.
- For Electron behavior changes, smoke-test with `npm start` when practical.
- For native-mode packaging or local runtime changes, run `npm run start:native` or the relevant native build path.
- For mobile changes, run `npm run mobile:android:check` before considering the change complete.
