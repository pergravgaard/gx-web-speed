package com.grailshouse.webspeed.filter

import javax.servlet.Filter
import javax.servlet.FilterChain
import javax.servlet.FilterConfig
import javax.servlet.ServletException
import javax.servlet.ServletRequest
import javax.servlet.ServletResponse
import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpServletResponse

/**
 *
 * @author pgr
 */
class CacheHeaderFilter implements Filter {

	@Override
    void doFilter(ServletRequest req, ServletResponse resp, FilterChain chain) throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req
        if ("GET".equalsIgnoreCase(request.getMethod())) {
            HttpServletResponse response = (HttpServletResponse) resp
	        long oneMonthFromNow = new Date().plus(30).getTime() // TODO: Make lifetime configurable
            response.setHeader('Cache-Control', 'max-age=' + oneMonthFromNow)
            response.setDateHeader('Expires', oneMonthFromNow)
            response.setHeader('Vary', 'Accept-Encoding')
        }
        chain.doFilter(req, resp)
    }

	@Override
    void destroy() {
    }

	@Override
    void init(FilterConfig config) {
    }

}

