package com.grailshouse.webspeed.resource

import org.apache.commons.logging.LogFactory
import org.springframework.beans.factory.InitializingBean

class FileProcessor implements InitializingBean {

	static transactional = false

	def grailsApplication

	@Lazy
	def servletContext = { grailsApplication.mainContext.servletContext }()

	def log = LogFactory.getLog(FileProcessor)

	@Override
	void afterPropertiesSet() throws Exception {
		// TODO Auto-generated method stub
/*		println grailsApplication
		println servletContext
*/		/*		getConfig().each { k, v ->
		 println "${k}: ${v}"
		 }*/
		servletContext.setAttribute 'fileConfig', getConfig()
	}

	/**
	 * Returns the config object under 'grails.resources'
	 */
	ConfigObject getConfig() {
		grailsApplication.config.grails.resources
	}
}
