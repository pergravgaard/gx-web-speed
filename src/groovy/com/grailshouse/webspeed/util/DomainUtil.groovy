package com.grailshouse.webspeed.util

import com.grailshouse.webspeed.model.Domain
import org.codehaus.groovy.grails.commons.GrailsApplication
import org.codehaus.groovy.grails.orm.hibernate.cfg.CompositeIdentity
import org.codehaus.groovy.grails.orm.hibernate.cfg.GrailsDomainBinder

final class DomainUtil {

	private DomainUtil() {
		super()
	}

	static String resolveIdentityFieldName(Class clazz) {
		// You can tell hibernate to use another field as the id instead of the id field
		new GrailsDomainBinder().getMapping(clazz)?.identity?.name ?: 'id'
	}

    static Object resolveId(Domain domainInstance) {
        def fieldName = resolveIdentityFieldName(domainInstance.class)
        domainInstance."${fieldName}"
    }

    static Map<String, Serializable> resolveIdParameters(Domain domainInstance, GrailsApplication grailsApplication) {
        def identity = new GrailsDomainBinder().getMapping(domainInstance.class)?.identity
        def m = [:]
        if (identity instanceof CompositeIdentity) {
            identity.propertyNames.each { p ->
                if (grailsApplication.domainClasses.find { gdc -> gdc.logicalPropertyName == p }) {
                    m.put "${p}.id", domainInstance."${p}".id
                }
            }
        } else {
            def fieldName = identity?.name ?: 'id'
            m.put fieldName, domainInstance."${fieldName}"
        }
        m
    }


}
