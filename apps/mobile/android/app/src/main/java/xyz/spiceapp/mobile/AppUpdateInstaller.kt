package xyz.spiceapp.mobile

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Environment
import androidx.core.content.FileProvider
import xyz.spiceapp.mobile.data.update.isExpectedAndroidArchiveVersion
import java.io.File
import java.security.MessageDigest

internal sealed interface AppUpdateInstallResult {
    data object Launched : AppUpdateInstallResult
    data class Failed(val message: String) : AppUpdateInstallResult
}

internal fun launchAppUpdateInstaller(
    activity: Activity,
    apkFile: File,
    expectedReleaseVersion: String,
): AppUpdateInstallResult {
    val updateDirectories = buildList {
        add(File(activity.filesDir, "updates"))
        activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)?.let { downloadsDirectory ->
            add(File(downloadsDirectory, "updates"))
        }
    }.mapNotNull { directory -> runCatching { directory.canonicalFile }.getOrNull() }
    val canonicalApk = runCatching { apkFile.canonicalFile }.getOrNull()
        ?: return AppUpdateInstallResult.Failed("The downloaded update path is invalid.")
    if (
        !canonicalApk.isFile ||
        canonicalApk.parentFile !in updateDirectories ||
        !canonicalApk.name.endsWith("-release-signed.apk")
    ) {
        return AppUpdateInstallResult.Failed("The downloaded update file is missing or invalid.")
    }
    val archiveInfo = archivePackageInfo(activity.packageManager, canonicalApk)
        ?: return AppUpdateInstallResult.Failed("Android could not read the downloaded update package.")
    if (archiveInfo.packageName != activity.packageName) {
        return AppUpdateInstallResult.Failed("The downloaded APK is not a SPICE Android package.")
    }
    val installedInfo = installedPackageInfo(activity.packageManager, activity.packageName)
        ?: return AppUpdateInstallResult.Failed("Android could not read this SPICE installation.")
    if (
        !isExpectedAndroidArchiveVersion(
            expectedReleaseVersion = expectedReleaseVersion,
            installedVersionCode = packageVersionCode(installedInfo),
            archiveVersionName = archiveInfo.versionName,
            archiveVersionCode = packageVersionCode(archiveInfo),
        )
    ) {
        return AppUpdateInstallResult.Failed(
            "The downloaded APK version does not match the newer SPICE release.",
        )
    }
    if (!hasCompatibleSigningCertificate(installedInfo, archiveInfo)) {
        return AppUpdateInstallResult.Failed(
            "This SPICE installation uses an older signing key, so Android cannot update it in place. " +
                "Sync or back up your library, uninstall SPICE once, then install the signed APK " +
                "from the official SPICE release page.",
        )
    }

    val contentUri = runCatching {
        FileProvider.getUriForFile(
            activity,
            activity.packageName + ".fileprovider",
            canonicalApk,
        )
    }.getOrElse {
        return AppUpdateInstallResult.Failed("SPICE could not securely share the update with Android.")
    }
    val installIntent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(contentUri, "application/vnd.android.package-archive")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    installIntent.clipData = ClipData.newRawUri("SPICE Android update", contentUri)
    if (installIntent.resolveActivity(activity.packageManager) == null) {
        return AppUpdateInstallResult.Failed("No Android package installer is available.")
    }
    return runCatching {
        activity.startActivity(installIntent)
        AppUpdateInstallResult.Launched
    }.getOrElse { error ->
        AppUpdateInstallResult.Failed(error.message ?: "Android could not open the package installer.")
    }
}

@Suppress("DEPRECATION")
private fun archivePackageInfo(packageManager: PackageManager, apkFile: File): PackageInfo? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        packageManager.getPackageArchiveInfo(
            apkFile.absolutePath,
            PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong()),
        )
    } else {
        packageManager.getPackageArchiveInfo(
            apkFile.absolutePath,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageManager.GET_SIGNING_CERTIFICATES
            } else {
                PackageManager.GET_SIGNATURES
            },
        )
    }

@Suppress("DEPRECATION")
private fun installedPackageInfo(packageManager: PackageManager, packageName: String): PackageInfo? =
    runCatching {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.getPackageInfo(
                packageName,
                PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong()),
            )
        } else {
            packageManager.getPackageInfo(
                packageName,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    PackageManager.GET_SIGNING_CERTIFICATES
                } else {
                    PackageManager.GET_SIGNATURES
                },
            )
        }
    }.getOrNull()

@Suppress("DEPRECATION")
private fun signingCertificateDigests(packageInfo: PackageInfo): Set<String> {
    val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        packageInfo.signingInfo?.let { signingInfo ->
            if (signingInfo.hasMultipleSigners()) {
                signingInfo.apkContentsSigners
            } else {
                signingInfo.signingCertificateHistory
            }
        }.orEmpty()
    } else {
        packageInfo.signatures.orEmpty()
    }
    return signatures.mapTo(linkedSetOf()) { signature ->
        MessageDigest.getInstance("SHA-256")
            .digest(signature.toByteArray())
            .joinToString("") { "%02x".format(it) }
    }
}

private fun hasCompatibleSigningCertificate(
    installedInfo: PackageInfo,
    archiveInfo: PackageInfo,
): Boolean {
    val installedDigests = signingCertificateDigests(installedInfo)
    val archiveDigests = signingCertificateDigests(archiveInfo)
    return installedDigests.isNotEmpty() && archiveDigests.isNotEmpty() &&
        installedDigests.any(archiveDigests::contains)
}

@Suppress("DEPRECATION")
private fun packageVersionCode(packageInfo: PackageInfo): Long =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        packageInfo.longVersionCode
    } else {
        packageInfo.versionCode.toLong()
    }
