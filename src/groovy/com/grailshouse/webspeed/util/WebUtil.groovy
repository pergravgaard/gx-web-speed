package com.grailshouse.webspeed.util

import javax.servlet.ServletContext
import javax.servlet.http.HttpServletRequest

final class WebUtil {

	private WebUtil() {
		super()
	}

	static String getOrigin(HttpServletRequest request, Map<String, Integer> defaultPorts = [http: 80, https: 443]) {
		def port = ''
		if (request.serverPort != defaultPorts."${request.scheme}") {
			port = ":${request.serverPort}"
		}
		"${request.scheme}://${request.serverName}${port}" as String
	}

	static String getRequestedURL(HttpServletRequest request, Boolean includeQueryString = true) {
		def relUrl = (request.'javax.servlet.forward.request_uri' ?: request.requestURI).minus(request.contextPath)
		if (!'/'.equals(relUrl) && relUrl.endsWith('/')) {
			relUrl = relUrl.substring(0, relUrl.length() - 1)
		}
		if (includeQueryString && request.'javax.servlet.forward.query_string') {
			relUrl += '?' + request.'javax.servlet.forward.query_string'
		}
		relUrl
	}

	static void writeTempFile(ServletContext servletContext, File file) {
		File tempDir = (File) servletContext.getAttribute('javax.servlet.context.tempdir')
		File tempFile = File.createTempFile(file.name, ".tmp", tempDir)
		FileWriter fw = new FileWriter(tempFile)
		try {
			fw.write(file.bytes)
		}
		finally {
			fw.close()
		}
	}

}
