package xyz.spiceapp.mobile.data.download

import android.content.Context
import android.os.Environment
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import xyz.spiceapp.mobile.model.Track
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

class MediaDownloadClient(
    private val context: Context,
) {
    fun downloadAudio(
        track: Track,
        sourceUrl: String,
        processId: String = newProcessId(),
        outputDirectory: File = context.getExternalFilesDir(Environment.DIRECTORY_MUSIC)
            ?: File(context.filesDir, "downloads"),
        progress: (DownloadProgress) -> Unit = {},
    ): DownloadResult {
        ensureInitialized(context)
        outputDirectory.mkdirs()

        val startedAt = System.currentTimeMillis()
        val fileStem = safeFileStem("${track.artist} - ${track.title}")
        val outputTemplate = File(
            outputDirectory,
            "$fileStem.%(ext)s",
        ).absolutePath
        val request = YoutubeDLRequest(sourceUrl)
            .addOption("--no-playlist")
            .addOption("--extract-audio")
            .addOption("--audio-format", "m4a")
            .addOption("--audio-quality", "0")
            .addOption("--embed-metadata")
            .addOption("--embed-thumbnail")
            .addOption("-o", outputTemplate)

        val response = YoutubeDL.getInstance().execute(request, processId) { progressValue, eta, line ->
            progress(DownloadProgress(progressValue, eta, line))
        }
        val outputFile = completedDownloadFile(outputDirectory, fileStem, startedAt)

        return DownloadResult(
            processId = processId,
            outputTemplate = outputTemplate,
            outputDirectory = outputDirectory.absolutePath,
            outputFilePath = outputFile?.absolutePath.orEmpty(),
            outputFileName = outputFile?.name.orEmpty(),
            outputBytes = outputFile?.length()?.coerceAtLeast(0) ?: 0,
            exitCode = response.exitCode,
            output = response.out,
            errorOutput = response.err,
        )
    }

    fun downloadDirectAudio(
        track: Track,
        sourceUrl: String,
        processId: String = newProcessId(),
        outputDirectory: File = context.getExternalFilesDir(Environment.DIRECTORY_MUSIC)
            ?: File(context.filesDir, "downloads"),
        progress: (DownloadProgress) -> Unit = {},
    ): DownloadResult {
        outputDirectory.mkdirs()
        val connection = (URL(sourceUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 12_000
            readTimeout = 20_000
            instanceFollowRedirects = true
            setRequestProperty("Accept", "audio/*,application/octet-stream,*/*")
            setRequestProperty("User-Agent", "Spice-Native-Android/1.0")
        }

        return try {
            val status = connection.responseCode
            if (status !in 200..299) {
                return DownloadResult(
                    processId = processId,
                    outputTemplate = "",
                    outputDirectory = outputDirectory.absolutePath,
                    outputFilePath = "",
                    outputFileName = "",
                    outputBytes = 0,
                    exitCode = status,
                    output = "",
                    errorOutput = "Direct download failed with HTTP $status.",
                )
            }

            val contentType = connection.contentType.orEmpty()
            if (contentType.contains("mpegurl", ignoreCase = true) || sourceUrl.contains(".m3u8", ignoreCase = true)) {
                return DownloadResult(
                    processId = processId,
                    outputTemplate = "",
                    outputDirectory = outputDirectory.absolutePath,
                    outputFilePath = "",
                    outputFileName = "",
                    outputBytes = 0,
                    exitCode = 415,
                    output = "",
                    errorOutput = "Direct download resolved to an HLS playlist, not a single audio file.",
                )
            }

            val totalBytes = connection.contentLengthLong.takeIf { it > 0 } ?: 0
            val file = uniqueOutputFile(outputDirectory, safeFileStem("${track.artist} - ${track.title}"), extensionFor(contentType, sourceUrl))
            var downloaded = 0L
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            connection.inputStream.use { input ->
                file.outputStream().use { output ->
                    while (true) {
                        if (cancelledProcessIds.remove(processId)) {
                            file.delete()
                            throw InterruptedException("Download cancelled.")
                        }
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        downloaded += read
                        val percent = if (totalBytes > 0) downloaded * 100f / totalBytes else -1f
                        progress(DownloadProgress(percent, -1, "${formatBytes(downloaded)} downloaded"))
                    }
                }
            }

            DownloadResult(
                processId = processId,
                outputTemplate = file.absolutePath,
                outputDirectory = outputDirectory.absolutePath,
                outputFilePath = file.absolutePath,
                outputFileName = file.name,
                outputBytes = file.length().coerceAtLeast(0),
                exitCode = 0,
                output = "Downloaded ${file.name}",
                errorOutput = "",
            )
        } finally {
            connection.disconnect()
        }
    }

    fun cancel(processId: String): Boolean {
        cancelledProcessIds.add(processId)
        return YoutubeDL.getInstance().destroyProcessById(processId)
    }

    companion object {
        private val initialized = AtomicBoolean(false)
        private val cancelledProcessIds = ConcurrentHashMap.newKeySet<String>()

        fun newProcessId(): String = "spice-download-${UUID.randomUUID()}"

        private fun ensureInitialized(context: Context) {
            if (initialized.compareAndSet(false, true)) {
                YoutubeDL.getInstance().init(context.applicationContext)
            }
        }
    }
}

data class DownloadProgress(
    val progress: Float,
    val etaSeconds: Long,
    val line: String,
)

data class DownloadResult(
    val processId: String,
    val outputTemplate: String,
    val outputDirectory: String,
    val outputFilePath: String,
    val outputFileName: String,
    val outputBytes: Long,
    val exitCode: Int,
    val output: String,
    val errorOutput: String,
)

internal fun completedDownloadFile(outputDirectory: File, fileStem: String, startedAt: Long): File? =
    outputDirectory
        .listFiles()
        .orEmpty()
        .filter { file ->
            file.isFile &&
                (file.nameWithoutExtension == fileStem || file.nameWithoutExtension.startsWith("$fileStem.")) &&
                file.lastModified() >= startedAt - 1_000
        }
        .maxByOrNull { it.lastModified() }

internal fun safeFileStem(value: String): String =
    value
        .replace(Regex("""[\\/:*?"<>|]+"""), " ")
        .replace(Regex("""\s+"""), " ")
        .trim()
        .take(120)
        .ifBlank { "spice-track" }

private fun uniqueOutputFile(directory: File, fileStem: String, extension: String): File {
    var candidate = File(directory, "$fileStem.$extension")
    var index = 1
    while (candidate.exists()) {
        candidate = File(directory, "$fileStem.$index.$extension")
        index += 1
    }
    return candidate
}

private fun extensionFor(contentType: String, url: String): String {
    val fromContentType = when {
        contentType.contains("mpeg", ignoreCase = true) -> "mp3"
        contentType.contains("mp4", ignoreCase = true) || contentType.contains("aac", ignoreCase = true) -> "m4a"
        contentType.contains("ogg", ignoreCase = true) -> "ogg"
        contentType.contains("opus", ignoreCase = true) -> "opus"
        contentType.contains("webm", ignoreCase = true) -> "webm"
        else -> ""
    }
    if (fromContentType.isNotBlank()) return fromContentType
    val path = runCatching { URL(url).path.substringAfterLast("/") }.getOrDefault("")
    val extension = path.substringAfterLast(".", "").lowercase().takeIf { it.length in 2..5 }
    return extension ?: "m4a"
}

private fun formatBytes(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    val units = listOf("KB", "MB", "GB")
    var value = bytes / 1024.0
    var unitIndex = 0
    while (value >= 1024 && unitIndex < units.lastIndex) {
        value /= 1024.0
        unitIndex += 1
    }
    return "%.1f %s".format(value, units[unitIndex])
}
