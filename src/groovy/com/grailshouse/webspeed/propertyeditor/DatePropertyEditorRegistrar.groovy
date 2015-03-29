package com.grailshouse.webspeed.propertyeditor

import org.codehaus.groovy.grails.commons.GrailsApplication
import org.codehaus.groovy.grails.web.servlet.mvc.GrailsWebRequest
import org.springframework.beans.PropertyEditorRegistrar
import org.springframework.beans.PropertyEditorRegistry
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.web.context.request.RequestContextHolder

import javax.servlet.http.HttpServletRequest

class DatePropertyEditorRegistrar implements PropertyEditorRegistrar {

	@Autowired
	GrailsApplication grailsApplication

	String formatPattern = 'dd-MM-yyyy'
	Boolean lenient = false
	List<String> parsePatterns = ["d-M-yy", "d.M.yy"]
	Set<String> propertyPaths

	// TODO: Seems like this method is called twice on each request?! A bug?
    void registerCustomEditors(PropertyEditorRegistry registry) {
        GrailsWebRequest webRequest = (GrailsWebRequest) RequestContextHolder.getRequestAttributes()
        HttpServletRequest request = webRequest?.getCurrentRequest()
        if (request) {
			// TODO: Use grailsApplication.config for formatPattern and parsePatterns
//	        def v = grailsApplication.config."${PROPERTY_EDITORS}".date.common.formatPattern// ?: "dd-MM-yyyy"
//	        println "grails app: ${v}"
			def paths = getPropertyPaths()
			if (paths) {
				paths.each { propertyPath ->
					registry.registerCustomEditor(Date.class, propertyPath, new DateEditor(getFormatPattern(), request.locale, getLenient(), getParsePatterns()))
				}
			} else {
				registry.registerCustomEditor(Date.class, new DateEditor(getFormatPattern(), request.locale, getLenient(), getParsePatterns()))
			}
        }
    }

}
