package xyz.spiceapp.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import xyz.spiceapp.mobile.data.update.parseSemanticVersion

class AndroidReleaseVersionTest {
    @Test
    fun androidPackageVersionTracksTheUnifiedSpiceRelease() {
        val release = requireNotNull(parseSemanticVersion(BuildConfig.SPICE_RELEASE_VERSION))
        val expectedCode = release.major * 1_000_000 + release.minor * 1_000 + release.patch

        assertEquals(BuildConfig.SPICE_RELEASE_VERSION, BuildConfig.VERSION_NAME)
        assertEquals(expectedCode, BuildConfig.VERSION_CODE)
        assertTrue(BuildConfig.VERSION_CODE > 18)
    }
}
