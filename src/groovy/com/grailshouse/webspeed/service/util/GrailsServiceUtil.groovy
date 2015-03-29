package com.grailshouse.webspeed.service.util

import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpSession
import org.codehaus.groovy.grails.web.servlet.mvc.GrailsWebRequest
import org.springframework.web.context.request.RequestContextHolder

final class GrailsServiceUtil {

	private GrailsServiceUtil() {
		super()
	}

	static HttpServletRequest getRequest() {
		GrailsWebRequest webRequest = (GrailsWebRequest) RequestContextHolder.getRequestAttributes()
		return webRequest?.getCurrentRequest()
	}

	static HttpSession getSession() {
		return getRequest()?.getSession(false)
	}

}
