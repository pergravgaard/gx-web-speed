package com.grailshouse.webspeed.filter

import java.io.IOException;

import javax.servlet.Filter
import javax.servlet.FilterChain
import javax.servlet.FilterConfig
import javax.servlet.ServletException
import javax.servlet.ServletRequest
import javax.servlet.ServletResponse
import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpServletResponse

/**
 * This filter removes a possible 'www' in the domain part of the URL.
 * This is in order to avoid the duplicate content issue with respect to Search Engine Optimization.
 * @author pgr
 */
class DomainFilter extends AbstractFilter {
	
	@Override
    boolean preFilter(ServletRequest req, ServletResponse resp, FilterChain chain) throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req
		String prefix = "www."
        if ("GET".equalsIgnoreCase(request.getMethod()) && req.getServerName().startsWith(prefix)) {
            HttpServletResponse response = (HttpServletResponse) resp
			StringBuilder sb = new StringBuilder(request.getRequestURL())
			String qs = request.getQueryString()
			if (qs) {
				sb.append('?').append(qs)
			}
			response.sendRedirect(sb.toString() - prefix)
			return false
        }
        return true
    }

	@Override
	void postFilter(ServletRequest request, ServletResponse response, FilterChain filterChain) throws IOException, ServletException {
		// do nothing
	}

}

