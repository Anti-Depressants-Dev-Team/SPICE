package xyz.spiceapp.mobile

internal fun readableMobileReleaseNotes(markdown: String): String = markdown
    .lineSequence()
    .map { line ->
        line
            .replace(Regex("""^\s*#{1,6}\s+"""), "")
            .replace(Regex("""^\s*[*-]\s+"""), "\u2022 ")
            .replace(Regex("""\[([^]]+)]\((https?://[^)]+)\)""")) { it.groupValues[1] }
            .replace("**", "")
            .replace(Regex("""(?<!\*)\*([^*\n]+)\*(?!\*)""")) { it.groupValues[1] }
            .trimEnd()
    }
    .joinToString("\n")
    .trim()
    .replace(Regex("""https?://\S+""")) { match -> addMobileUrlBreaks(match.value) }

private fun addMobileUrlBreaks(value: String): String = buildString(value.length + 12) {
    value.forEach { character ->
        append(character)
        if (character in "/-_?&=") append('\u200B')
    }
}
