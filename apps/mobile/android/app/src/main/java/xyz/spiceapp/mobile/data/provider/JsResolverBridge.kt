package xyz.spiceapp.mobile.data.provider

import app.cash.quickjs.QuickJs

class JsResolverBridge {
    fun evaluateResolver(
        script: String,
        functionName: String,
        payloadJson: String,
    ): String {
        QuickJs.create().use { quickJs ->
            quickJs.evaluate(script, "spice-resolver.js")
            return quickJs.evaluate("$functionName(${jsStringLiteral(payloadJson)})", "spice-resolver-call.js")
                ?.toString()
                .orEmpty()
        }
    }
}

internal fun jsStringLiteral(value: String): String {
    val escaped = buildString {
        append('"')
        value.forEach { char ->
            when (char) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> append(char)
            }
        }
        append('"')
    }
    return escaped
}
