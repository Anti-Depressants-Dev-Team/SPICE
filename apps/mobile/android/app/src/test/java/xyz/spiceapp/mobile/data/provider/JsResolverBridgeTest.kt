package xyz.spiceapp.mobile.data.provider

import org.junit.Assert.assertEquals
import org.junit.Test

class JsResolverBridgeTest {
    @Test
    fun escapesJsonPayloadAsJsStringLiteral() {
        assertEquals(
            """"{\"title\":\"Line\nTwo\",\"quote\":\"\\\"\"}"""",
            jsStringLiteral("""{"title":"Line
Two","quote":"\""}"""),
        )
    }
}
