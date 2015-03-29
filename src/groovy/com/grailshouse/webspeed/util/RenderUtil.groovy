package com.grailshouse.webspeed.util

import org.codehaus.groovy.grails.commons.GrailsDomainClass
import org.codehaus.groovy.grails.commons.GrailsDomainClassProperty
import org.codehaus.groovy.grails.plugins.codecs.HTMLCodec
import org.codehaus.groovy.grails.validation.DomainClassPropertyComparator
//import org.codehaus.groovy.grails.scaffolding.DomainClassPropertyComparator
import org.codehaus.groovy.grails.validation.ConstrainedProperty
import org.codehaus.groovy.grails.web.servlet.mvc.GrailsWebRequest
import org.springframework.beans.PropertyEditorRegistry
import org.springframework.context.MessageSourceResolvable
import org.springframework.validation.FieldError
import org.springframework.web.context.request.RequestContextHolder

import java.beans.PropertyEditor
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols

final class RenderUtil {

	private RenderUtil() {
		super()
	}

	/**
	 * Tags that do not need a body, but still must be closed with a proper end tag, i.e. does not support the short-hand notation ' />'
	 */
	static Set tagsThatMustBeClosedProperly = ['script'] as Set
	/**
	 * Tags that cannot have a body
	 */
	static Set tagsWithoutBody = ['input', 'link', 'meta'] as Set
	static Set sharedHTMLAttributes = ['id', 'class', 'style', 'title'] as Set

	static String renderElement(String tagName = 'div', Map<String, Object> attrs = [:], boolean close = false) {
		if (!tagName) {
			return ''
		}
		def t = tagName.toLowerCase()
		StringBuilder sb = new StringBuilder("<${t}")
		attrs.each { k, v ->
			sb.append(renderAttribute(k, v))
		}
		if (close || tagsWithoutBody.contains(t)) {
			if (tagsThatMustBeClosedProperly.contains(t)) {
				sb.append("></${t}>")
			} else {
				sb.append(' />')
			}
		} else {
			sb.append('>')
		}
		sb as String
	}

	/** The value attribute is the only attribute for which an empty string and null makes sense.
	 *  Note that for the OPTION tag an empty value attribute is necessary - if the value attribute is not present the browser will use the option text as the value instead (as opposed to other tags where not present, means the empty string)!!
	 */
	static String renderAttribute(String name, Object value) {
		if (!name || (name != 'value' && value == null) || (name != 'value' && value == '') || (value instanceof Boolean && !value && !name.startsWith('data-'))) { // The boolean value false should also cause an empty string to be returned
			return ''
		}
		if (value == null) {
			value = ''
		}
		def n = name.toLowerCase()
		String v = (value instanceof Boolean && !n.startsWith('data-')) ? n : value.toString()
		if (n == 'id') { // remove some illegal characters from id attribute
			v = v.replaceAll('[\\.\\:]', '_')
		}
		" ${name}=\"${v.encodeAsHTML()}\""
	}

    static String formatValue(Object value, String propertyPath = null, String nullString = '') {
        if (value == null) {
            return nullString
        }
        // TODO: Should also lookup converters and binders?
        def webRequest = GrailsWebRequest.lookup()
        PropertyEditorRegistry registry = webRequest.getPropertyEditorRegistry()
        PropertyEditor editor = registry.findCustomEditor(value.getClass(), propertyPath)
        if (editor) {
			//println "${value}: ${editor}"
            editor.setValue(value)
            return !(value instanceof Number) ? editor.asText?.encodeAsHTML() : editor.asText
        }
        if (value instanceof Number) {
            def pattern = "0"
            if (value instanceof Double || value instanceof Float || value instanceof BigDecimal) {
                pattern = "0.00#####"
            }
            def locale = webRequest.getLocale()
            def dcfs = locale ? new DecimalFormatSymbols(locale) : new DecimalFormatSymbols()
            def decimalFormat = new DecimalFormat(pattern, dcfs)
            value = decimalFormat.format(value)
        }
        if (value instanceof MessageSourceResolvable) {
            value = message(message: value)
        }
        return value.toString().encodeAsHTML()
    }

//	static String formatValue1(Object value, String propertyPath = null, Boolean doHtmlEncode = Boolean.TRUE, String nullString = '') {
//		if (value == null) {
//			return nullString
//		}
//        // TODO: Should also lookup converters and binders
//		PropertyEditorRegistry registry = RequestContextHolder.currentRequestAttributes().getPropertyEditorRegistry()
//		PropertyEditor editor = registry.findCustomEditor(value.getClass(), propertyPath)
//		if (editor) {
//			editor.setValue(value)
//			return doHtmlEncode && !(value instanceof Number) ? editor.asText?.encodeAsHtml() : editor.asText
//		}
//        return doHtmlEncode ? value.toString().encodeAsHtml() : value
//	}

	static String formatPropertyValue(GrailsDomainClassProperty p, GrailsDomainClassProperty parentProp, Object domainInstance) {
		String propertyPath = parentProp ? "${parentProp.name}.${p.name}" : p.name
		FieldError fieldError = (domainInstance && domainInstance.metaClass.hasProperty(domainInstance, 'errors')) ? domainInstance.errors?.getFieldError(propertyPath) : null
		if (fieldError) {
			// this is due to a bug - invalid date values are not remembered/stored
			def rejectedValue = (Date.class.isAssignableFrom(p.type) || Calendar.class.isAssignableFrom(p.type)) ? RequestContextHolder.currentRequestAttributes().getRequest().getParameter(propertyPath) : fieldError.rejectedValue
			return formatValue(rejectedValue, propertyPath)
		}
		Object value = parentProp ? domainInstance?."${parentProp.name}"?."${p.name}" : domainInstance?."${p.name}"
		formatValue(value, propertyPath)
	}

	static void sortPersistentProperties(List<GrailsDomainClassProperty> props, GrailsDomainClass gdc) {
		Collections.sort(props, new DomainClassPropertyComparator(gdc))
	}

	/**
	 * @param gdc The grails domain class for which you wan't the grails domain class properties
	 * @return A list of grails domain class properties for the given grails domain class
	 */
	static List<GrailsDomainClassProperty> getSortedPersistentProperties(GrailsDomainClass gdc, List<String> sortedPropNames = []) {
		def sortedProps
		if (sortedPropNames) {
			sortedProps = []
			sortedPropNames.each {
                def p = gdc.getPersistentProperty(it)
                assert p != null, "No property by name: ${it}! Check your controller methods."
				sortedProps.add p
			}
		} else {
			sortedProps = gdc.persistentProperties as List
			sortPersistentProperties(sortedProps, gdc)
		}
		sortedProps
	}

	static boolean isReadOnly(GrailsDomainClassProperty p) {
		isReadOnly(p.domainClass.constrainedProperties[p.name])
	}

	static boolean isReadOnly(ConstrainedProperty cp) {
		!(cp && cp.editable)
	}

	// One could argue that a primitive type - like long - should be considered optional by default. But then Spring's default property editor for a number throws an error as an empty string cannot be converted. Instead empty strings should be ignored.
	// But you could also argue that a primitive type has nothing to do with considering it optional/required
	static boolean isOptional(ConstrainedProperty cp) {
		if (!cp) {
			return true
		}
		cp.nullable || (cp.propertyType == String && cp.blank) || cp.propertyType in [boolean]
	}

	static boolean isOptional(GrailsDomainClassProperty p) {
		if (!p) {
			return true
		}
		isOptional(p.domainClass.constrainedProperties[p.name])
	}

	static boolean isRequired(ConstrainedProperty cp) {
		if (!cp) {
			return false
		}
		!isOptional(cp) && cp.editable
	}

	static boolean isRequired(GrailsDomainClassProperty p) {
		if (!p) {
			return false
		}
		isRequired(p.domainClass.constrainedProperties[p.name])
	}

	static String cleanId(String id) {
		id.replace('.', '_')
	}

	static String resolveId(GrailsDomainClassProperty p, GrailsDomainClassProperty parentProp = null) {
		def id = p?.name
		String prefix = parentProp ? "${parentProp.name}." : ''
		if (prefix) {
			id = cleanId(prefix + id)
		}
		id
	}

	static String resolveName(GrailsDomainClassProperty p, GrailsDomainClassProperty parentProp = null) {
		String prefix = parentProp ? "${parentProp.name}." : ''
		def n = "${prefix}${p.name}"
		if (p.association) {
			n = "${n}.id"
		}
		n
	}

}
