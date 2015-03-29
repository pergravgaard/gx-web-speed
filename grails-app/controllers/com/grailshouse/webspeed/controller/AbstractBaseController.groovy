package com.grailshouse.webspeed.controller

import com.grailshouse.webspeed.util.WebUtil
import grails.converters.JSON
import grails.converters.XML

abstract class AbstractBaseController {

	/* Closures for rendering different request formats */

	protected final renderAsJson = { obj, contentType = '', encoding = 'UTF-8', callback = '' ->
		if (callback || params.callback) {
			render(contentType: contentType ?: 'text/javascript', encoding: encoding, text: "${callback ?: params.callback}(${obj as JSON})")
		} else {
			render(contentType: contentType ?: 'application/json', encoding: encoding, text: obj as JSON)
		}
	}

	protected final renderAsXml = { obj, contentType = '', encoding = 'UTF-8', callback = '' ->
		if (callback || params.callback) {
			render(contentType: contentType ?: 'text/javascript', encoding: encoding, text: "${callback ?: params.callback}('${obj as XML}')")
		} else {
			render(contentType: contentType ?: 'application/xml', encoding: encoding, text: obj as XML)
		}
	}

	protected String getRefererUrl() {
		def referer = request.getHeader('referer')
		if (referer) {
			def currentUrl = WebUtil.getRequestedURL(request)
			if (!referer.endsWith(currentUrl)) {
				return referer
			}
		}
		''
	}


}
