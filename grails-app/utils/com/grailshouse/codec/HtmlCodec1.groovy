package com.grailshouse.codec

/**
 * Created with IntelliJ IDEA.
 * User: pgr
 * Date: 12/30/12
 * Time: 4:12 PM
 */
class HtmlCodec1 {

	// TODO: Get rid of this codec again
	static Closure encode = { str ->
        println 'HtmlCodec' + str
//		def escaped = str.replaceAll('&(?!(#|amp;|hellip;))', '&amp;') // this negative lookahead prevents escaping of ampersands used in other escaped values, but then we have to take care of all other characters ourselves
		//str.encodeAsHTML().replaceAll('&amp;(?=(#|amp;|hellip;))', '&') // so instead we use the built-in (Spring) HTML escaping and use positive lookahead to unescape ampersands that shouldn't have been escaped in the first place.
		str.encodeAsHTML()
	}

}
