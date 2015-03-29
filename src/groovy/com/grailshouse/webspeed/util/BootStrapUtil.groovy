package com.grailshouse.webspeed.util

final class BootStrapUtil {

	private static Map saveProperties = [failOnError: true, flush: true] // important to flush

	private BootStrapUtil() {
		super()
	}

	static Object findOrSaveWhere(Class domainClass, Map queryMap, Map saveMap = [:], Map saveOptions = saveProperties) {
		def instance = domainClass.findWhere queryMap
		if (!instance) {
			def constructorMap = [:] << queryMap << saveMap
			instance = domainClass.newInstance(constructorMap).save saveOptions
            println "Created instance of : ${domainClass} with args ${constructorMap}"
		}
		instance
	}

}
