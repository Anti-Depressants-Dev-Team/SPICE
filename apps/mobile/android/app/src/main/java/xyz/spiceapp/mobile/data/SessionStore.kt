package xyz.spiceapp.mobile.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import xyz.spiceapp.mobile.model.AccountSession
import xyz.spiceapp.mobile.model.SpiceAccount
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SessionStore(context: Context) {
    private val preferences = context.getSharedPreferences("spice_native_session", Context.MODE_PRIVATE)

    fun load(): AccountSession? {
        val encrypted = preferences.getString(KEY_SESSION, null) ?: return null
        return runCatching {
            decrypt(encrypted)?.let(::sessionFromJson)
        }.getOrElse {
            clear()
            null
        }
    }

    fun save(session: AccountSession) {
        preferences.edit()
            .putString(KEY_SESSION, encrypt(session.toJson().toString()))
            .apply()
    }

    fun clear() {
        preferences.edit().remove(KEY_SESSION).apply()
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        return JSONObject()
            .put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
            .toString()
    }

    private fun decrypt(value: String): String? {
        val payload = JSONObject(value)
        val iv = Base64.decode(payload.getString("iv"), Base64.NO_WRAP)
        val ciphertext = Base64.decode(payload.getString("ciphertext"), Base64.NO_WRAP)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
        return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }

    private fun AccountSession.toJson(): JSONObject =
        JSONObject()
            .put("token", token)
            .put(
                "account",
                JSONObject()
                    .put("id", account.id)
                    .put("email", account.email)
                    .put("username", account.username)
                    .put("displayName", account.displayName)
                    .put("avatarUrl", account.avatarUrl)
                    .put("accountRole", account.accountRole)
                    .put("isAdmin", account.isAdmin),
            )

    private fun sessionFromJson(value: String): AccountSession {
        val payload = JSONObject(value)
        val account = payload.getJSONObject("account")
        return AccountSession(
            token = payload.getString("token"),
            account = SpiceAccount(
                id = account.getString("id"),
                email = account.optString("email"),
                username = account.optString("username"),
                displayName = account.optString("displayName"),
                avatarUrl = account.optString("avatarUrl"),
                accountRole = account.optString("accountRole", "user"),
                isAdmin = account.optBoolean("isAdmin", false),
            ),
        )
    }

    private companion object {
        const val ANDROID_KEY_STORE = "AndroidKeyStore"
        const val KEY_ALIAS = "spice_native_session_key"
        const val KEY_SESSION = "session"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
