package com.grailshouse.webspeed.filter.wrapper

import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpServletRequestWrapper

/**
 * @author pgr
 *
 */
public class LocaleRequestWrapper extends HttpServletRequestWrapper {
	
	Locale locale

	public LocaleRequestWrapper(HttpServletRequest request) {
		super(request)
	}

}