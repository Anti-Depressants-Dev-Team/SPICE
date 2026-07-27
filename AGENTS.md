# Repository Guidelines

## Project overview

Spice is a unified repository for an Electron desktop client, the SPICE Next.js backend/local runtime, and an Android preview client. The root desktop app is CommonJS-based and starts from `main.js`. The root npm workspace and `package-lock.json` are authoritative for desktop and backend dependencies.

## Repository layout

- `main.js`, `preload.js`, `preload-view.js`, `index.html`, and `styles.css`: primary Electron shell and UI.
- `lyrics-core.js`, `lyrics.js`, and `lyrics.html`: lyrics fetching and lyrics-window behavior.
- `discord-rpc.js`, `scrobbler.js`, and `spice-local-runtime-manager.js`: desktop integrations and local runtime management.
- `scripts/`: desktop helpers, including in-repository native runtime preparation.
- `test/`: Node tests for root desktop logic.
- `apps/backend/`: Next.js backend plus Windows/Linux local-runtime builders and tests.
- `apps/mobile/`: native Android app and npm command wrappers.
- `native-runtime/`: generated prepared runtime content; do not assume it is checked in or current.
- `src/extensions/`: bundled browser-extension assets; keep changes narrow and intentional.

## Commands

Run commands from the repository root unless noted.

### Unified install

- `npm ci`: install the desktop and backend workspace from the root lockfile.
- `npm install`: use only when intentionally updating dependencies and `package-lock.json`.

Do not add pnpm workspace files or a separate backend lockfile.

### Desktop

- `npm start`: run the standard Electron app.
- `npm run start:native`: run the SPICE-only native-mode shell.
- `npm test`: run root Node tests.
- `npm run dist`: build the standard desktop package.
- `npm run dist:mac`: build the standard desktop package as a universal macOS app for both Apple Silicon and Intel.
- `npm run dist:native`, `npm run dist:native:windows`, or `npm run dist:native:linux`: prepare the in-repo backend runtime once and build the native package.

### Backend

- `npm run backend:dev`: run the backend in local development mode.
- `npm run backend:test`: run backend tests.
- `npm run backend:typecheck`: run TypeScript checks.
- `npm run backend:lint`: run ESLint.
- `npm run backend:build:local`: build the local runtime.
- `npm run backend:build:vercel`: build the Vercel runtime.
- `npm run backend:package:local:windows` or `npm run backend:package:local:linux`: assemble a platform runtime under `apps/backend/dist/`.

### Mobile

- `npm run mobile:test`: run the Android check pipeline through `apps/mobile`.
- `npm run mobile:build` or `npm run mobile:android:debug`: build a debug APK.
- `npm run mobile:android:check`: run Android lint, JVM tests, and debug APK assembly.
- `npm run mobile:android:release`: build the release APK path.

## Development notes

- Preserve CommonJS style in root desktop code and the existing TypeScript/ES module style in `apps/backend`.
- Keep desktop, backend, and mobile changes scoped separately when practical.
- For every desktop product implementation or bug fix, assess whether the behavior is compatible with the native Android client. When it is compatible, implement and verify the equivalent Android behavior in the same change; when it is not, document the concrete platform or product constraint.
- Keep the standard Windows and macOS Electron apps feature-equivalent. Desktop implementations and fixes must work on both unless an operating-system-specific limitation applies; document and test any intentional platform exception.
- Frontend features and design changes must blend naturally with the existing visual language, including its spacing, typography, colors, controls, and interaction patterns.
- Any new or changed frontend surface must use the shared theme system rather than fixed theme-specific styling, and it must update immediately when the user changes the theme in Settings.
- Treat existing uncommitted changes as user work. Do not revert or reformat unrelated files.
- Do not commit generated logs, debug dumps, build output, `.next`, `dist`, APKs, or prepared `native-runtime` content.
- Prefer small tests near changed behavior. Desktop tests use Node's built-in test runner.
- The Vercel project root is `apps/backend` within this repository.

## Native runtime notes

- Native preparation uses `apps/backend` in this repository by default.
- `SPICE_BACKEND_REPO` may point to an intentional external checkout for testing.
- If that checkout is unavailable, preparation falls back to platform assets on the dedicated `spice-local-runtime` release.
- `dist:native:*` already performs runtime preparation; do not add a second explicit preparation step in packaging workflows.

## Mobile notes

- The mobile app expects JDK 21 and Android SDK compile SDK 36.
- The debug APK is emitted under `apps/mobile/android/app/build/outputs/apk/debug/`.
- Native background playback depends on direct HTTPS audio URLs. Do not add WebView or iframe playback paths without confirming product direction.

## Verification

Keep verification proportional and usage-conscious:

- By default, run only the smallest targeted test or static check that covers the changed behavior.
- Run `npm test` only for broad root-desktop changes or when no narrower root test exists.
- Run backend tests, typecheck, or lint only when the changed backend files require them. Prefer a targeted backend test file over the complete suite.
- Run local/Vercel builds, Electron smoke tests, Native packaging, Android checks, and cross-platform package builds only when the change directly affects those paths or the user explicitly requests them.
- Do not repeat a check after a version-only or documentation-only edit unless that edit can affect the check.
- Report which checks were intentionally skipped; do not spend time or tokens reproducing CI coverage locally without a concrete risk.

## Publication and release policy

- Automatically commit and release completed user-requested product or code implementations after the targeted verification above passes.
- Bump the root desktop patch version for product releases. Bump `SPICE_MEDIA_CORE_VERSION` and its changelog/tests only when backend or local media runtime code changes.
- Commit only the scoped files, push a branch, open and merge a pull request, then create and push the matching `v<desktop-version>` tag from the merge commit.
- Rely on pull-request CI for the broad cross-platform matrix instead of repeating it locally. Monitor the required `main` CI, Vercel production, `Release Spice`, and `Release Spice Native` workflows with compact status checks and address failures.
- Confirm the final GitHub release contains the expected desktop, Native, and Android assets. Confirm `spice-local-runtime` only when runtime code changed.
- Documentation-only, test-only, and workflow-only maintenance should still be committed and merged when requested, but does not require a product version bump or release unless the user explicitly asks.

## Migration note

The former separate SPICE backend repository now lives at `apps/backend`. Do not restore the legacy sibling-checkout assumption or copy backend sources between repositories. The root npm workspace, CI, native runtime preparation, and release workflows must continue to operate from this single repository.
