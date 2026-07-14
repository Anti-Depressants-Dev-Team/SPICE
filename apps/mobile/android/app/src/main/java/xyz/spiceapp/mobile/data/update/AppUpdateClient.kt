package xyz.spiceapp.mobile.data.update

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import kotlin.coroutines.coroutineContext

private const val LATEST_RELEASE_URL =
    "https://api.github.com/repos/Anti-Depressants-Dev-Team/SPICE/releases/latest"
internal const val OFFICIAL_SPICE_RELEASES_URL =
    "https://github.com/Anti-Depressants-Dev-Team/SPICE/releases"
private const val GITHUB_REPOSITORY_PATH = "/Anti-Depressants-Dev-Team/SPICE/releases/download/"
private const val MAX_RELEASE_RESPONSE_BYTES = 2 * 1024 * 1024
private const val MAX_ANDROID_UPDATE_BYTES = 500L * 1024L * 1024L
private const val MAX_REDIRECTS = 6
private const val USER_AGENT = "SPICE-Android-Updater"
private val STABLE_SEMANTIC_RELEASE = Regex("^[vV]?(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$")

data class SemanticVersion(
    val major: Int,
    val minor: Int,
    val patch: Int,
    val preRelease: List<String> = emptyList(),
) : Comparable<SemanticVersion> {
    override fun compareTo(other: SemanticVersion): Int {
        compareValues(major, other.major).takeIf { it != 0 }?.let { return it }
        compareValues(minor, other.minor).takeIf { it != 0 }?.let { return it }
        compareValues(patch, other.patch).takeIf { it != 0 }?.let { return it }
        if (preRelease.isEmpty() && other.preRelease.isNotEmpty()) return 1
        if (preRelease.isNotEmpty() && other.preRelease.isEmpty()) return -1
        for (index in 0 until minOf(preRelease.size, other.preRelease.size)) {
            comparePreReleaseIdentifier(preRelease[index], other.preRelease[index])
                .takeIf { it != 0 }
                ?.let { return it }
        }
        return compareValues(preRelease.size, other.preRelease.size)
    }
}

data class GitHubReleaseAsset(
    val name: String,
    val downloadUrl: String,
    val sizeBytes: Long,
    val contentType: String = "application/vnd.android.package-archive",
    val digest: String? = null,
)

data class GitHubRelease(
    val tagName: String,
    val name: String,
    val notes: String,
    val draft: Boolean,
    val prerelease: Boolean,
    val assets: List<GitHubReleaseAsset>,
)

data class AppUpdateInfo(
    val version: String,
    val releaseName: String,
    val releaseNotes: String,
    val assetName: String,
    val downloadUrl: String,
    val sizeBytes: Long,
    val sha256: String? = null,
    val releasePageUrl: String = OFFICIAL_SPICE_RELEASES_URL,
)

data class AppUpdateUiState(
    val checking: Boolean = false,
    val update: AppUpdateInfo? = null,
    val downloading: Boolean = false,
    val downloadedBytes: Long = 0,
    val totalBytes: Long = 0,
    val downloadedApkPath: String? = null,
    val error: String? = null,
    val dismissed: Boolean = false,
)

class AppUpdateException(message: String, cause: Throwable? = null) : Exception(message, cause)

class AppUpdateClient {
    @Volatile
    private var activeConnection: HttpURLConnection? = null

    suspend fun findLatestUpdate(currentVersion: String): AppUpdateInfo? = withContext(Dispatchers.IO) {
        val installedVersion = parseSemanticVersion(currentVersion)
            ?: throw AppUpdateException("This SPICE build has an invalid release version: $currentVersion")
        val connection = openConnection(URL(LATEST_RELEASE_URL), allowReleaseAssetHosts = false)
        activeConnection = connection
        try {
            val payload = connection.inputStream.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                while (true) {
                    coroutineContext.ensureActive()
                    val read = input.read(buffer)
                    if (read < 0) break
                    if (output.size() + read > MAX_RELEASE_RESPONSE_BYTES) {
                        throw AppUpdateException("The GitHub release response was unexpectedly large.")
                    }
                    output.write(buffer, 0, read)
                }
                JSONObject(output.toString(Charsets.UTF_8.name()))
            }
            selectAndroidUpdate(parseGitHubRelease(payload), installedVersion)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: AppUpdateException) {
            throw error
        } catch (error: Exception) {
            coroutineContext.ensureActive()
            throw AppUpdateException("Could not check GitHub for a SPICE update.", error)
        } finally {
            activeConnection = null
            connection.disconnect()
        }
    }

    fun cancelActiveRequest() {
        activeConnection?.disconnect()
    }

    private fun openConnection(startUrl: URL, allowReleaseAssetHosts: Boolean): HttpURLConnection {
        var url = startUrl
        repeat(MAX_REDIRECTS + 1) { redirectCount ->
            validateUpdateUrl(url, allowReleaseAssetHosts)
            val connection = (url.openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = false
                connectTimeout = 15_000
                readTimeout = 30_000
                setRequestProperty("Accept", if (allowReleaseAssetHosts) "application/octet-stream" else "application/vnd.github+json")
                setRequestProperty("User-Agent", USER_AGENT)
                if (!allowReleaseAssetHosts) setRequestProperty("X-GitHub-Api-Version", "2022-11-28")
            }
            val status = connection.responseCode
            if (status in 200..299) return connection
            if (status in setOf(301, 302, 303, 307, 308) && redirectCount < MAX_REDIRECTS) {
                val location = connection.getHeaderField("Location")
                    ?: throw AppUpdateException("GitHub returned an update redirect without a destination.")
                val redirected = URI(url.toString()).resolve(location).toURL()
                connection.disconnect()
                url = redirected
            } else {
                connection.disconnect()
                throw AppUpdateException("GitHub returned HTTP $status while checking for an update.")
            }
        }
        throw AppUpdateException("The Android update followed too many redirects.")
    }
}

internal fun parseSemanticVersion(value: String): SemanticVersion? {
    val match = Regex(
        "^[vV]?(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)" +
            "(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?" +
            "(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$",
    ).matchEntire(value.trim()) ?: return null
    val major = match.groupValues[1].toIntOrNull() ?: return null
    val minor = match.groupValues[2].toIntOrNull() ?: return null
    val patch = match.groupValues[3].toIntOrNull() ?: return null
    val preRelease = match.groupValues[4]
        .takeIf(String::isNotEmpty)
        ?.split('.')
        .orEmpty()
    if (preRelease.any { it.all(Char::isDigit) && it.length > 1 && it.startsWith('0') }) return null
    return SemanticVersion(major, minor, patch, preRelease)
}

internal fun parseStableSemanticVersion(value: String): SemanticVersion? =
    value.trim().takeIf(STABLE_SEMANTIC_RELEASE::matches)?.let(::parseSemanticVersion)

internal fun selectAndroidUpdate(
    release: GitHubRelease,
    currentVersion: SemanticVersion,
): AppUpdateInfo? {
    if (release.draft || release.prerelease) return null
    val releaseVersion = parseStableSemanticVersion(release.tagName) ?: return null
    if (releaseVersion <= currentVersion) return null
    val expectedAssetName = "Spice-Android-${release.tagName}-release-signed.apk"
    val asset = release.assets.singleOrNull { it.name == expectedAssetName } ?: return null
    if (asset.sizeBytes !in 1..MAX_ANDROID_UPDATE_BYTES) return null
    if (!isAndroidPackageContentType(asset.contentType)) return null
    if (!isExpectedGitHubAssetUrl(asset.downloadUrl, release.tagName, expectedAssetName)) return null
    val sha256 = asset.digest
        ?.takeIf { it.startsWith("sha256:", ignoreCase = true) }
        ?.substringAfter(':')
        ?.takeIf { it.matches(Regex("^[0-9a-fA-F]{64}$")) }
    return AppUpdateInfo(
        version = release.tagName.removePrefix("v").removePrefix("V"),
        releaseName = release.name.ifBlank { release.tagName },
        releaseNotes = release.notes.take(2_000),
        assetName = asset.name,
        downloadUrl = asset.downloadUrl,
        sizeBytes = asset.sizeBytes,
        sha256 = sha256,
        releasePageUrl = "$OFFICIAL_SPICE_RELEASES_URL/tag/${release.tagName}",
    )
}

internal fun parseGitHubRelease(payload: JSONObject): GitHubRelease {
    val assets = payload.optJSONArray("assets")
    return GitHubRelease(
        tagName = payload.optString("tag_name").trim(),
        name = payload.optString("name").trim(),
        notes = payload.optString("body").trim(),
        draft = payload.optBoolean("draft", false),
        prerelease = payload.optBoolean("prerelease", false),
        assets = buildList {
            if (assets != null) {
                for (index in 0 until assets.length()) {
                    val asset = assets.optJSONObject(index) ?: continue
                    add(
                        GitHubReleaseAsset(
                            name = asset.optString("name").trim(),
                            downloadUrl = asset.optString("browser_download_url").trim(),
                            sizeBytes = asset.optLong("size", -1L),
                            contentType = asset.optString("content_type").trim(),
                            digest = asset.optString("digest").trim().takeIf(String::isNotEmpty),
                        ),
                    )
                }
            }
        },
    )
}

private fun comparePreReleaseIdentifier(left: String, right: String): Int {
    val leftNumeric = left.all(Char::isDigit)
    val rightNumeric = right.all(Char::isDigit)
    if (leftNumeric && !rightNumeric) return -1
    if (!leftNumeric && rightNumeric) return 1
    if (!leftNumeric) return left.compareTo(right)
    compareValues(left.length, right.length).takeIf { it != 0 }?.let { return it }
    return left.compareTo(right)
}

internal fun isAndroidPackageContentType(value: String): Boolean =
    value.substringBefore(';').trim().lowercase() in setOf(
        "application/vnd.android.package-archive",
        "application/octet-stream",
    )

internal fun isExpectedAndroidArchiveVersion(
    expectedReleaseVersion: String,
    installedVersionCode: Long,
    archiveVersionName: String?,
    archiveVersionCode: Long,
): Boolean {
    val expected = expectedReleaseVersion.trim().removePrefix("v").removePrefix("V")
    val parsedExpected = parseSemanticVersion(expected) ?: return false
    if (parsedExpected.preRelease.isNotEmpty()) return false
    val archiveName = archiveVersionName?.trim() ?: return false
    return archiveName == expected &&
        parseSemanticVersion(archiveName) == parsedExpected &&
        archiveVersionCode > installedVersionCode
}

internal fun isExpectedAppUpdateAssetUrl(update: AppUpdateInfo): Boolean {
    parseStableSemanticVersion(update.version) ?: return false
    val normalizedVersion = update.version.trim().removePrefix("v").removePrefix("V")
    val possibleTags = listOf("v$normalizedVersion", "V$normalizedVersion", normalizedVersion)
    return possibleTags.any { tagName ->
        update.assetName == "Spice-Android-$tagName-release-signed.apk" &&
            isExpectedGitHubAssetUrl(update.downloadUrl, tagName, update.assetName)
    }
}

private fun isExpectedGitHubAssetUrl(urlValue: String, tagName: String, assetName: String): Boolean {
    val url = runCatching { URL(urlValue) }.getOrNull() ?: return false
    val expectedPath = GITHUB_REPOSITORY_PATH + tagName + "/" + assetName
    return url.protocol.equals("https", ignoreCase = true) &&
        url.host.equals("github.com", ignoreCase = true) &&
        url.path == expectedPath &&
        url.query.isNullOrEmpty() &&
        url.ref.isNullOrEmpty()
}

private fun validateUpdateUrl(url: URL, allowReleaseAssetHosts: Boolean) {
    if (!url.protocol.equals("https", ignoreCase = true)) {
        throw AppUpdateException("SPICE refused a non-HTTPS update URL.")
    }
    val host = url.host.lowercase()
    val permitted = if (allowReleaseAssetHosts) {
        host == "github.com" || host == "githubusercontent.com" || host.endsWith(".githubusercontent.com")
    } else {
        host == "api.github.com" && url.toString() == LATEST_RELEASE_URL
    }
    if (!permitted) throw AppUpdateException("SPICE refused an unexpected update host.")
}
