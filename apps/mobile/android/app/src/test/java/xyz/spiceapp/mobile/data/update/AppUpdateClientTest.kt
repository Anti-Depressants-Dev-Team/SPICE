package xyz.spiceapp.mobile.data.update

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppUpdateClientTest {
    @Test
    fun semanticVersionsCompareNumericallyInsteadOfLexically() {
        val newer = requireNotNull(parseSemanticVersion("v1.4.10"))
        val installed = requireNotNull(parseSemanticVersion("1.4.9"))

        assertTrue(newer > installed)
        assertTrue(requireNotNull(parseSemanticVersion("2.0.0")) > newer)
        assertTrue(requireNotNull(parseSemanticVersion("1.4.10")) > requireNotNull(parseSemanticVersion("1.4.10-rc.2")))
        assertNull(parseSemanticVersion("1.4"))
        assertNull(parseSemanticVersion("1.04.10"))
        assertNull(parseSemanticVersion("not-a-release"))
        assertNull(parseStableSemanticVersion("1.4.10-rc.1"))
        assertNull(parseStableSemanticVersion("1.4.10+rebuilt"))
    }

    @Test
    fun selectsOnlyTheExactSignedAndroidAssetForANewerStableRelease() {
        val release = GitHubRelease(
            tagName = "v1.4.10",
            name = "v1.4.10",
            notes = "Fixes",
            draft = false,
            prerelease = false,
            assets = listOf(
                GitHubReleaseAsset(
                    name = "Spice-Android-v1.4.10-release-unsigned.apk",
                    downloadUrl = "https://github.com/Anti-Depressants-Dev-Team/SPICE/releases/download/v1.4.10/Spice-Android-v1.4.10-release-unsigned.apk",
                    sizeBytes = 100,
                ),
                GitHubReleaseAsset(
                    name = "Spice-Android-v1.4.10-release-signed.apk",
                    downloadUrl = "https://github.com/Anti-Depressants-Dev-Team/SPICE/releases/download/v1.4.10/Spice-Android-v1.4.10-release-signed.apk",
                    sizeBytes = 123,
                    contentType = "application/vnd.android.package-archive",
                    digest = "sha256:${"ab".repeat(32)}",
                ),
            ),
        )

        val update = selectAndroidUpdate(release, requireNotNull(parseSemanticVersion("1.4.9")))

        assertEquals("1.4.10", update?.version)
        assertEquals("Spice-Android-v1.4.10-release-signed.apk", update?.assetName)
        assertEquals("ab".repeat(32), update?.sha256)
        assertTrue(isExpectedAppUpdateAssetUrl(requireNotNull(update)))
        assertFalse(isExpectedAppUpdateAssetUrl(update.copy(downloadUrl = "https://example.com/update.apk")))
        assertFalse(isExpectedAppUpdateAssetUrl(update.copy(assetName = "../update.apk")))
        assertNull(selectAndroidUpdate(release, requireNotNull(parseSemanticVersion("1.4.10"))))
        assertNull(selectAndroidUpdate(release, requireNotNull(parseSemanticVersion("1.5.0"))))
    }

    @Test
    fun rejectsWrongAssetPathsEmptyPackagesAndNonApkContent() {
        fun release(asset: GitHubReleaseAsset) = GitHubRelease(
            tagName = "v1.4.10",
            name = "v1.4.10",
            notes = "",
            draft = false,
            prerelease = false,
            assets = listOf(asset),
        )
        val base = GitHubReleaseAsset(
            name = "Spice-Android-v1.4.10-release-signed.apk",
            downloadUrl = "https://github.com/Anti-Depressants-Dev-Team/SPICE/releases/download/v1.4.10/Spice-Android-v1.4.10-release-signed.apk",
            sizeBytes = 123,
        )
        val current = requireNotNull(parseSemanticVersion("1.4.9"))

        assertNull(selectAndroidUpdate(release(base.copy(sizeBytes = 0)), current))
        assertNull(selectAndroidUpdate(release(base.copy(contentType = "text/html")), current))
        assertNull(
            selectAndroidUpdate(
                release(base.copy(downloadUrl = "https://example.com/update.apk")),
                current,
            ),
        )
        assertTrue(isAndroidPackageContentType("application/octet-stream"))
        assertTrue(isAndroidPackageContentType("application/vnd.android.package-archive; charset=binary"))
        assertFalse(isAndroidPackageContentType("text/html"))
    }

    @Test
    fun malformedLatestReleaseResponseCannotCreateAnUpdate() {
        val release = parseGitHubRelease(JSONObject("""{"tag_name":"oops","assets":"wrong"}"""))

        assertNull(selectAndroidUpdate(release, requireNotNull(parseSemanticVersion("1.4.9"))))
        assertTrue(release.assets.isEmpty())
    }

    @Test
    fun archiveMustMatchTheExpectedReleaseAndIncreaseAndroidVersionCode() {
        assertTrue(isExpectedAndroidArchiveVersion("1.4.36", 1_004_035L, "1.4.36", 1_004_036L))
        assertTrue(isExpectedAndroidArchiveVersion("v1.4.36", 18L, "1.4.36", 1_004_036L))
        assertFalse(isExpectedAndroidArchiveVersion("1.4.36", 1_004_036L, "1.4.36", 1_004_036L))
        assertFalse(isExpectedAndroidArchiveVersion("1.4.36", 1_004_035L, "1.4.35", 1_004_036L))
        assertFalse(isExpectedAndroidArchiveVersion("1.4.36", 1_004_035L, "1.4.36+other", 1_004_036L))
        assertFalse(isExpectedAndroidArchiveVersion("bad", 1L, "bad", 2L))
    }

}
