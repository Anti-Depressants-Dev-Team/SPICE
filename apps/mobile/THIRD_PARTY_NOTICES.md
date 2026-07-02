# Spice Android Third-Party Notices

This notice covers the native Android app under `apps/mobile`. The release target is a private sideload debug build, but these notices should stay with any APK that is shared.

## Source Availability

The app-side integration source is in this repository under `apps/mobile`. If an APK is redistributed, provide the same source snapshot or a public source link that matches the APK, including local changes to resolver/download wrappers.

## Resolver And Download Components

| Component | Version | License | Use | Source |
| --- | --- | --- | --- | --- |
| NewPipe Extractor | v0.26.3 | GPL-3.0 | Phone-native YouTube metadata and stream extraction | https://github.com/TeamNewPipe/NewPipeExtractor |
| youtubedl-android | 0.18.1 | GPL-3.0 | Android wrapper that initializes and runs yt-dlp downloads | https://github.com/yausername/youtubedl-android |
| yt-dlp | managed by youtubedl-android | Unlicense, with bundled release files potentially carrying additional licenses | Download engine used by youtubedl-android | https://github.com/yt-dlp/yt-dlp |
| FFmpeg module | 0.18.1 package | LGPL/GPL depending configuration | Media conversion, metadata, and thumbnail embedding | https://ffmpeg.org |
| aria2c module | 0.18.1 package | GPL-2.0-or-later | Optional accelerated transfer support for downloads | https://aria2.github.io |
| QuickJS Android | 0.9.2 | Apache-2.0 wrapper / MIT engine | Experimental JavaScript resolver parity bridge | https://github.com/cashapp/quickjs-java |

## Redistribution Checklist

1. Keep this notice and `TERMS.md` with the APK.
2. Provide the matching app source snapshot or repository link.
3. Preserve GPL, LGPL, Apache, MIT, and Unlicense notices from upstream projects.
4. Include full license texts or direct upstream license links in the release notes.
5. Treat the combined APK as GPL-compatible unless GPL resolver/download components are removed or replaced.

## Provider Notice

These components interact with third-party services. Spice is not affiliated with or endorsed by YouTube, SoundCloud, NewPipe, yt-dlp, FFmpeg, aria2, or QuickJS.
