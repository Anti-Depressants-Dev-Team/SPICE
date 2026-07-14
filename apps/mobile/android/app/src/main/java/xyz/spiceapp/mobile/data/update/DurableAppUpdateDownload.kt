package xyz.spiceapp.mobile.data.update

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

private const val UPDATE_DOWNLOAD_PREFERENCES = "spice_app_update_download"
private const val KEY_UPDATE_DOWNLOAD = "active_update"
private const val MAX_DURABLE_ANDROID_UPDATE_BYTES = 500L * 1024L * 1024L

data class DurableAppUpdateDownload(
    val downloadId: Long,
    val update: AppUpdateInfo,
)

enum class AppUpdateDownloadStatus {
    Pending,
    Running,
    Paused,
    Successful,
    Failed,
    Missing,
}

data class AppUpdateDownloadSnapshot(
    val status: AppUpdateDownloadStatus,
    val downloadedBytes: Long = 0L,
    val totalBytes: Long = 0L,
    val reason: Int = 0,
)

class DurableAppUpdateDownloadManager(context: Context) {
    private val appContext = context.applicationContext
    private val downloadManager = appContext.getSystemService(DownloadManager::class.java)
        ?: throw AppUpdateException("Android's download manager is unavailable.")
    private val preferences = appContext.getSharedPreferences(
        UPDATE_DOWNLOAD_PREFERENCES,
        Context.MODE_PRIVATE,
    )

    fun restore(): DurableAppUpdateDownload? {
        val payload = preferences.getString(KEY_UPDATE_DOWNLOAD, null) ?: return null
        return runCatching {
            val json = JSONObject(payload)
            val update = AppUpdateInfo(
                version = json.getString("version"),
                releaseName = json.optString("releaseName"),
                releaseNotes = json.optString("releaseNotes"),
                assetName = json.getString("assetName"),
                downloadUrl = json.getString("downloadUrl"),
                sizeBytes = json.getLong("sizeBytes"),
                sha256 = json.optString("sha256").takeIf(String::isNotBlank),
                releasePageUrl = json.optString("releasePageUrl", OFFICIAL_SPICE_RELEASES_URL),
            )
            DurableAppUpdateDownload(
                downloadId = json.getLong("downloadId"),
                update = update,
            )
        }.getOrElse {
            preferences.edit().remove(KEY_UPDATE_DOWNLOAD).apply()
            null
        }
    }

    fun enqueue(update: AppUpdateInfo): DurableAppUpdateDownload {
        if (update.sizeBytes !in 1..MAX_DURABLE_ANDROID_UPDATE_BYTES) {
            throw AppUpdateException("The Android update has an invalid download size.")
        }
        if (!isExpectedAppUpdateAssetUrl(update)) {
            throw AppUpdateException("SPICE refused an unexpected Android update address.")
        }
        val target = targetFile(update)
        clear(removeSystemDownload = true, deleteFile = true)
        target.parentFile?.mkdirs()
        target.delete()
        val request = DownloadManager.Request(Uri.parse(update.downloadUrl))
            .setTitle("SPICE ${update.version} update")
            .setDescription("Downloading the signed SPICE Android update")
            .setMimeType("application/vnd.android.package-archive")
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(false)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(
                appContext,
                Environment.DIRECTORY_DOWNLOADS,
                "updates/${update.assetName}",
            )
        val downloadId = downloadManager.enqueue(request)
        val active = DurableAppUpdateDownload(downloadId, update)
        val persisted = preferences.edit()
            .putString(KEY_UPDATE_DOWNLOAD, active.toJson().toString())
            .commit()
        if (!persisted) {
            downloadManager.remove(downloadId)
            target.delete()
            throw AppUpdateException("SPICE could not persist the Android update download.")
        }
        return active
    }

    fun query(active: DurableAppUpdateDownload): AppUpdateDownloadSnapshot {
        val cursor = downloadManager.query(
            DownloadManager.Query().setFilterById(active.downloadId),
        ) ?: return AppUpdateDownloadSnapshot(AppUpdateDownloadStatus.Missing)
        cursor.use {
            if (!it.moveToFirst()) return AppUpdateDownloadSnapshot(AppUpdateDownloadStatus.Missing)
            val status = when (it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))) {
                DownloadManager.STATUS_PENDING -> AppUpdateDownloadStatus.Pending
                DownloadManager.STATUS_RUNNING -> AppUpdateDownloadStatus.Running
                DownloadManager.STATUS_PAUSED -> AppUpdateDownloadStatus.Paused
                DownloadManager.STATUS_SUCCESSFUL -> AppUpdateDownloadStatus.Successful
                DownloadManager.STATUS_FAILED -> AppUpdateDownloadStatus.Failed
                else -> AppUpdateDownloadStatus.Missing
            }
            return AppUpdateDownloadSnapshot(
                status = status,
                downloadedBytes = it.getLong(
                    it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR),
                ).coerceAtLeast(0L),
                totalBytes = it.getLong(
                    it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES),
                ).coerceAtLeast(0L),
                reason = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)),
            )
        }
    }

    fun verifyCompletedFile(active: DurableAppUpdateDownload): File {
        val target = targetFile(active.update)
        val expectedDirectory = updateDirectory().canonicalFile
        val canonicalTarget = target.canonicalFile
        if (
            canonicalTarget.parentFile != expectedDirectory ||
            !canonicalTarget.isFile ||
            canonicalTarget.length() <= 0L ||
            canonicalTarget.length() != active.update.sizeBytes
        ) {
            throw AppUpdateException("The Android update download was incomplete.")
        }
        active.update.sha256?.let { expectedDigest ->
            val digest = MessageDigest.getInstance("SHA-256")
            FileInputStream(canonicalTarget).buffered().use { input ->
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE * 8)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    digest.update(buffer, 0, read)
                }
            }
            val actualDigest = digest.digest().joinToString("") { "%02x".format(it) }
            if (!actualDigest.equals(expectedDigest, ignoreCase = true)) {
                throw AppUpdateException("The Android update failed its SHA-256 integrity check.")
            }
        }
        return canonicalTarget
    }

    fun clear(removeSystemDownload: Boolean, deleteFile: Boolean) {
        val active = restore()
        preferences.edit().remove(KEY_UPDATE_DOWNLOAD).commit()
        if (active != null && removeSystemDownload) downloadManager.remove(active.downloadId)
        if (active != null && deleteFile) runCatching { targetFile(active.update).delete() }
    }

    fun failureMessage(reason: Int): String = when (reason) {
        DownloadManager.ERROR_INSUFFICIENT_SPACE -> "There is not enough storage for the SPICE update."
        DownloadManager.ERROR_DEVICE_NOT_FOUND -> "Android could not access storage for the SPICE update."
        DownloadManager.ERROR_HTTP_DATA_ERROR,
        DownloadManager.ERROR_UNHANDLED_HTTP_CODE,
        DownloadManager.ERROR_TOO_MANY_REDIRECTS -> "GitHub could not finish the SPICE update download."
        else -> "Android's download manager could not download the SPICE update (error $reason)."
    }

    fun targetFile(update: AppUpdateInfo): File {
        val directory = updateDirectory().canonicalFile
        val normalizedVersion = update.version.trim().removePrefix("v").removePrefix("V")
        val expectedNames = setOf(
            "Spice-Android-v$normalizedVersion-release-signed.apk",
            "Spice-Android-V$normalizedVersion-release-signed.apk",
            "Spice-Android-$normalizedVersion-release-signed.apk",
        )
        if (update.assetName !in expectedNames) {
            throw AppUpdateException("The Android update filename is invalid.")
        }
        val target = File(directory, update.assetName).canonicalFile
        if (target.parentFile != directory) {
            throw AppUpdateException("The Android update path is invalid.")
        }
        return target
    }

    private fun updateDirectory(): File {
        val downloads = appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            ?: throw AppUpdateException("Android update storage is unavailable.")
        return File(downloads, "updates").apply { mkdirs() }
    }
}

private fun DurableAppUpdateDownload.toJson(): JSONObject = JSONObject()
    .put("downloadId", downloadId)
    .put("version", update.version)
    .put("releaseName", update.releaseName)
    .put("releaseNotes", update.releaseNotes)
    .put("assetName", update.assetName)
    .put("downloadUrl", update.downloadUrl)
    .put("sizeBytes", update.sizeBytes)
    .put("sha256", update.sha256.orEmpty())
    .put("releasePageUrl", update.releasePageUrl)
