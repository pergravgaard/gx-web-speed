package com.grailshouse.webspeed.filter

import javax.servlet.FilterChain
import javax.servlet.FilterConfig
import javax.servlet.ServletRequest
import javax.servlet.ServletResponse
import javax.servlet.ServletException
import javax.servlet.http.HttpServletRequest

import com.grailshouse.webspeed.filter.wrapper.LocaleRequestWrapper
import com.grailshouse.webspeed.util.LocaleUtil

/**
 * @author pgr
 *
 */
class LocaleFilter extends AbstractFilter {

	static final String SUPPORTED_LOCALES = 'supportedLocales'
	static final String LOCALE_PARAM_NAME = 'lang'
	
	private FilterConfig filterConfig
	
	@Override
	void init(FilterConfig filterConfig) throws ServletException {
		this.filterConfig = filterConfig
		setSupportedLocales()
	}

	@Override
	boolean preFilter(ServletRequest request, ServletResponse response, FilterChain filterChain) throws IOException, ServletException {
		HttpServletRequest req = (request instanceof HttpServletRequest) ? (HttpServletRequest) request : null
		if (req && doWrap(req)) {
			List<Locale> supportedLocales = (filterConfig.getServletContext().getAttribute(LocaleFilter.SUPPORTED_LOCALES) instanceof List<Locale>) ? (List<Locale>) filterConfig.getServletContext().getAttribute(LocaleFilter.SUPPORTED_LOCALES) : null
			if (supportedLocales) {
				def param = req.getParameter(LocaleFilter.LOCALE_PARAM_NAME)
				def desiredLocale = param ? LocaleUtil.parseLocale(param) : request.locale
				if (desiredLocale) {
					LocaleRequestWrapper wReq = new LocaleRequestWrapper(req)
					wReq.setLocale resolveBestSupportedLocale(desiredLocale, supportedLocales)
					// TODO: How to use the Spring LocaleResolver
					/*if (req.getAttribute("org.springframework.web.servlet.DispatcherServlet.LOCALE_RESOLVER") instanceof LocaleResolver) {
						
					println 'adjusting spring locale resolver'
						LocaleResolver resolver = (LocaleResolver) req.getAttribute("org.springframework.web.servlet.DispatcherServlet.LOCALE_RESOLVER");
						resolver.setLocale request, response, desiredLocale;
					}*/
					filterChain.doFilter(wReq, response)
					return false
				}
			}
		}
		true
	}

	@Override
	void postFilter(ServletRequest request, ServletResponse response, FilterChain filterChain) throws IOException, ServletException {
		// do nothing
	}
	
	private boolean doWrap(HttpServletRequest request) {
		String found = ['/images/', '/css/', '/js/', '/ckeditor/'].find {
			request.requestURL.indexOf(it) > -1
		}
		found == null
	}
	
	private Locale resolveBestSupportedLocale(Locale originalLocale, List<Locale> supportedLocales) {
		if (!supportedLocales || supportedLocales.contains(originalLocale)) {
			return originalLocale
		}
		for (Locale locale : supportedLocales) {
			if (originalLocale.variant && locale.country.equals(originalLocale.country) && locale.language.equals(originalLocale.language)) {
				return locale
			}
			if (locale.language.equals(originalLocale.language)) {
				return locale
			}
		}
		supportedLocales.get(0)
	}

	private void setSupportedLocales() {
		String supportedLocalesParam = filterConfig.servletContext.getInitParameter(LocaleFilter.SUPPORTED_LOCALES) ?: filterConfig.getInitParameter(LocaleFilter.SUPPORTED_LOCALES)
		List<Locale> supportedLocales = new ArrayList<>()
		filterConfig.getServletContext().setAttribute LocaleFilter.SUPPORTED_LOCALES, supportedLocales
		supportedLocalesParam?.split("(\\s)?,(\\s)?").each {
			Locale locale = LocaleUtil.parseLocale(it)
			if (locale) {
				supportedLocales.add locale
			}
		}
	}

}
