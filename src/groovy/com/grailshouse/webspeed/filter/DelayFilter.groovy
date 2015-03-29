package com.grailshouse.webspeed.filter

import com.grailshouse.webspeed.util.WebUtil

import javax.servlet.*
import javax.servlet.http.HttpServletRequest

class DelayFilter extends AbstractFilter {

	private FilterConfig filterConfig
	
	@Override
	void init(FilterConfig filterConfig) throws ServletException {
		this.filterConfig = filterConfig
	}

	@Override
	boolean preFilter(ServletRequest request, ServletResponse response, FilterChain filterChain) throws IOException, ServletException {
		long now = System.currentTimeMillis()
		Thread.sleep(1000)
		HttpServletRequest req = (request instanceof HttpServletRequest) ? (HttpServletRequest) request : null
		String path = WebUtil.getRequestedURL(req, true)
		println path + ': ' + (System.currentTimeMillis() - now)
		true
	}

	@Override
	void postFilter(ServletRequest request, ServletResponse response, FilterChain filterChain) throws IOException, ServletException {
		// do nothing
	}

}
