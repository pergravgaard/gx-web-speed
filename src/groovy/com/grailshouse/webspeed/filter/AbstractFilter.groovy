package com.grailshouse.webspeed.filter

import javax.servlet.Filter
import javax.servlet.FilterChain
import javax.servlet.FilterConfig
import javax.servlet.ServletException
import javax.servlet.ServletRequest
import javax.servlet.ServletResponse

/**
 * @author pgr
 *
 */
abstract class AbstractFilter implements Filter {

	abstract boolean preFilter(ServletRequest request, ServletResponse response, FilterChain filterChain) throws IOException, ServletException
	abstract void postFilter(ServletRequest request, ServletResponse response, FilterChain filterChain) throws IOException, ServletException

	@Override
	void destroy() {
		// do nothing
	}

	@Override
	void init(FilterConfig filterConfig) throws ServletException {
		// do nothing
	}

	@Override
	void doFilter(ServletRequest request, ServletResponse response, FilterChain filterChain) throws IOException, ServletException {
		// pre filter
		if (preFilter(request, response, filterChain)) {
			filterChain.doFilter(request, response)
		}
		// post filter
		postFilter(request, response, filterChain)
	}
	
}
