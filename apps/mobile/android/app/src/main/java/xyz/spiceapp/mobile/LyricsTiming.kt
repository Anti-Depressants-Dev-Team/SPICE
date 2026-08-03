package xyz.spiceapp.mobile

internal data class TimedLyricLine(
    val timeMs: Long,
    val text: String,
)

private val lyricTimestampPattern = Regex("""\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?]""")

internal fun parseTimedLyrics(value: String?): List<TimedLyricLine> {
    if (value.isNullOrBlank()) return emptyList()
    return value.lineSequence()
        .flatMap { sourceLine ->
            val timestamps = lyricTimestampPattern.findAll(sourceLine).toList()
            val text = timestamps.lastOrNull()
                ?.let { sourceLine.substring(it.range.last + 1).trim() }
                .orEmpty()
            if (timestamps.isEmpty()) {
                emptySequence()
            } else {
                timestamps.asSequence().map { match ->
                    val minutes = match.groupValues[1].toLong()
                    val seconds = match.groupValues[2].toLong()
                    val fractionMs = match.groupValues[3]
                        .padEnd(3, '0')
                        .take(3)
                        .toLongOrNull()
                        ?: 0L
                    TimedLyricLine(
                        timeMs = (minutes * 60_000L) + (seconds * 1_000L) + fractionMs,
                        text = text,
                    )
                }
            }
        }
        .sortedBy(TimedLyricLine::timeMs)
        .toList()
}

internal fun activeTimedLyricIndex(lines: List<TimedLyricLine>, positionMs: Long): Int {
    val index = lines.indexOfLast { it.timeMs <= positionMs.coerceAtLeast(0L) }
    return index.takeIf { it >= 0 && lines[it].text.isNotEmpty() } ?: -1
}
