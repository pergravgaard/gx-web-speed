package com.grailshouse.webspeed.taglib

import com.grailshouse.webspeed.filter.LocaleFilter
import com.grailshouse.webspeed.model.Domain
import com.grailshouse.webspeed.model.DomainDataImage
import com.grailshouse.webspeed.util.DomainUtil
import com.grailshouse.webspeed.util.RenderUtil as RU
import grails.util.Environment
import org.codehaus.groovy.grails.commons.DomainClassArtefactHandler
import org.codehaus.groovy.grails.commons.GrailsApplication
import org.codehaus.groovy.grails.commons.GrailsDomainClass
import org.codehaus.groovy.grails.commons.GrailsDomainClassProperty
import org.codehaus.groovy.grails.commons.GrailsStringUtils
import org.codehaus.groovy.grails.validation.ConstrainedProperty
import org.codehaus.groovy.grails.web.mapping.ForwardUrlMappingInfo
import org.codehaus.groovy.grails.web.mapping.UrlMappingInfo
import org.codehaus.groovy.grails.web.mapping.UrlMappingUtils
import org.codehaus.groovy.grails.web.metaclass.ControllerDynamicMethods
import org.codehaus.groovy.grails.web.servlet.GrailsApplicationAttributes
import org.codehaus.groovy.grails.web.servlet.WrappedResponseHolder
import org.codehaus.groovy.grails.web.servlet.mvc.SynchronizerTokensHolder
import org.codehaus.groovy.grails.web.servlet.mvc.exceptions.ControllerExecutionException
import org.codehaus.groovy.grails.web.sitemesh.GrailsContentBufferingResponse
import org.codehaus.groovy.grails.web.util.IncludeResponseWrapper
import org.codehaus.groovy.grails.web.util.IncludedContent
import org.codehaus.groovy.grails.web.util.WebUtils
import org.springframework.beans.SimpleTypeConverter
import org.springframework.context.MessageSourceResolvable
import org.springframework.validation.FieldError
import org.springframework.validation.ObjectError
import org.springframework.web.servlet.support.RequestContextUtils as RCU
import groovy.text.GStringTemplateEngine

import javax.servlet.RequestDispatcher
import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpServletResponse
import java.lang.reflect.Field
import java.lang.reflect.Modifier
import java.lang.reflect.ParameterizedType
import java.util.regex.Matcher
import java.util.regex.Pattern

class XTagLib {

	static namespace = 'gx'

    private static GStringTemplateEngine engine = new GStringTemplateEngine()

	static Set<ObjectError> sortedErrors(Object bean, GrailsApplication grailsApp) {
		def sortedFieldErrors = []
		Set<ObjectError> sortedObjectErrors = new LinkedHashSet() // important that this is a linked hash set, i.e. does not contain duplicates and has concept of order (insertion)
		if (bean) {
			def errors = bean?.errors?.allErrors
			if (errors && !errors.isEmpty()) {
				def allSortedFieldNames = []
				def sortedFieldNames = bean.constraints.collect { it.key }
				def gdc = grailsApp.domainClasses.find { it.clazz.is(bean.class) }
				if (gdc) {
					sortedFieldNames.each { n ->
						def gdcProp = gdc.getPropertyByName(n)
						def isEmbedded = gdcProp.isEmbedded() || gdc.constrainedProperties[n]?.widget == 'embedded' // TODO: Use another property name than widget since widget could already be set to 'textarea'
						if (isEmbedded) {
							if (gdcProp.isHasOne()) {
								log.error("JPA won't save an instance/record for this field ${n} when modelled as hasOne!")
							}
							allSortedFieldNames.add n
							if (bean[n] != null) {
								allSortedFieldNames.addAll bean[n].constraints.collect { "${n}.${it.key}" }
							}
						} else {
							allSortedFieldNames.add n
						}
					}
					['id', 'version'].eachWithIndex { it, i ->
						if (bean.hasProperty(it)) {
							allSortedFieldNames.add i, it
						}
					}
				} else {
					allSortedFieldNames.addAll(sortedFieldNames)
				}
				allSortedFieldNames.each { n ->
					for (ObjectError error : errors) {
						if (error instanceof FieldError) {
							if (n == error.field || error.field.startsWith(n + '.')) {
								sortedFieldErrors.add(error)
								break
							}
						} else {
							sortedObjectErrors.add(error) // adds for each constrained property, but sortedObjectErrors is a set
						}
					}
				}
			}
		}
		sortedObjectErrors.plus(sortedFieldErrors)
	}

	protected Map<String, String> doctypes = [
		xhtml5: '<!DOCTYPE html>',
		html5: '<!DOCTYPE html>',
		xhtml1: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
		xhtml11: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">'
	]

	protected GrailsDomainClass findGrailsDomainClass(Class clazz) {
		grailsApplication.domainClasses.find { it.clazz.is(clazz) }
	}

	protected Map getLinkMapping(Object record) {
		def linkMapping = record ? request.'linkMapping' : null
		if (record) {
			if (linkMapping instanceof Map) {
				linkMapping = linkMapping.collectEntries { k, v ->
					if (v instanceof Closure) {
						return [k, v.call(record)]
					}
					[k, v]
				}
			}
		}
		linkMapping
	}

	protected String formatValue(Object value, String propertyPath = null) {
		if (value != null) {
			Integer maxChars = null
			if (pageScope."propertyValueMaxChars" instanceof Integer) {
				maxChars = (Integer) pageScope."propertyValueMaxChars"
			}
			else if (request."propertyValueMaxChars" instanceof Integer) {
				maxChars = (Integer) request."propertyValueMaxChars"
			}
			else if (grailsApplication.config.xtaglib.propertyValue.maxChars instanceof Integer) {
				maxChars = (Integer) grailsApplication.config.xtaglib.propertyValue.maxChars
			}
			def v = RU.formatValue(value, propertyPath) // returned value is always encoded as HTML
			if (maxChars) {
				v = v.substring(0, Math.min(v.length(), maxChars))
			}
			return v
		}
		return grailsApplication.config.xtaglib.propertyValue.noValue ?: ''
	}

//    protected ConstrainedProperty findConstrainedPropertyByName(Object bean, String name) {
//        if (bean.hasProperty('constraints') && bean.constraints instanceof Map) {
//            Integer index = name.indexOf('.')
//            Object target = index ? bean."${name.substring(0, index)}" : bean
//            if (target) {
//                String targetKey = index ? name.substring(index + 1) : name
//                for (Map.Entry<String, ConstrainedProperty> entry : target.constraints) {
//                    if (entry.key == targetKey) {
//                        return entry.value
//                    }
//                }
//            }
//        }
//        null
//    }
//
//    protected Constraint findConstraintByConstrainedProperty(ConstrainedProperty constrainedProperty) {
//        if (constrainedProperty) {
//            constrainedProperty?.appliedConstraints.each {
//                println "${it}: ${it.isValid()}"
//            }
//        }
//        null
//    }

    protected String renderObjectError(ObjectError error, Object domainClass) {
        if (error instanceof FieldError) {
            def fieldError = (FieldError) error
            if (fieldError.rejectedValue instanceof byte[]) {
                def bytes = (byte[]) fieldError.rejectedValue
                // TODO: Should be able to pass the maxSize value as second argument in the args array (find Constraint instance fr possibly embedded property)
//                def constrainedProperty = findConstrainedPropertyByName(domainClass, fieldError.field)
                //def constraint = findConstraintByConstrainedProperty(constrainedProperty)
                def code = "${fieldError.code}.${fieldError.objectName}.${fieldError.field}"
                message(code: code, args: [bytes.length])
            } else {
                message(error: error)
            }
        } else {
            message(error: error)
        }
    }

	protected String resolveDomainSuffix() {
		grailsApplication.config.grails.scaffolding.templates.domainSuffix ?: 'Instance'
	}

	protected String resolveControllerName() {
		request.'controllerName' ?: controllerName
	}

	protected Object resolveWebBean(String key) {
		if (pageScope.hasVariable(key)) {
			return pageScope.getVariable(key)
		}
		if (request.getAttribute(key) != null) {
			return request.getAttribute(key)
		}

		if (request.getSession(false)?.getAttribute(key) != null) {
			return request.getSession(false).getAttribute(key)
		}
		if (servletContext.getAttribute(key) != null) {
			return servletContext.getAttribute(key)
		}
		null
	}

	protected Object resolveValue(GrailsDomainClassProperty p, GrailsDomainClassProperty parentProp, Object domainInstance) {
		parentProp ? domainInstance?."${parentProp.name}"?."${p.name}" : domainInstance?."${p.name}"
	}

	protected String resolveFieldValue(GrailsDomainClassProperty p, GrailsDomainClassProperty parentProp, Object domainInstance, String suffix = '') {
		if (suffix) {
			def pValue = params[p.name + suffix]
			if (pValue && pValue != 'null') {
				return pValue
			}
			def obj = resolveValue(p, parentProp, domainInstance)
			return obj ? '' + obj.id : ''
		}
		RU.formatPropertyValue(p, parentProp, domainInstance)
	}

	protected Map resolveNoSelection(GrailsDomainClassProperty p, GrailsDomainClassProperty parentProp = null, Object domainInstance) {
//		if (!isFieldRequired(domainInstance, p.name)) { // this is not good enough. Even though a field is required (not optional), it may very well make sense to render an empty-valued option. It may simply be impossible to make a default choice for the user and the user has to make a choice for a sensible value.
			String prefix = parentProp ? "${parentProp.name}." : ''
			def msg = prefix ? message(code: "${prefix}${p.name}.select", default: message(code: 'default.select.none')) : message(code: "${p.domainClass.name}.${p.name}.select", default: message(code: 'default.select.none'))
			def map = [:]
			def key = (p.manyToOne || p.oneToOne) ? 'null' : ''
			map.put key, msg
			return map
//		}
//		null
	}

    protected List<?> resolveFromList(GrailsDomainClassProperty property, Class domainClass, Object domainInstance = null) {
        List<?> from = resolveWebBean("${property.name}From")
        if (from == null) { // empty list evaluates to false
            from = domainClass.list()
        }
        if (domainInstance) {
            from.remove(domainInstance)
        }
        from
    }

    // does not create any HTML links
	protected String renderPlainPropertyValue(GrailsDomainClassProperty p, Object propertyValue, Object record, StringBuilder htm = null) {
		boolean returnNull = true
		if (htm == null) {
			returnNull = false
			htm = new StringBuilder()
		}
		if (p.type == ([] as Byte[]).class || p.type == byte[].class) {
			// skip these types
		}
		else if (p.type == Boolean || p.type == boolean) {
			htm << formatBoolean(boolean: propertyValue)
		}
		else if (p.type.isEnum()) {
			htm << (propertyValue ? message(code: "${p.type.name}.${propertyValue.name()}") : '')
		}
		else if (p.type == Date || p.type == java.sql.Date || p.type == java.sql.Time || p.type == Calendar) {
			htm << (propertyValue ? formatDate(date: propertyValue) : '')
		}
		else if (Collection.isAssignableFrom(p.type)) { // Note we check for this condition before detecting if it's an association!!
			if (!propertyValue?.isEmpty()) {
				htm << message(code: "${resolveControllerName()}.${p.name}.count", args: [propertyValue.size()])
			}
		}
		else if (p.isAssociation()) {
			if (propertyValue) {
				htm << formatValue(propertyValue, p.name)
			}
			else if (record && !['list', 'index'].contains(actionName)) {
				htm << message(code: "${p.referencedDomainClass.propertyName}.create.label")
			}
		} else {
			htm << formatValue(propertyValue, p.name)
		}
		returnNull ? null : htm as String
	}


	/**
	 * @param p
	 * @param propertyValue
	 * @param parentProp
	 * @param htm
	 * Call it like this: sb << renderPropertyValue(p, v, rec)
	 * or this: renderPropertyValue(p, v, rec, sb)
	 * @return
	 */
	protected String renderPropertyValue(GrailsDomainClassProperty p, Object propertyValue, Object record, StringBuilder htm = null) {
		boolean returnNull = true
		if (htm == null) {
			returnNull = false
			htm = new StringBuilder()
		}
		if (p.type == ([] as Byte[]).class || p.type == byte[].class) {
			// skip these types
		}
		else if (p.type == Boolean || p.type == boolean) {
			htm << formatBoolean(boolean: propertyValue)
		}
		else if (p.type.isEnum()) {
			htm << (propertyValue ? message(code: "${p.type.name}.${propertyValue.name()}") : '')
		}
		else if (p.type == Date || p.type == java.sql.Date || p.type == java.sql.Time || p.type == Calendar) {
			htm << (propertyValue ? formatDate(date: propertyValue) : '')
		}
		else if (Collection.isAssignableFrom(p.type)) { // Note we check for this condition before detecting if it's an association!!
            if (propertyValue && !propertyValue.isEmpty()) {
				def msg = message(code: "${resolveControllerName()}.${p.name}.count", args: [propertyValue.size()])
				def converter = resolveWebBean("${p.name}Converter")
				if (converter instanceof Closure) {
					htm << converter(propertyValue)
				}
				else if (grailsApplication.config.xtaglib.list.countCollections) {
					htm << msg
				} else {
	                htm << '<dl class="scaffold-collection"><dt class="scaffold-collection-term">'
	//				htm << '<a class="scaffold-collection-term-link" href="' << createLink(controller: p.referencedDomainClass.propertyName, action: 'findCollection', params: [refId: record.id, refName: resolveControllerName()]) << '">' << message(code: "${p.name}.scaffold.term", args: [propertyValue.size()]) << '</a></dt>'
					htm << msg << '</dt>'
					propertyValue.each {
						htm << '<dd class="scaffold-collection-item">'
						def v = it.toString().encodeAsHTML()
	                    if (p.isPersistent() && p.isAssociation()) {
	                        htm << '<a class="scaffold-collection-item-link" href="' << createLink(controller: p.referencedDomainClass.propertyName, action: 'show', id: it.id).encodeAsHTML() << '">' << v << '</a>'
	                    } else {
	                        htm << v
	                    }
	                    htm << '</dd>'
					}
	                htm << '</dl>'
				}
			}
		}
		else if (p.isAssociation()) {
			if (propertyValue) {
				def cName = propertyValue.class.simpleName
				cName = "${cName.substring(0, 1).toLowerCase()}${cName.substring(1)}"
				def linkMapping = [controller: cName, action: 'show', id: propertyValue.id]
				htm << '<a href="' << createLink(linkMapping).encodeAsHTML() << '">' << formatValue(propertyValue, p.name) << '</a>'
//				def associationLinkMapping = resolveWebBean('associationLinkMapping')
//	            def linkMapping = associationLinkMapping?.containsKey(propertyValue.class) ? associationLinkMapping.get(propertyValue.class) : [controller: p.referencedDomainClass.propertyName, action: 'show', id: propertyValue.id]
//	            if (p.type.equals(propertyValue.class)) {
//		            if (linkMapping) {
//                        htm << '<a href="' << createLink(linkMapping).encodeAsHTML() << '">' << formatValue(propertyValue, p.name) << '</a>'
//		            } else {
//			            htm << formatValue(propertyValue, p.name)
//		            }
//                } else {
//		            if (linkMapping) {
//						println(propertyValue.class.name)
//						println createLink(linkMapping)
//                        htm << '<a href="' << createLink(linkMapping).encodeAsHTML() << '">' << formatValue(propertyValue, p.name) << '</a>'
//		            } else {
//			            htm << formatValue(propertyValue, p.name)
//		            }
//                }
			}
			else if (record && !['list', 'index'].contains(actionName)) {
				// For some reason createLink doesn't seem to work here with params: ["${resolveControllerName()}.id": record.id]
				htm << '<a href="' << "${request.contextPath}/${p.referencedDomainClass.propertyName}/create?${resolveControllerName()}.id=${record.id}" << '">' << message(code: "${p.referencedDomainClass.propertyName}.create.label") << '</a>'
			}
		} else {
			htm << formatValue(propertyValue, p.name)
		}
		returnNull ? null : htm as String
	}

	protected String getStyleClassForProperty(GrailsDomainClassProperty p) {
		StringBuilder cls = new StringBuilder(p.name)
		if (p.type == Date || p.type == java.sql.Date || p.type == java.sql.Time || p.type == Calendar) {
			cls << ' date'
		}
		else if (Number.isAssignableFrom(p.type) || (p.type.isPrimitive() && p.type != boolean)) {
			cls << ' number'
		}
		else if (Collection.isAssignableFrom(p.type)) {
			cls << ' collection'
		}
		cls as String
	}

	protected void renderFieldForProperty(GrailsDomainClassProperty p, GrailsDomainClassProperty parentProp = null, Object domainInstance, StringBuilder htm) {
		def gdc = p.domainClass
		ConstrainedProperty cp = gdc.constrainedProperties[p.name]
		boolean display = cp ? cp.display : true
		if (display) {
			String prefix = parentProp ? "${parentProp.name}." : ''
			if (cp.widget == 'hidden' && !prefix) {
				def name = p.association ? p.name + '.id' : p.name
				def value = p.association ? "${gdc.propertyName}.${p.name}?.id}" : fieldValue(bean: domainInstance, field: p.name)
				htm << '<input type="hidden" name="' << name << '" value="' << value << '" />'
			} else if (!(p.association && prefix)) {
				if (cp.widget == 'legend') {
					htm << '</fieldset><fieldset><legend>' << message(code: "${gdc.propertyName}.${p.name}.legend") << '</legend>'
				}
                String cls = (p.type == boolean || p.type == Boolean) ? 'form-group decorator checkbox-decorator' : 'form-group decorator'
				htm << decorator(domainInstance: domainInstance, field: "${prefix}${p.name}", 'class': cls, domainClassProperty: p, parentDomainClassProperty: parentProp) {
					def sb = new StringBuilder('\n')
					//if ((p.oneToMany && p.bidirectional) || p.type == boolean || p.type == Boolean || (p.manyToMany && !p.isOwningSide())) {
                    if ((p.oneToMany && p.bidirectional) || (p.manyToMany && !p.isOwningSide())) {
                        String idFieldName = domainInstance ? DomainUtil.resolveIdentityFieldName(domainInstance.class) : ''
                        boolean isPersisted = domainInstance && idFieldName ? domainInstance[idFieldName] != null : false
                        if (isPersisted) {
    						sb << '<span class="label">' << resolveMessageForProperty(p, prefix) << '</span>'
                            sb << '\n<div class="input-wrapper">\n' << renderFieldEditor(p, parentProp, domainInstance) << '\n</div>\n'
                        }
					} else {
                        // According to W3C validators there can only be one label per checkbox and this label must appear after the checkbox
                        if (p.type == boolean || p.type == Boolean) {
                            sb << '<span class="label">' << resolveMessageForProperty(p, prefix) << '</span>'
                        } else {
                            sb << label(for: RU.resolveId(p, parentProp)) {
                                resolveMessageForProperty(p) // don't supply prefix argument here
                            }
                        }
                        sb << '\n<div class="input-wrapper">\n' << renderFieldEditor(p, parentProp, domainInstance) << '\n</div>\n'
					}
					sb as String
				} << '\n'
			}
		}
	}

	protected String resolveMessageForProperty(GrailsDomainClassProperty p, String prefix = '') {
		def gdc = p.domainClass
		String msg = ''
		while (true) {
			String code = "${gdc.propertyName}.${prefix}${p.name}.label"
			msg = message(code: code)
			if (gdc.root || msg != code) {
				break
			}
			gdc = findGrailsDomainClass(gdc.clazz.superclass)
		}
		msg
	}

	protected String renderFieldEditor(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty, Object domainInstance) {
		if (property.type == Boolean || property.type == boolean) {
			return renderBooleanEditor(property, parentProperty, domainInstance)
		}
		if (property.type && Number.isAssignableFrom(property.type) || (property.type?.isPrimitive() && property.type != boolean)) {
			return renderNumberEditor(property, parentProperty, domainInstance)
		}
		if (property.type == String) {
			return renderStringEditor(property, parentProperty, domainInstance)
		}
		if (property.type == Date || property.type == java.sql.Date || property.type == java.sql.Time || property.type == Calendar) {
			return renderDateEditor(property, parentProperty, domainInstance)
		}
		if (property.type == URL) {
			return renderURLEditor(property, parentProperty, domainInstance)
		}
		if (property.type && property.isEnum()) {
			return renderEnumEditor(property, parentProperty, domainInstance)
		}
		if (property.type == TimeZone) {
			return renderSelectTypeEditor('timeZone', property, parentProperty, domainInstance)
		}
		if (property.type == Locale) {
			return renderSelectLocaleEditor(property, parentProperty, domainInstance)
		}
		if (property.type == Currency) {
			return renderSelectTypeEditor('currency', property, parentProperty, domainInstance)
		}
		if (Byte[].class.isAssignableFrom(property.type) || byte[].class.isAssignableFrom(property.type)) {
            return renderByteArrayEditor(property, parentProperty, domainInstance)
		}
		if (property.manyToOne || property.oneToOne) {
			return renderManyToOne(property, parentProperty, domainInstance)
		}
		if ((property.oneToMany && !property.bidirectional) || (property.manyToMany && property.isOwningSide())) { // TODO: Should oneToMany and not bidirectional really use manyToMany dropdown (Hibernate uses cascade delete by default in such case)?
			return renderManyToMany(property, parentProperty, domainInstance)
		}
		if (property.oneToMany || property.manyToMany) { // is not owning side here
			//return "${property.name}: ${property.manyToMany}"
			return renderOneToMany(property, parentProperty, domainInstance)
		}
		if (Collection.class.isAssignableFrom(property.type)) {
			return renderCollectionEditor(property, parentProperty, domainInstance)
		}
		return "${property.type.simpleName}: Type not supported yet"
	}

	// TODO: Finish
	protected String renderSelectTypeEditor(String type, GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
		'renderSelectTypeEditor'
	}

	protected String renderCollectionEditor(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
		Field field = domainInstance.class.getDeclaredField(property.name)
		ParameterizedType genericType = (ParameterizedType) field.getGenericType()
		def pType = genericType.getActualTypeArguments()[0]
		def gdc = findGrailsDomainClass(pType)
		def from = gdc ? pType.list() : []
//		println Domain.class.isAssignableFrom(pType)
		String id = RU.resolveId(property, parentProperty)
		select(id: id, multiple: true, name: "${RU.resolveName(property, parentProperty)}.id", keys: from*.id, from: from, 'class': 'form-control select', value: resolveFieldValue(property, parentProperty, domainInstance), 'aria-describedby': id + 'Help')
	}

	protected String renderManyToMany(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
		def sb = new StringBuilder()
		def cls = property.referencedDomainClass?.clazz
		if (cls == null) {
			if (property.type instanceof Collection) {
				cls = org.springframework.core.GenericCollectionTypeResolver.getCollectionType(property.type)
			}
		}
		if (cls != null) {
			sb << select(
				id: property.name,
				name: property.name,
				'class': 'form-control select many-to-many',
				multiple: true,
				optionKey: 'id',
				size: grailsApplication.config.xtaglib.form.selectMultipleSize ?: 5,
				from: resolveFromList(property, cls, domainInstance).sort(),
				value: params."${property.name}.id" ?: domainInstance?."${property.name}"*.id, // TODO: Should use resolveFieldValue
				noSelection: resolveNoSelection(property, parentProperty, domainInstance)
			)
		}
		sb as String
	}

	protected String renderOneToMany(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
		def sb = new StringBuilder()
		sb << '<ul class="one-to-many">'
		def coll = domainInstance?."${property.name}" // TODO: this line can be very expensive performancewise!!
		def referencedControllerName = property.referencedDomainClass.clazz.simpleName
		referencedControllerName = "${referencedControllerName.substring(0, 1).toLowerCase()}${referencedControllerName.substring(1)}"
		if (coll) {
			// an entry can be a subclass of the referenced domain class and we need to link to the corresponding controller for the subclass
			coll.each { entry ->
				def gdc = findGrailsDomainClass(entry.class)
				def cName = referencedControllerName // to use entry.class does not always work as this may be a proxy class
				if (gdc) {
					cName = entry.class.simpleName
					cName = "${cName.substring(0, 1).toLowerCase()}${cName.substring(1)}"
				}
				//sb << '<li>' << link(controller: cName, action: 'show', id: entry.id) { entry.encodeAsHtml() } << '</li>'
                sb << '<li>' << link(controller: cName, action: 'show', id: entry.id) { entry } << '</li>'
			}
		}
		def id = domainInstance ? DomainUtil.resolveId(domainInstance) : null
		if (id && (!property.bidirectional || !Modifier.isAbstract(property.referencedDomainClass.clazz.getModifiers()))) {
			sb << '<li class="add">'
            String paramName = property.otherSide ? property.otherSide.name : resolveControllerName()
			// For some reason the link tag doesn't seem to work here with params: ["${property.domainClass.propertyName}.id": id]
			sb << '<a href="' << "${request.contextPath}/${property.referencedDomainClass.propertyName}/create?${paramName}.id=${id}" << '">' << message(code: "${property.referencedDomainClass.propertyName}.add.label") << '</a>'
//			sb << link(controller: property.referencedDomainClass.propertyName, action: 'create', params: ["${property.domainClass.propertyName}.id": id]) {
//				message(code: "${property.referencedDomainClass.propertyName}.add.label", args: [message(code: "${property.referencedDomainClass.propertyName}.label")])
//			}
			sb << '</li>'
		}
		else if (!coll) {
			sb << '<li class="none">'
			sb << message(code: "${property.referencedDomainClass.propertyName}.list.empty", args: [message(code: "${property.referencedDomainClass.propertyName}.label")])
			sb << '</li>'
		}
		sb << '</ul>'
		sb as String
	}

    // TODO: Should use another ui component than a select box if there are many instances
	protected String renderManyToOne(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
		def sb = new StringBuilder()
		if (property.association) {
			// id is "x" and name is "x.id" as the label will have for="x" and "." in an id will confuse CSS
            String id = RU.resolveId(property, parentProperty)
			sb << select(
				id:  id,
				name: RU.resolveName(property, parentProperty),
				'class': 'form-control select many-to-one',
                'aria-describedby': id + 'Help',
				optionKey: 'id',
				from: resolveFromList(property, property.referencedPropertyType, domainInstance).sort(),
				value: resolveFieldValue(property, parentProperty, domainInstance, '.id'),
				noSelection: resolveNoSelection(property, parentProperty, domainInstance)
			)
		}
		sb as String
	}

	protected String renderSelectLocaleEditor(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
		selectLocale(name: RU.resolveName(property, parentProperty), 'class': 'select select-locale', value: resolveValue(property, parentProperty, domainInstance))
	}

	protected String renderNumberEditor(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
		ConstrainedProperty cp = property.domainClass.constrainedProperties[property.name]
		def sb = new StringBuilder()
        String id = RU.resolveId(property, parentProperty)
		if (!cp) {
			if (property.type == Byte) {
				sb << select(id: id, name: RU.resolveName(property, parentProperty), from: (-128..127), 'class': 'form-control select range', value: resolveFieldValue(property, parentProperty, domainInstance), 'aria-describedby': id + 'Help')
			} else {
				sb << input(
                    type: 'text',
                    id: id,
                    name: RU.resolveName(property, parentProperty),
                    'aria-describedby': id + 'Help',
                    'class': 'form-control text number',
                    value: resolveFieldValue(property, parentProperty, domainInstance)
                )
			}
		}
//		if (cp.range) { // TODO: input type range?
//
//			sb << '<g:select name="' << property.name << '"'
//			sb << ' from="${' << "${cp.range.from}..${cp.range.to}" << '}"'
//			sb << ' class="select range"'
//			//if (isRequired()) sb << ' required="required"' // required attribute not supported by select tags according to the HTML5 spec
////			sb << ' value="${' << "fieldValue(bean: ${domainInstance}, field: '${property.name}')" << '}"'
//			sb << ' value="${' << resolveFieldValue(property, prefix) << '}"'
//			sb << renderNoSelection(property)
//			sb << ' />'
//
///*			sb << '<input type="range" class="text range"'
//			sb << ' min="' << cp.range.from << '" max="' << cp.range.to << '" step="1"'
//			if (isRequired()) sb << ' required="required"'
//			sb << ' value="${' << "fieldValue(bean: ${domainInstance}, field: '${property.name}')" << '}"'
//			sb << ' />'
//			sb << '<output onformchange="value=' << property.name << '.value">'
//			sb << '${fieldValue(bean: ' << domainInstance <<', field: \'' << property.name << '\')}</output>'*/
//		} else if (cp.inList) {
		else if (cp.inList) {
			sb << select(
				id: id,
				name: RU.resolveName(property, parentProperty),
				'class': 'form-control select',
                'aria-describedby': id + 'Help',
				from: cp.inList,
				value: resolveFieldValue(property, parentProperty, domainInstance),
				valueMessagePrefix: "${property.domainClass.propertyName}.${property.name}",
				noSelection: resolveNoSelection(property, parentProperty, domainInstance)
			)
		} else {
            // type="number" triggers the numeric keyboard on mobile devices, but a value with a comma as decimal separator will not be interpreted correctly by the browser and consequently may not be displayed at all (even though the value attribute is set correctly)
            // Furthermore Safari do not have a dot on the numeric keyboard making it hard for them to write floating point numbers. Also the decimal separator will be the one of the chosen language in the browser. Not the one dictated by the website.
            // Some people say that Safari will automatically insert a thousand separator, which can cause trouble when parsing on server.
            // So all in all only use type="number" for integer fields
            sb << input(
				type: 'text',
				id: id,
				name: RU.resolveName(property, parentProperty),
				'class': 'form-control text number',
                'aria-describedby': id + 'Help',
                'data-x-webkit-speech': 'true',
                inputmode: 'numeric', // according to the standards this should trigger a numeric keypad (but doesn't yet in any browser)
                //pattern: '[0-9]*', // this triggers the numeric keyboard in Safari, but with no dot nor comma. If dot or comma is added to the pattern you'll get the normal keypad
				value: resolveFieldValue(property, parentProperty, domainInstance),
				required: RU.isRequired(property),
				readonly: RU.isReadOnly(property)
			)
		}
		sb as String
	 }

	// note that the editable property makes no sense for a boolean as the readonly and disabled properties are invalid for a checkbox
	protected String renderBooleanEditor(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
		def sb = new StringBuilder()
        String id = RU.resolveId(property, parentProperty)
		if (property.type.isPrimitive()) {
			//sb << booleanCheckbox(id: RU.resolveId(property, parentProperty), name: RU.resolveName(property, parentProperty), value: resolveValue(property, parentProperty, domainInstance))
            sb << label(for: id, 'class': 'checkbox-label') {
                def sb2 = new StringBuilder()
                sb2 << booleanCheckbox(id: id, name: RU.resolveName(property, parentProperty), value: resolveValue(property, parentProperty, domainInstance), 'aria-describedby': id + 'Help')
                sb2 << resolveMessageForProperty(property)
                sb2
            }
		} else {
			sb << booleanRadio(id: id, name: RU.resolveName(property, parentProperty), value: resolveValue(property, parentProperty, domainInstance), 'aria-describedby': id + 'Help')
		}
//        sb << label(for: RU.resolveId(property, parentProperty), 'class': 'checkbox-label') {
//            resolveMessageForProperty(property)
//        }
		sb as String
	}

	protected String renderByteArrayEditor(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
        def sb = new StringBuilder()
		def accept = ''
		def parentType = parentProperty?.type
		if (parentType && DomainDataImage.class.isAssignableFrom(parentType)) {
			accept = 'image/*'
		} else {
			def otherSideType = parentProperty?.otherSide?.type
			if (otherSideType && DomainDataImage.class.isAssignableFrom(otherSideType)) {
				accept = 'image/*'
			}
		}
		def attrs = [
			type: 'file',
			id: RU.resolveId(property, parentProperty),
			name: RU.resolveName(property, parentProperty),
			//'class': isFieldRequired(domainInstance, property.name) ? 'form-control file' : 'form-control file not-required has-decorator',
			'class': 'form-control file',
			accept: accept,
			required: RU.isRequired(property),
			readonly: RU.isReadOnly(property)
		]
		sb << input(attrs)
		sb as String
	}

    protected String resolvePlaceholder(GrailsDomainClassProperty p) {
        message(code: "${p.domainClass.propertyName}.${p.name}.placeholder", default: '')
    }

	protected String renderDateEditor(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
		def sb = new StringBuilder()
		// It is still not possible to specify a date pattern for input type 'date'. Browsers supporting these types (fx Opera) will insert a date string on the form yyyy-MM-dd, when using browsers native date picker. Therefore type is kept as 'text'.
        ConstrainedProperty cp = property.domainClass.constrainedProperties[property.name]
        String id = RU.resolveId(property, parentProperty)
		String name = RU.resolveName(property, parentProperty)
		def attrs = [
			type: cp?.widget ?: 'text',
			id: id,
			name: name,
			placeholder: resolvePlaceholder(property), //TODO: Finish
			'class': 'form-control text date',
			required: RU.isRequired(property),
			readonly: RU.isReadOnly(property),
            'aria-describedby': id + 'Help'
		]
		def code = "${property.domainClass.propertyName}.${name}.pattern"
		def pattern = message(code: code)//, default: message(code: 'default.date.parsePattern'))
		if (pattern != code) {
			attrs.put 'pattern', pattern
		}
		def v = resolveFieldValue(property, parentProperty, domainInstance)
		if (v) {
			attrs.put 'value', v
		}
		sb << input(attrs)
		sb as String
	}

	protected String renderURLEditor(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
		def sb = new StringBuilder()
        String id = RU.resolveId(property, parentProperty)
		def attrs = [
			type: 'url', // TODO: If the user specifies an invalid url and we display this invalid value (validation errors) the HTML will be invalid as well! :-/
			id: id,
			name: RU.resolveName(property, parentProperty),
            'aria-describedby': id + 'Help',
			'class': 'form-control text url',
			required: RU.isRequired(property),
			readonly: RU.isReadOnly(property)
		]
		def v = resolveFieldValue(property, parentProperty, domainInstance)
		if (v) {
			attrs.put 'value', v
		}
		sb << input(attrs)
		sb as String
	}

	protected String renderStringEditor(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
		ConstrainedProperty cp = property.domainClass.constrainedProperties[property.name]
		def sb = new StringBuilder()
        String id = RU.resolveId(property, parentProperty)
		def attrs = [id: id, name: RU.resolveName(property, parentProperty), 'aria-describedby': id + 'Help']
		if (cp && ('textarea' == cp.widget || (cp.maxSize > 250 && !cp.password && !cp.inList))) {
			// textarea
			attrs << ['class': 'form-control text-area', cols: '40', rows: '5', maxlength: cp.maxSize, required: RU.isRequired(property)]
			def v = resolveValue(property, parentProperty, domainInstance)
			//v = (v == null) ? '' : v.toString().encodeAsHtml()
            v = (v == null) ? '' : v.toString()
			sb << renderElement('textarea', attrs, false) << v << '</textarea>'
		}
		else if (cp?.inList) {
			// select
			sb << select(
				id: attrs.id,
				name: attrs.name,
                'aria-describedby': attrs.'aria-describedby',
				'class': 'form-control select',
				from: cp.inList,
				value: resolveFieldValue(property, parentProperty, domainInstance),
				valueMessagePrefix: "${property.domainClass.propertyName}.${property.name}",
				noSelection: resolveNoSelection(property, parentProperty, domainInstance)
			)
		} else {
			// input
			def v = cp?.password ? params[attrs.name] : resolveFieldValue(property, parentProperty, domainInstance)
			if (v) {
				attrs.put 'value', v
			}
			if (cp) {
				if (cp.password) {
					attrs << [type: 'password', autocomplete: 'off', 'class': 'form-control text password']
				}
				else if (cp.url) {
					attrs << [type: 'url', 'class': 'form-control text url']
				}
				else if (cp.email) {
					attrs << [type: 'email', 'class': 'form-control text email']
				}
                else if (cp.widget) {
                    attrs << [type: cp.widget]
                }
				if (cp.editable) {
					attrs.put('required', RU.isRequired(property))
					if (cp.maxSize) {
						attrs.put('maxlength', cp.maxSize)
					}
					if (cp.matches && !parentProperty) { // does not work for embedded properties as the embedded property might be null resulting in this output: pattern="null" which is not valid HTML. Instead the pattern attribute should be resolved at runtime, not as a part of a CRUD template
						attrs.put('pattern', cp.matches)
					}
				} else {
					attrs.put('readonly', true)
				}
			}
			sb << input(attrs)
		}
		sb as String
	}

	protected String renderEnumEditor(GrailsDomainClassProperty property, GrailsDomainClassProperty parentProperty = null, Object domainInstance) {
		def sb = new StringBuilder()
        String id = RU.resolveId(property, parentProperty)
		sb << select(
			id: id,
			name: RU.resolveName(property, parentProperty),
			'class': 'form-control select enum',
            'aria-describedby': id + 'Help',
			from: property.type.values(),
			keys: property.type.values()*.name(),
			value: resolveFieldValue(property, parentProperty, domainInstance),
			valueMessagePrefix: property.type.name,
			noSelection: resolveNoSelection(property, parentProperty, domainInstance)
		)
		sb as String
	}

	protected String renderElement(String tagName = 'div', Map<String, Object> attrs = [:], boolean close = false) {
		RU.renderElement(tagName, attrs, close)
	}

	protected String renderAttribute(String name, Object value, Object fallbackValue = null) {
		if (value instanceof Map) {
			def v = value."$name"
			return RU.renderAttribute(name, v != null ? v : fallbackValue)
		}
		RU.renderAttribute(name, value != null ? value : fallbackValue)
	}

	protected boolean isFieldRequired(Object bean, String fieldName) {
		def gdc = findGrailsDomainClass(bean.class)
		if (fieldName.indexOf('.') > -1) { // Hibernate embedded or widget embedded
			def split = fieldName.split('\\.')
			// try persistent property, before loading from DB
			def p = gdc ? gdc.getPersistentProperty(split[0]) : null
			if (p) {
				return RU.isRequired(p)
			}
			def b = bean."${split[0]}" // loading from DB
			if (b) {
				return RU.isRequired(b.constraints[split[1]])
			}
			fieldName = split[1]
		}
		if (gdc == null) { // command objects goes here
			return RU.isRequired(bean.constraints[fieldName])
		}
		def p = gdc.getPersistentProperty(fieldName)
		return p ? RU.isRequired(p) : false
	}

	protected String resolveResourceURL(String url) {
		def sep = (url.indexOf('?') == -1) ? '?' : '&amp;'
		def suffix = ''
		switch (Environment.current) {
			case Environment.DEVELOPMENT:
				suffix = "${sep}version=${new Date().getTime()}"
				break
			case Environment.TEST:
			case Environment.PRODUCTION:
			default:
				suffix = "${sep}version=${meta(name: 'app.version')}"
				break
		}
		"${url}${suffix}".toString()
	}

	def doctype = { attrs ->
		response.setHeader("X-UA-Compatible", "IE=edge,chrome=1")
		pageScope.doctype = 'xhtml5'
		out << doctypes['xhtml5']
	}

	/**
	 * This DIV element is a container for the form control and associated label for a given field in a given bean/entity (Domain Class or Command Object).
	 * It automatically detects if the field in question is required. If not provided, it does so by interpreting the possible constraints. If required a CSS class called 'required' is added.
	 * This DIV element is always given an id. If not provided, it is generated as 'decor-<value-of-field-attribute>'.
	 * @attr controller Optional The name of the controller. If not specified the implicit variable controllerName will be used.
	 * @attr domainInstance Optional Refers to the entity (Domain Class or Command Object) in question. If not specified, it will be detected.
	 * @attr field Required The name of a field in the entity.
	 * @attr required Optional If not specified, it will be detected.
	 * @attr errorClass Optional The class name to use for this DIV element in case of validation errors for this field. Defaults to 'error'.
	 * @attr renderFieldMessages Optional. Defaults to false
     * @attr firstMessageOnly Optional. If true only the first message will be displayed (if renderFieldMessages is true). Default is false
	 */
	def decorator = { attrs, body ->
		def cName = attrs.get('controller') ?: resolveControllerName()
		def domainInstanceKey = "${cName}${resolveDomainSuffix()}"
		def domainInstance = attrs.get('domainInstance') ?: resolveWebBean(domainInstanceKey)
		def field = attrs.get('field')
		assert !!domainInstance
		assert !!field
		def cls = attrs.get('class') ?: 'form-group decorator'
		def required = attrs.boolean('required')
		if (required == null) {
			required = isFieldRequired(domainInstance, field)
		}
		if (required && cls.indexOf('required') == -1) {
			cls = "${cls} required"
		}
		def title = ''
		def fieldErrors = domainInstance.errors.getFieldErrors(field)
		if (fieldErrors.size()) {
			def ec = attrs.get('errorClass') ?: 'error'
			cls = "${cls} ${ec}"
			title = message(error: fieldErrors[0])
		}
		out << renderElement('div', [title: title, 'class': cls, id: attrs.get('id') ?: "decor-${field}"]) << body()
        def renderFieldHelp = attrs.get('renderFieldHelp') ? attrs.boolean('renderFieldHelp') : true
        if (renderFieldHelp) {
            out << fieldHelp(domainInstance: domainInstance, field: field, domainClassProperty: attrs.get('domainClassProperty'), parentDomainClassProperty: attrs.get('parentDomainClassProperty'))
        }
		def renderFieldMessages = attrs.get('renderFieldMessages') ? attrs.boolean('renderFieldMessages') : true
		if (renderFieldMessages) {
			out << fieldMessages(domainInstance: domainInstance, field: field, firstMessageOnly: attrs.get('firstMessageOnly'))
		}
		out << '</div>'
	}

	/**
	 * This tag automatically detects which controller and action we're in, so you don't have to specify the action attribute.
	 * If no class attribute specified, it will look for the property grails.scaffolding.form.className in Config.groovy.
	 * @attr action Optional. If set to the empty string, the action attribute will be set to the servlet path (controller + action). Method cannot be GET then (will be altered)
	 * @attr method Optional.
	 * @attr enctype Optional.
	 * @attr multipart Optional. Should file upload be supported (sets the enctype attribute to multipart/form-data - but only if enctype not specified)
	 * @attr rest Optional. Should the action attribute/url be RESTful? If true a hidden field with name _method, which triggers the HiddenHttpMethodFilter in Spring, is added to the form. Can also be controlled by setting the property grails.scaffolding.form.rest to true or false in Config.groovy. Default is false.
	 * @attr novalidate Optional. Supports this new HTML5 attribute. Can be controlled centrally by setting the property grails.scaffolding.form.novalidate to true or false in Config.groovy. Default is true in order to use Spring Validation.
	 * @attr useToken Optional. Make the server generate a token to prevent submitting the form twice. Defaults to false.
	 * @attr preserveQueryString Optional. Preserve the query string parameters for the page in question by creating corresponding hidden fields? Defaults to false.
	 * @attr excludeQueryStringParams Optional. List of query string parameters to exclude. Only has effect if preserveQueryString is true.
	 */
	def form = { attrs, body ->
		def sb = new StringBuilder('<form role="form"')
		def validAttrNames = ['id', 'enctype', 'action', 'accept-charset', 'target', 'autocomplete', 'onkeypress', 'onchange', 'onsubmit']
		attrs.each { String k, Object v ->
//			def v = attrs.get(n)
			if (validAttrNames.contains(k) || k.startsWith('data-')) {
				sb << renderAttribute(k, v)
			}
		}
		def httpMethod = attrs.get('method')?.toLowerCase()
		if (!attrs.get('action')) {
			def a = '', empty = '' == attrs.get('action')
			boolean rest = attrs.containsKey('rest') ? attrs.boolean('rest') : !!grailsApplication.config.xtaglib.form.rest
			switch (actionName) {
				case 'show':
					// we're in the delete form on the show page
					httpMethod = 'post' // we don't support GET request for deletion
					if (empty) {
						a = '/show'
					}
					else if (rest) {
						httpMethod = 'delete'
					} else {
						a = '/delete'
					}
					break
				case 'copy':
					httpMethod = 'post'
					a = '/save'
					break
				case 'create':
				case 'save':
					// we're in the create form on the create page
					if (empty) {
						httpMethod = 'post' // get makes no sense here
						a = '/create'
					}
					else if (rest) {
						httpMethod = 'post'
					} else {
						a = '/save'
					}
					break
				case 'edit':
				case 'update':
					// we're in the edit form on the edit page
					if (empty) {
						httpMethod = 'post' // get makes no sense here
						a = '/edit'
					} else if (rest) {
						httpMethod = 'put'
					} else {
						a = '/update'
					}
					break
			}
			sb << renderAttribute('action', "${request.contextPath}/${resolveControllerName()}${a}")
		}
		def hiddenMethod = new StringBuilder()
		if (httpMethod) {
			switch (httpMethod) {
				case 'put':
				case 'delete':
					hiddenMethod << renderElement('input', [type: 'hidden', name: '_method', value: httpMethod.toUpperCase()])
					httpMethod = 'post'
					break
			}
		}
		boolean useToken = !!grailsApplication.config.xtaglib.form.useToken
		if (attrs.containsKey('useToken')) {
			useToken = attrs.boolean('useToken')
			attrs.remove('useToken')
		}
		def hiddenFields = new StringBuilder()
		if (useToken) {
			def tokensHolder = SynchronizerTokensHolder.store(session)
			hiddenFields << renderElement('input', [type: 'hidden', name: SynchronizerTokensHolder.TOKEN_KEY, value: tokensHolder.generateToken(request.forwardURI)])
			hiddenFields << renderElement('input', [type: 'hidden', name: SynchronizerTokensHolder.TOKEN_URI, value: request.forwardURI])
		}
		if (attrs.boolean('preserveQueryString')) {
			List<String> excludes = attrs.get('excludeQueryStringParams') ?: []
			params.each {
				if (!excludes.contains(it.key)) {
					def v = request.getParameter(it.key)
					if (v) {
						hiddenFields << renderElement('input', [type: 'hidden', name: it.key, value: v])
					}
				}
			}
		}
		if (!attrs.get('enctype') && attrs.boolean('multipart')) {
			sb << renderAttribute('enctype', 'multipart/form-data')
			httpMethod = 'post' // force post method
		}
		if (!httpMethod) {
			switch (actionName) {
				case 'show': // when deleting from show page with action attribute set as the empty string
				case 'create':
				case 'save':
				case 'edit':
				case 'update':
					httpMethod = 'post'
					break
				default:
					httpMethod = 'get'
					break
			}
		}
		sb << renderAttribute('method', httpMethod)
        List<String> cssClasses = []
        cssClasses.add(attrs.get('class') ?: (grailsApplication.config.xtaglib.form.className ?: ''))
        //cssClasses.add("scaffold-${actionName}")
        boolean ajaxEnabled = !!grailsApplication.config.xtaglib.form.ajaxEnabled
        if (ajaxEnabled) {
            cssClasses.add(grailsApplication.config.xtaglib.form.ajaxEnabledClassName ?: 'ajax-enabled')
        }
//		def cName = attrs.get('controller') ?: resolveControllerName()
//		def domainInstanceKey = cName ? "${cName}${resolveDomainSuffix()}" : ''
//		def domainInstance = domainInstanceKey ? (attrs.get('domainInstance') ?: resolveWebBean(domainInstanceKey)) : null
//        println "errors: ${domainInstance}"
//        if (domainInstance.errors.getErrorCount()) {
//            cssClasses.add('has-errors')
//        }
        sb << renderAttribute('class', cssClasses.join(' '))
		if (attrs.containsKey('novalidate')) {
			sb << renderAttribute('novalidate', attrs.boolean('novalidate'))
		} else {
			def novalidate = grailsApplication.config.xtaglib.form.novalidate instanceof Boolean ? grailsApplication.config.xtaglib.form.novalidate : true
			sb << renderAttribute('novalidate', novalidate)
		}
		out << sb.append('><div class="field-container">') << hiddenMethod << hiddenFields << body() << '</div></form>'
	}

	def hiddenId = { attrs ->
		def cName = attrs.get('controller') ?: resolveControllerName()
		def domainInstanceKey = "${cName}${resolveDomainSuffix()}"
		def domainInstance = attrs.get('domainInstance') ?: resolveWebBean(domainInstanceKey)
        DomainUtil.resolveIdParameters(domainInstance, grailsApplication).each { k, v ->
    		out << '<input type="hidden" name="' << k << '" value="' << v << '" />'
        }
	}

    def idAndVersion = { attrs ->
        def cName = attrs.get('controller') ?: resolveControllerName()
        def domainInstanceKey = "${cName}${resolveDomainSuffix()}"
        def domainInstance = attrs.get('domainInstance') ?: resolveWebBean(domainInstanceKey)
        DomainUtil.resolveIdParameters(domainInstance, grailsApplication).each { k, v ->
            out << '<input type="hidden" name="' << k << '" value="' << v << '" />'
        }
        if (domainInstance.hasProperty('version')) {
            out << '<input type="hidden" name="version" value="' << domainInstance.version << '" />'
        }
    }

    def label = { attrs, body ->
		def clazz = attrs.get('class') ?: 'label'
		out << '<label' << renderAttribute('title', attrs) << renderAttribute('for', attrs) << renderAttribute('class', clazz) << '>' << body() << '</label>'
	}

    def fieldHelp = { attrs ->
        def cName = attrs.get('controller') ?: resolveControllerName()
        def domainInstanceKey = "${cName}${resolveDomainSuffix()}"
        def domainInstance = attrs.get('domainInstance') ?: resolveWebBean(domainInstanceKey)
        def field = attrs.get('field')
        assert !!domainInstance
        assert !!field
        def cls = attrs.get('class') ?: 'field-help'
        String id = attrs.get('domainClassProperty') && attrs.get('parentDomainClassProperty') ? RU.resolveId(attrs.get('domainClassProperty'), attrs.get('parentDomainClassProperty')) + 'Help' : null
        out << '<div' << renderAttribute('class', cls) << renderAttribute('id', id) << '>' << message(code: attrs.get('code') ?: 'default.field.help', default: 'No help available') << '</div>'
    }

	/**
	 * This DIV element contains possible validation messages for the specified field in the given bean/entity (Domain Class or Command Object).
	 * @attr controller Optional The name of the controller. If not specified the implicit variable controllerName will be used.
	 * @attr domainInstance Optional Refers to the entity (Domain Class or Command Object) in question. If not specified, it will be detected.
	 * @attr field Required The name of a field in the entity.
     * @attr firstMessageOnly Optional. If true only the first message will be displayed. Default is false
	 */
	def fieldMessages = { attrs ->
		def cName = attrs.get('controller') ?: resolveControllerName()
		def domainInstanceKey = "${cName}${resolveDomainSuffix()}"
		def domainInstance = attrs.get('domainInstance') ?: resolveWebBean(domainInstanceKey)
		def field = attrs.get('field')
		assert !!domainInstance
		assert !!field
		def cls = attrs.get('class') ?: 'field-messages'
		def fieldErrors = domainInstance.errors.getFieldErrors(field)
		def size = fieldErrors.size()
		if (size > 0) {
			def ec = attrs.get('errorClass') ?: 'error'
			cls = "${cls} ${ec} has-messages"
		}
        def plural = !attrs.boolean('firstMessageOnly') && size > 1
        def htm = new StringBuilder()
        if (plural) {
            htm << '<ul>'
        }
        fieldErrors.eachWithIndex { err, i ->
            if (plural) {
                htm << "<li>${renderObjectError(err, domainInstance)}</li>"
            }
            else if (!i) {
                htm << renderObjectError(err, domainInstance)
            }
        }
        if (plural) {
            htm << '</ul>'
        }
		out << "<div${renderAttribute('class', cls)}>" << htm << '</div>'
	}

	// TODO: refactor
	def css = { attrs, body ->
		def id = attrs.get('id') ? ' id="' + attrs.get('id') + '"' : ''
		def media = attrs.get('media') ? ' media="' + attrs.get('media') + '"' : ''
		def type = attrs.get('type') ? ' type="' + attrs.get('type') + '"' : ' type="text/css"'
		def charset = attrs.get('charset') ? ' charset="' + attrs.get('charset') + '"' : ''
		def ic = attrs.get('ieComment')
		if (ic) {
			out.println('<!--[' + ic + ']>')
		}
		if (attrs.get('href')) {
			def rel = attrs.get('rel') ? ' rel="' + attrs.get('rel') + '"' : ' rel="stylesheet"'
			if (attrs.get('rel') && attrs.get('rel').indexOf('icon') > -1 && attrs.get('sizes')) {
				rel += ' sizes="' + attrs.get('sizes') + '"'
			}
			def href = attrs.get('href')
			//out << renderElement('link', [id: attrs.get('id'), media: attrs.get('media'), type: attrs.get('type') ?: 'text/css', href: resolveResourceURL(href)], true)
			def title = attrs.get('title') ?: ''
			if (title) {
				title = ' title="' + title + '"'
			}
			out.print '<link' + id + type + rel + ' href="' + resolveResourceURL(href) + '"' + media + charset + title + ' />'
		} else {
			out.println('<style' + id + type + charset + '>')
			out.print("/*<![CDATA[*/")
			out.print(body())
			out.println("/*]]>*/")
			out.print('</style>')
		}
		if (ic) {
			out.print('\n<![endif]-->')
		}
	}

	// TODO: refactor
	def script = { attrs, body ->
		def id = attrs.get('id') ? ' id="' + attrs.get('id') + '"' : ''
		def type = attrs.get('type') ? ' type="' + attrs.get('type') + '"' : ' type="text/javascript"'
		def charset = attrs.get('charset') ? ' charset="' + attrs.get('charset') + '"' : ''
		def ic = attrs.get('ieComment')
		if (ic) {
			out.println('<!--[' + ic + ']>')
		}
		if (attrs.get('src')) {
			def src = attrs.get('src')
			def locale = attrs.get('locale')
			if (locale && src.endsWith('.js')) {
				def l = "true".equalsIgnoreCase(locale) ? request.locale.language : locale
				src = src.replaceFirst('(\\.min\\.js|\\.js)', '_' + l + '$1')
			}
			out << '<script' + id + type + ' src="' + resolveResourceURL(src) + '"' + charset + '></script>'
		} else {
			out.println('<script' + id + type + charset + '>')
			out.print("/*<![CDATA[*/")
			out.print(body())
			out.println("/*]]>*/")
			out.print('</script>')
		}
		if (ic) {
			out.print('\n<![endif]-->')
		}
	}

	/**
	 * @attrs controller optional. Defaults to current controller
	 * @attrs domainInstance optional
	 * @attrs term optional. Defaults to true
	 */
	def messages = { attrs, body ->
		StringBuilder sb = new StringBuilder()
		def hasMessages = flash.message != null
		def msgs = request.messages // TODO: refactor: should be SpringMessage instances (create class SpringMessage with support for severity)
		def cName = attrs.get('controller') ?: resolveControllerName()
		def domainInstanceKey = "${cName}${resolveDomainSuffix()}"
		def domainInstance = attrs.get('domainInstance') ?: resolveWebBean(domainInstanceKey)
		def errors = (!msgs || msgs.size() == 0) ? domainInstance?.errors?.allErrors : null
		def hasErrors = (msgs && msgs.size() > 0) || (errors && errors.size() > 0)
		if (hasErrors) {
			hasMessages = true
		}
		sb << '<div' << renderAttribute('id', attrs.id) << ' class="server-messages'
		if (hasMessages) {
			sb << ' has-messages'
		}
		if (hasErrors) {
			sb << ' error-messages'
		}
		sb << '" role="status">'
		if (flash.message) {
			sb << flash.message
		}
		else if (hasErrors) {
			sb << '<dl>'
			def useDefinitionTerm = attrs.boolean('term')
			if (useDefinitionTerm == null || useDefinitionTerm) {
				sb << '<dt>' << message(code: 'errors.dt') << '</dt>'
			}
			if (msgs && msgs.size() > 0) {
				msgs.each {
					sb << "<dd>${it}</dd>"
				}
			} else {
				XTagLib.sortedErrors(domainInstance, grailsApplication).each {
					sb << "<dd>${renderObjectError(it, domainInstance)}</dd>"
				}
			}
			sb << '</dl>'
		}
		sb << '</div>'
		out << sb.toString()
	}

	def selectLocale = { attrs ->
		attrs['class'] = attrs.get('class') ?: 'form-control select'
		attrs['from'] = (servletContext.getAttribute(LocaleFilter.SUPPORTED_LOCALES) ?: Locale.availableLocales).sort { it.getDisplayName(it).toLowerCase() }
		def map = [:]
		map.put null, message(code: 'select.locale.none') // necessary to add a null key this way, otherwise null will be interpreted as a string
		attrs['noSelection'] = map
		// set the option value as a closure that formats the locale for display
		attrs['optionValue'] = {
			it == request.locale ? it.getDisplayName(it) : "${it.getDisplayName(request.locale)} (${it.getDisplayName(it)})"
		}
		out << select(attrs)
	}

	def button = { attrs, body ->
		def id = renderAttribute('id', attrs)
		def type = renderAttribute('type', attrs, 'submit')
		def name = renderAttribute('name', attrs)
		def clazz = renderAttribute('class', attrs, 'button')
		def htm = "${body()}"
		out.println('<!--[if lte IE 6]>')
		//out.println('<input' + id + type + name + clazz + ' value="' + htm.encodeAsHtml() + '" />')
        out.println('<input' + id + type + name + clazz + ' value="' + htm + '" />')
		out.println('<![endif]-->')
		out.println('<!--[if gte IE 7]>')
		out.print('<button' + id + type + name + clazz + '>')
		out.print(htm)
		out.println('</button>')
		out.println('<![endif]-->')
		out.println('<!--[if !IE]><-->')
		out.print('<button' + id + type + name + clazz + '>')
		out.print(htm)
		out.println('</button>')
		out.print('<!--><![endif]-->')
	}

	def verbatim = { attrs, body ->
		out << body().encodeAsHTML()
        //out << body()
	}

	def pre = { attrs, body ->
		//out << '<pre class="code">' << body().encodeAsHtml() << '</pre>'
        out << '<pre class="code">' << body() << '</pre>'
	}

	def requiredDescription = { attrs, body ->
		out << '<div class="required-description">' << message(code: 'required.description') << '</div>'
	}

	def actionsAndLinks = { attrs, body ->
		def cName = attrs.get('controller') ?: resolveControllerName()
  		StringBuilder sb = null
		def actionsAndLinksList = resolveWebBean('actionsAndLinks')
		if (actionsAndLinksList) {
	  		sb = new StringBuilder()
			actionsAndLinksList.each { map ->
				def action = map.action
				def type = map.remove('type')
				def controller = map.controller ?: cName
				if (type) {
					def code = map.remove('code') ?: "${controller}.button.${action}.label"
					def defaultCode = map.remove('defaultCode') ?: "default.button.${action}.label"
					sb << '<button class="button ' << action << '" type="' << type << '"'
					def name = map.name
					if (name) {
						sb << ' name="' << name << '"'
					}
					sb << '>' << message(code: code, default: message(code: defaultCode)) << '</button>'
				} else {
					def name = map.remove('name') ?: action
					def code = map.remove('code') ?: "${controller}.button.${name}.label"
					def defaultCode = map.remove('defaultCode') ?: "default.button.${name}.label"
					def href = map.href ?: createLink(map).encodeAsHTML()
					sb << '<a class="action-link ' << name << '" href="' << href << '">' << message(code: code, default: message(code: defaultCode)) << '</a>'
				}
			}
		}
		if (sb) {
			out << sb
		}
		out << body()
	}

	def createActions = actionsAndLinks
	def showActions = actionsAndLinks
	def editActions = actionsAndLinks

	def navigation = { attrs, body ->
		def cName = attrs.get('controller') ?: resolveControllerName()
  		StringBuilder sb = null
		def navigationLinkList = resolveWebBean('navigationLinks')
		if (navigationLinkList) {
	  		sb = new StringBuilder()
			sb << '<nav role="navigation"><ul class="nav">'
			navigationLinkList.each { map ->
				def action = map.action
				def controller = map.controller ?: cName
				def code = map.remove('code') ?: "${controller}.${action}.label"
				def href = map.href ?: createLink(map).encodeAsHTML()
				sb << '<li><a class="'
				if (action) {
					sb << action << ' '
				}
				sb << 'create-' << controller << '" href="' << href << '">' << message(code: code, args: [controller]) << '</a></li>'
			}
		}
		if (sb) {
			out << sb << body() << '</ul></nav>'
		} else {
			def s = body()
			if (s) {
				out << '<nav role="navigation"><ul class="nav">' << s << '</ul></nav>'
			}
		}
	}

	def listNavigation = navigation
	def showNavigation = navigation
	def createNavigation = navigation
	def editNavigation = navigation

	protected String renderFieldBlock(GrailsDomainClassProperty p, GrailsDomainClassProperty parentProp = null, Object rec, StringBuilder sb = null) {
		boolean returnNull = true
		if (sb == null) {
			returnNull = false
			sb = new StringBuilder()
		}
		sb << '<div class="field-block">\n'
		sb << '<span id="' << RU.resolveId(p, parentProp) << '-label" class="property-label">' << resolveMessageForProperty(p) << '</span>\n'
		def value = resolveValue(p, parentProp, rec)
		sb << '<div class="property-value" aria-labelledby="' << p.name << '-label" contenteditable="' << (value != null && !p.isAssociation() && Collection.isAssignableFrom(p.type)) << '">'
		renderPropertyValue(p, value, rec, sb)
		sb << '</div>\n</div>\n'
		returnNull ? null : sb as String
	}

	protected boolean isOptionSelected(Object keyValue, Object value, Object el = null) {
		boolean selected = false
		def keyClass = keyValue?.getClass()
		if (keyClass?.isInstance(value)) {
			selected = (keyValue == value)
		}
		else if (value instanceof Collection) {
			// first try keyValue
			selected = value.contains(keyValue)
			if (!selected && el != null) {
				selected = value.contains(el)
			}
		}
		// GRAILS-3596: Make use of Groovy truth to handle GString <-> String
		// and other equivalent types (such as numbers, Integer <-> Long etc.).
		else if (keyValue == value) {
			selected = true
		}
		else if (keyClass && value != null) {
			try {
				def typeConverter = new SimpleTypeConverter()
				value = typeConverter.convertIfNecessary(value, keyClass)
				selected = (keyValue == value)
			}
			catch (e) {
				// ignore
			}
		}
		selected
	}

	protected String renderNoSelectionOption(String noSelectionValue, String noSelectionText, Object value) {
		// TODO: Finish
		//RU.renderElement('option', [value: noSelectionValue, selected: noSelectionValue == value?.toString()]) + noSelectionText.encodeAsHtml() + '</option>'
        RU.renderElement('option', [value: noSelectionValue, selected: noSelectionValue == value?.toString()]) + noSelectionText + '</option>'
	}

	def showFields = { attrs, body ->
		def cName = attrs.get('controller') ?: resolveControllerName()
		def domainInstanceKey = "${cName}${resolveDomainSuffix()}"
		def domainInstance = attrs.get('domainInstance') ?: resolveWebBean(domainInstanceKey)
		def sortedFields = attrs.get('sortedFields') ?: resolveWebBean('sortedFields')
        def showFieldTemplates = resolveWebBean('showFieldTemplates')
		def htm = new StringBuilder()
		htm << idAndVersion(attrs) << '\n'
		RU.getSortedPersistentProperties(findGrailsDomainClass(domainInstance.class), sortedFields).each { p ->
			if (p.isEmbedded()) {
				//htm << '</fieldset><fieldset><legend>' << message(code: "${p.name}.legend") << '</legend>'
				RU.getSortedPersistentProperties(p.component).each { ep ->
                    if (showFieldTemplates?.containsKey(ep.name)) {
                        def renderer = showFieldTemplates.get(ep.name)
                        def value = resolveValue(ep, p, domainInstance)
                        if (renderer instanceof Closure) {
                            renderer.call(ep.name, p.name, domainInstance, value)
                        }
                        else if (renderer instanceof String) {
                            htm << render(template: renderer, bean: domainInstance, var: 'domainInstance', model: [field: ep.name, parentField: p.name, value: value])
                        }
                    } else {
					    renderFieldBlock(ep, p, domainInstance, htm)
                    }
				}
                //htm << '</fieldset><fieldset><legend>' << message(code: "${p.name}.legend") << '</legend>'
			} else {
                if (showFieldTemplates?.containsKey(p.name)) {
                    def renderer = showFieldTemplates.get(p.name)
                    def value = resolveValue(p, null, domainInstance)
                    if (renderer instanceof Closure) {
                        renderer.call(p.name, null, domainInstance, value)
                    }
                    else if (renderer instanceof String) {
                        htm << render(template: renderer, bean: domainInstance, var: 'domainInstance', model: [field: p.name, value: value])
                    }
                } else {
    				renderFieldBlock(p, null, domainInstance, htm)
                }
			}
		}
		out << htm
	}

	def formFields = { attrs, body ->
		def cName = attrs.get('controller') ?: resolveControllerName()
		def domainInstanceKey = "${cName}${resolveDomainSuffix()}"
		def domainInstance = attrs.get('domainInstance') ?: resolveWebBean(domainInstanceKey)
        def sortedFields = attrs.get('sortedFields') ?: resolveWebBean('sortedFields')
		def gdc = findGrailsDomainClass(domainInstance.class)
		def htm = new StringBuilder()
		//htm << '<input type="hidden" name="prevReferer" value="' << (params['prevReferer'] ?: (request.getHeader('referer') ?: '')) << '" />'
		def excludedPropNames = ['id', 'version', 'dateCreated', 'lastUpdated', 'errors']
		def sortedPersistentProperties = RU.getSortedPersistentProperties(gdc, sortedFields).findAll { !excludedPropNames.contains(it.name) }
		def formFieldTemplates = resolveWebBean('formFieldTemplates')
		sortedPersistentProperties.each { p ->
			def isEmbedded = p.embedded || gdc.constrainedProperties[p.name]?.widget == 'embedded'
			if (isEmbedded) {
				def egdc = p.embedded ? p.component : findGrailsDomainClass(p.type)
				RU.getSortedPersistentProperties(egdc).findAll { !excludedPropNames.contains(it.name) }.each { ep ->
					if (formFieldTemplates?.containsKey(ep.name)) {
                        def renderer = formFieldTemplates.get(ep.name)
                        def value = resolveValue(ep, p, domainInstance)
                        if (renderer instanceof Closure) {
                            renderer.call(ep.name, p.name, domainInstance, value)
                        }
                        else if (renderer instanceof String) {
                            htm << render(template: renderer, bean: domainInstance, var: 'domainInstance', model: [field: ep.name, parentField: p.name, value: value])
                        }
					} else {
						renderFieldForProperty(ep, p, domainInstance, htm)
					}
				}
			} else {
				if (formFieldTemplates?.containsKey(p.name)) {
                    def renderer = formFieldTemplates.get(p.name)
                    def value = resolveValue(p, null, domainInstance)
                    if (renderer instanceof Closure) {
                        renderer.call(p.name, null, domainInstance, value)
                    }
                    else if (renderer instanceof String) {
                        htm << render(template: renderer, bean: domainInstance, var: 'domainInstance', model: [field: p.name, value: value])
                    }
				} else {
					renderFieldForProperty(p, null, domainInstance, htm)
				}
			}
		}
		out << htm
	}

	// TODO: Split into sortColumn and createSortLink tag
	/**
	 * Generates a TH element with a nested A element. Unless the path attribute is specified, the href attribute of the nested A element begins with a question mark.
	 * Any existing URL parameters are preserved.
	 * @attr field Required. Name of field or property to sort by.
     * @attr excludeParams Optional. List of parameter names to exclude (can be convienent, fx if (re)sorting should reset possible pagination)
	 * @attr path Optional. The part of the URL before the question mark.
	 * @attr sortParameterName Optional. Name of request parameter for sorting. Defaults to 'sort'.
	 * @attr orderParameterName Optional. Name of request parameter for sort order. Defaults to 'order'.
	 * @attr defaultOrder Optional. Defaults to 'asc'.
	 */
	def sortColumn = { attrs, body ->
		def sort = attrs.remove('field')
		assert !!sort // do not allow null nor empty string
		String sortParameterName = attrs.remove('sortParameterName') ?: 'sort'
		String orderParameterName = attrs.remove('orderParameterName') ?: 'order'
		def currentSort = params."$sortParameterName" // important to lookup in params instead of using request.getParameter
		def defaultOrder = attrs.remove('defaultOrder') ?: 'asc'
		def currentOrder = currentSort == sort ? params."$orderParameterName" : '' // important to lookup in params instead of using request.getParameter
		def order = defaultOrder
		def cls = 'sortable'
		if (currentOrder) { // toggle order
			order = currentOrder == 'asc' ? 'desc' : 'asc'
			cls = "${cls} sorted ${currentOrder}"
		}
		def clazz = attrs.get('class')
		if (clazz) {
			cls = "${cls} ${clazz}"
		}
		attrs.'class' = cls
		// Transform request paramater map into linked hash map. The transformed values are URL encoded in UTF-8.
		// The Servlet Spec does not dictate any conecpt of order for request parameters, but the underlying implementation may do so and we do not wanna break that
		Map<String, List<String>> parameters = new LinkedHashMap<String, List<String>>() // preserve (insertion) order even though request.getParameterMap returns a map with no concept of order
		request.parameterMap.collectEntries(parameters) { k, v -> // k is a String, v is a String[]
			[k, v.collect { URLEncoder.encode(it, 'UTF-8') }]
		}
		// make the order predictable by always removing keys sortParameterName and orderParameterName
		if (parameters.containsKey(sortParameterName)) {
			parameters.remove sortParameterName
		}
		parameters.put sortParameterName, [sort]
        if (parameters.containsKey(orderParameterName)) {
			parameters.remove orderParameterName
		}
		parameters.put orderParameterName, [order]
        def excludes = attrs.remove('excludeParams')
        if (excludes) {
            parameters.keySet().removeAll(excludes)
        }
        def href = new StringBuilder("${attrs.remove('path')?:''}?")
		def sep = '&' // do not HTML encode here - will be done automatically by renderAttribute (called by renderElement)
		href << parameters.collect({ key, valueList ->
			def sb = new StringBuilder()
			valueList.eachWithIndex { v, i ->
				if (i) {
					sb << sep
				}
				sb << "${key}=${v}"
			}
			sb as String
		}).join(sep)
		def code = attrs.remove('titleKey') ?: "${resolveControllerName()}.${sort}.label"
		def msg = attrs.remove('text') ?: message(code: code)
		out << renderElement('th', attrs) << renderElement('a', [href: href as String]) << msg << '</a></th>'
	}

	/**
	 * @attr domainInstanceClass Optional. If not specified, it will be looked up in page scope, then request scope. It must be found.
	 * @attr domainInstanceList Optional. A list of domain class instances. If not specified looked up in page scope, then request scope. Must be found. The key will be the controller name followed by the domainSuffix specified in Config.groovy and then followed by 'List'.
	 * @attr controller Optional. Defaults to the value of the implicit variable controllerName.
	 */
	// TODO: Add support for batch deleting and scroll pagination
	def dataTable = { attrs, body ->
		Class domainClass = attrs.get('domainInstanceClass') ?: resolveWebBean('domainInstanceClass')
		assert domainClass != null
		def gdc = findGrailsDomainClass(domainClass)
		assert gdc != null
		def cName = attrs.get('controller') ?: resolveControllerName()
		def domainInstanceListKey = "${cName}${resolveDomainSuffix()}List"
		def domainInstanceList = attrs.get("domainInstanceList") ?: resolveWebBean(domainInstanceListKey)
		assert domainInstanceList != null
		def sortedFields = attrs.get('sortedFields') ?: (pageScope.'sortedFields' ?: request.'sortedFields')
		def sortedPersistentProperties = RU.getSortedPersistentProperties(gdc, sortedFields)
		def tbody = new StringBuilder(), thead = new StringBuilder()
		if (domainInstanceList.size()) {
			def renderTD = { p, rec, i, sb, parentProp = null ->
				def v = parentProp ? rec?."${parentProp.name}"?."${p.name}" : rec?."${p.name}"
				sb << '<td'
				if (i == 0 && rec?.id != null) {
					sb << ' rel="' << rec.id << '"'
				}
				def cls = getStyleClassForProperty(p)
				if (cls) {
					sb << ' class="' << cls << '"'
				}
				sb << '><div class="cell-content">'
				if (i == 0) {
					def linkMapping = getLinkMapping(rec)
					if (linkMapping) {
						//sb << '<a href="' << createLink(linkMapping).encodeAsHTML() << '" title="' << rec.toString().encodeAsHtml() << '">' << (renderPlainPropertyValue(p, v, rec) ?: 'N/A') << '</a>'
                        sb << '<a href="' << createLink(linkMapping) << '" title="' << rec.toString() << '">' << (renderPlainPropertyValue(p, v, rec) ?: 'N/A') << '</a>'
					} else {
						sb << (renderPlainPropertyValue(p, v, rec) ?: 'N/A')
					}
				} else {
					renderPropertyValue(p, v, rec, sb)
				}
				sb << '</div></td>'
			}
			def renderTH = { p, sb, parentProp = null ->
				if (p.isAssociation()) {
					if (Comparable.isAssignableFrom(p.referencedPropertyType) || Comparator.isAssignableFrom(p.referencedPropertyType)) {
						sb << sortColumn(field: p.name, rel: p.name)
					} else {
						sb << '<th rel="' << p.name << '">' << message(code: "${p.domainClass.propertyName}.${p.name}.label") << '</th>'
					}
				} else {
					def cls = ''
					if (Number.isAssignableFrom(p.type)) {
						cls = 'number'
					}
					else if (p.type == Date || p.type == java.sql.Date || p.type == java.sql.Time || p.type == Calendar) {
						cls = 'date'
					}
					if (parentProp) {
						sb << '<th'
						if (cls) {
							sb << ' class="' << cls << '"'
						}
						sb << ' rel="' << p.name << '">' << message(code: "${parentProp.name}.${p.name}.label") << '</th>'
					} else {
						sb << sortColumn(field: p.name, rel: p.name, 'class': cls)
					}
				}
			}
			thead << '<thead><tr>'
			tbody << '<tbody>'
			domainInstanceList.eachWithIndex { rec, i ->
                def rowClass = i % 2 == 1 ? 'even' : 'odd'
				tbody << '<tr class="data-table-row ' << rowClass << '">'
				def count = 0
				sortedPersistentProperties.each { p ->
					if (p.isEmbedded()) {
						RU.getSortedPersistentProperties(p.component).eachWithIndex { it, n ->
							if (i == 0) {
								renderTH.call(it, thead, p)
							}
							renderTD.call(it, rec, count + n, tbody, p)
						}
						count++
					}
                    else if (p.type != ([] as Byte[]).class && p.type != byte[].class) {
						if (i == 0) {
							renderTH.call(p, thead)
						}
						renderTD.call(p, rec, count, tbody)
						count++
					}
				}
				tbody << '</tr>'
			}
			thead << '</tr></thead>'
			tbody << '</tbody>'
		} else {
			def renderTH = { p, sb, parentProp = null ->
				def code = parentProp ? "${parentProp.name}.${p.name}.label" : "${p.domainClass.propertyName}.${p.name}.label"
				sb << '<th>' << message(code: code) << '</th>'
			}
			thead << '<thead><tr>'
			sortedPersistentProperties.each { p ->
				if (p.isEmbedded()) {
					RU.getSortedPersistentProperties(p.component).eachWithIndex { it, n ->
						renderTH.call(it, thead, p)
					}
				} else {
					renderTH.call(p, thead)
				}
			}
			thead << '</tr></thead>'
			tbody << '<tbody><tr><td colspan="' << sortedPersistentProperties.size() << '">' << message(code: "${cName}.list.empty", default: message(code: 'default.list.empty')) << '</td></tr></tbody>'
		}
		out << '<table class="data-table ' << "${cName}-table" << '" title="' << message(code: "${cName}.dataTable.title") << '">' << thead << tbody << '</table>'
	}

	// TODO: Add support for batch deleting and scroll pagination
	/**
	 * @attr columns Required. List of column names (String)
	 * @attr collection Required.
	 * @attr sortableColumns Optional. List of column names that are to be sortable. Or a boolean where true means all columns are sortable.
	 * @attr excludeParams. Optional. List of parameter names that are to be excluded from the column URL
	 * @attr rowClass Optional. A style class name to add to each TR element. Each TR element will also be given a odd/even class name to support alternating row colors.
	 * @attr rowAttribute Optional. rowAttribute to set on row in the data table: [attrName: name, colName: colB]
	 * @attr templates Optional. Must be a map of template names (String) to apply for cells in the data table: [colA: templateA, colB: templateB]. There does not need to be a template for each column. The template will be passed the record, the index of the row and the name of the column (field name in record).
	 * @attr columnTemplates Optional. Must be a map of template names (String) to apply for header cells in the data table: [colA: templateA, colB: templateB]. There does not need to be a template for each column. The template will be passed the index of the column and the name of the column (field name).
	 * @attr headerMessages Optional. Must be a map of headers (String) to apply for header cells in the data table: [colA: textA, colB: textB]. There does not need to be a value for each column.
	 * @attr converters Optional. Must be a map of closures to convert cells in the data table: [colA: closureA, colB: closureB]. There does not need to be a closure for each column. The closure will be passed the record and the index of the row.
	 * @attr sortParameterName Optional. Name of request parameter for sorting. Defaults to 'sort'.
	 * @attr orderParameterName Optional. Name of request parameter for sort order. Defaults to 'order'.
	 * @attr defaultOrder Optional. Defaults to 'asc'.
	 * @attr dataTableTitle Optional. Message code to use for table title attribute.
	 * @attr dataTableEmpty Optional. Message code to use when no records in collection. Default value 'default.dataTable.empty'.
	 */
	def dataTable2 = { attrs, body ->
		Collection columns = attrs.get('columns')
		Map<String, Closure> converters = attrs.get('converters')
		Map<String, String> templates = attrs.get('templates')
		Map<String, String> columnTemplates = attrs.get('columnTemplates')
		Map<String, String> headerMessages = attrs.get('headerMessages')
		out << '<div' << renderAttribute('id', attrs.get('id')) << ' class="data-table-wrapper">\n'

		def tableAtributes = ['class': 'data-table'];
		if(attrs.dataTableTitle) {
			tableAtributes.put('title', message(code: attrs.get('dataTableTitle')))
		}
		out << renderElement('table', tableAtributes)
		out << '<thead>\n<tr>'
		Collection collection = attrs.get('collection')
		def noOfRecs = collection?.size()
		if (columns?.size()) {
			def sortableCols = attrs.boolean('sortableColumns') ? columns : attrs.get('sortableColumns')
			def excludeParams = attrs.remove('excludeParams')
			columns.eachWithIndex { col, i ->
				if (columnTemplates?.containsKey(col)) {
					out << render(template: columnTemplates.get(col), model: [index: i, fieldName: col])
				}
				else if (noOfRecs && sortableCols?.contains(col)) {
					out << sortColumn(field: col, excludeParams: excludeParams, sortParameterName: attrs.get('sortParameterName'), orderParameterName: attrs.get('orderParameterName'), defaultOrder: attrs.get('defaultOrder'))
				}
				else if (headerMessages?.containsKey(col)) {
					out << '<th>' << headerMessages.get(col) << '</th>'
				}
				else {
					out << '<th>' << message(code: "${controllerName}.${col}.label") << '</th>'
				}
			}
		} else {
			out << '<th colspan="0">&nbsp;</th>'
		}
		out << '</tr>\n</thead>\n'
		if (noOfRecs) {
			assert columns.size()
			out << '<tbody>\n'
			def rowClass = attrs.get('rowClass')
			def rowAttr = attrs.get('rowAttribute')
			collection.eachWithIndex { rec, i ->
				def cls = (i % 2 ? 'odd' : 'even')
				if (rowClass) {
					cls = "${cls} ${rowClass}"
				}
				def rowAttributes = ['class': cls]
				if(rowAttr) {
					rowAttributes.put(rowAttr.attrName, rec[rowAttr.colName]);
				}
				out << renderElement('tr', rowAttributes)
				columns.each { col ->
					def v = ''
					if (templates?.containsKey(col)) {
						v = render(template: templates.get(col), model: [record: rec, index: i, fieldName: col])
					}
					else if (converters?.containsKey(col)) {
						v = converters.get(col).call(rec, i)
					} else {
						v = rec[col]
					}
					out << '<td>' << v << '</td>'
				}
				out << '</tr>\n'
			}
			out << '</tbody>'
		} else {
			out << '<tbody class="no-records">\n'
			out << '<tr><td colspan="' << (columns?.size() ?: 0) << '">' << message(code: attrs.get('dataTableEmpty') ?: 'default.dataTable.empty') << '</td></tr>\n'
			out << '</tbody>'
		}
		out << '\n</table>\n</div>'
	}

	def input = { attrs, body ->
		def type = attrs.get('type') ?: 'text'
		def cls = type == 'text' ? 'form-control text' : "form-control text ${type}"
		out << RU.renderElement('input', [type: type, 'class': cls].plus(attrs), true)
	}

    /**
     * A helper tag for creating HTML selects.<br/>
     * Examples:<br/>
     * &lt;gx:select name="user.age" from="${18..65}" value="${age}" /&gt;<br/>
     * &lt;gx:select name="user.company.id" from="${Company.list()}" value="${user?.company.id}" optionKey="id" /&gt;<br/>
     *
     * @emptyTag
     *
     * @attr name REQUIRED the select name
     * @attr id the DOM element id - uses the name attribute if not specified
     * @attr from REQUIRED The list or range to select from
     * @attr keys A list of values to be used for the value attribute of each "option" element.
     * @attr optionKey By default value attribute of each &lt;option&gt; element will be the result of a "toString()" call on each element. Setting this allows the value to be a bean property of each element in the list.
     * @attr optionValue By default the body of each &lt;option&gt; element will be the result of a "toString()" call on each element in the "from" attribute list. Setting this allows the value to be a bean property of each element in the list.
     * @attr value The current selected value that evaluates equals() to true for one of the elements in the from list.
     * @attr multiple boolean value indicating whether the select a multi-select (automatically true if the value is a collection, defaults to false - single-select)
     * @attr valueMessagePrefix By default the value "option" element will be the result of a "toString()" call on each element in the "from" attribute list. Setting this allows the value to be resolved from the I18n messages. The valueMessagePrefix will be suffixed with a dot ('.') and then the value attribute of the option to resolve the message. If the message could not be resolved, the value is presented.
     * @attr noSelection A single-entry map detailing the key and value to use for the "no selection made" choice in the select box. If there is no current selection this will be shown as it is first in the list, and if submitted with this selected, the key that you provide will be submitted. Typically this will be blank - but you can also use 'null' in the case that you're passing the ID of an object
     * @attr disabled boolean value indicating whether the select is disabled or enabled (defaults to false - enabled)
     * @attr readonly boolean value indicating whether the select is read only or editable (defaults to false - editable)
     */
	def select = { attrs, body ->
        if (!attrs.get('name')) {
            throwTagError('Tag [select] is missing required attribute [name]')
        }
		if (!attrs.get('id')) {
			attrs.put('id', RU.cleanId(attrs.get('name')))
		}
		def optionsKeys = ['from', 'value', 'keys', 'optionKey', 'optionValue', 'noSelection', 'valueMessagePrefix']
		def optionsAttrs = [:]
		optionsKeys.each { k ->
			if (attrs.containsKey(k)) {
				optionsAttrs.put k, attrs.remove(k)
			}
		}
		out << renderElement('select', attrs) << '\n' << options(optionsAttrs, body) << '</select>'
	}

	def options = { attrs, body ->
        if (!attrs.containsKey('from')) {
            throwTagError('Tag [options] is missing required attribute [from]')
        }
		def value = attrs.remove('value')
		if (value instanceof Collection && attrs.multiple == null) {
			attrs.multiple = 'multiple'
		}
		if (value instanceof CharSequence) {
			value = value.toString()
		}
		def valueMessagePrefix = attrs.remove('valueMessagePrefix')
		def noSelection = attrs.remove('noSelection')
		if (noSelection != null) {
			noSelection = noSelection.entrySet().iterator().next()
		}
		def from = attrs.remove('from')
		assert from != null
		if (noSelection) {
			out << renderNoSelectionOption(noSelection.key, noSelection.value, value) << '\n'
		}
		def messageSource = grailsAttributes.getApplicationContext().getBean("messageSource")
		def locale = RCU.getLocale(request)
		def keys = attrs.remove('keys')
		def optionKey = attrs.remove('optionKey')
		def optionValue = attrs.remove('optionValue')
		from.eachWithIndex { el, i ->
			// resolve option value and selected
			def keyValue = null
			boolean selected = false
			if (keys) {
				keyValue = keys[i]
				selected = isOptionSelected(keyValue, value)
			}
			else if (optionKey) {
				def keyValueObject = null
				if (optionKey instanceof Closure) {
					keyValue = optionKey(el)
				}
				else if (el != null && optionKey == 'id' && grailsApplication.getArtefact(DomainClassArtefactHandler.TYPE, el.getClass().name)) {
					keyValue = el.ident()
					keyValueObject = el
				}
				else {
					keyValue = el[optionKey]
					keyValueObject = el
				}
				selected = isOptionSelected(keyValue, value, keyValueObject)
			} else {
				keyValue = el
				selected = isOptionSelected(keyValue, value)
			}
			// resolve option text
			def optionText = ''
			if (optionValue) {
				if (optionValue instanceof Closure) {
					//optionText = optionValue(el).toString().encodeAsHtml()
                    optionText = optionValue(el).toString()
				} else {
					//optionText = el[optionValue].toString().encodeAsHtml()
                    optionText = el[optionValue].toString()
				}
			}
			else if (el instanceof MessageSourceResolvable) {
				optionText = messageSource.getMessage(el, locale) // do not HTML encode
			}
			else if (valueMessagePrefix) {
				def message = messageSource.getMessage("${valueMessagePrefix}.${keyValue}", null, null, locale)
				if (message != null) {
					optionText = message // do not HTML encode
				}
				else if (keyValue && keys) {
					def s = el.toString()
					if (s) {
						//optionText = s.encodeAsHtml()
                        optionText = s
					}
				}
				else if (keyValue) {
					//optionText = keyValue.encodeAsHtml()
                    optionText = keyValue
				} else {
					def s = el.toString()
					if (s) {
						//optionText = s.encodeAsHtml()
                        optionText = s
					}
				}
			} else {
				def s = el.toString()
				if (s) {
					//optionText = s.encodeAsHtml()
                    optionText = s
				}
			}
			out << renderElement('option', [value: keyValue, selected: selected]) << optionText << '</option>\n'
		}
	}

	/**
	 * @attr name required
	 * @attr value required
	 * Can be used for Boolean types as well, i.e. non-primitive boolean. Then a third option is possible; namely null (neither is checked)
	 */
    def booleanRadio = { attrs, body ->
        def n = attrs.get('name')
        def v = attrs.get('value')
        def id = attrs.get('id') ?: n
        [true, false].eachWithIndex { b, i ->
            def rid = i ? "${id}_${b}" : "${id}"
            out << '<span class="radio-set">'
	        out << '<input type="radio"' << renderAttribute('id', "${rid}") << renderAttribute('name', n) << renderAttribute('checked', v == b) << renderAttribute('class', 'form-control radio') << ' value="true" />'
	        out << '<label for="' << rid << '">' << message(code: "default.boolean.${b}") << '</label>'
	        out << '</span>'
        }
    }

	/**
	 * @attr name required
	 * @attr value required
	 * Should be used for primitive booleans
	 */
    def booleanCheckbox = { attrs, body ->
        def n = attrs.get('name')
        def v = attrs.get('value')
        def id = attrs.get('id') ?: n
	    out << '<input type="hidden" name="_' << n << '" />' // necessary for Spring binding - If the checkbox changes from checked to unchecked the browser do not submit the field, so without the hidden field it is impossible for the data binding to see the change
        def checked = attrs.boolean('value')
        out << '<input type="checkbox"' << renderAttribute('id', id) << renderAttribute('name', n) << renderAttribute('checked', checked) << ' class="checkbox" />'
    }

    def formatValue = { attrs, body ->
        def v = attrs.get('value')
        switch (v) {
            case Calendar:
            case Date:
                out << formatDate(date: v, format: attrs.get('format') ?: message(code: 'default.date.format'))
                break
            case Number:
                out << formatNumber(number: v, format: attrs.get('format') ?: message(code: 'default.number.format'))
                break
            default:
                out << v
                break
        }
    }

	/**
	 * @attrs value Required. The String value to format
	 * @attrs regex Defaults to '([0-9]{2})'
	 * @attrs replacement Defaults to '$1 '
	 */
	def formatPhoneNumber = { attrs, body ->
		def v = attrs.get('value')
		def regex = attrs.get('regex') ?: '([0-9]{2})'
		def replacement = attrs.get('replacement') ?: '$1 '
		out << (attrs.get('prefix') ?: '') << v.replaceAll(regex, replacement).trim()
	}

	/**
	 * @attrs code Required. The key or code to look for in messages.properties
	 * @attrs total Required. Total results
	 * @attrs query Optional. The query or term that was used for this result set
	 */
	def paginate = { attrs, body ->
        Integer total = attrs.int('total')
        if (total) {
            out << '<div class="paginate-bar" rel="' << total << '">'
            def code = attrs.remove('code') ?: 'paginate.message'
            def query = attrs.remove('query')
            int offset = total ? (params.int('offset') ?: 0) : 0
            int max = params.int('max') ?: 10
            int page = 1 + (offset - offset % max) / max
            int remainder = total % max
            int pages = (total - remainder) / max + (remainder ? 1 : 0)
            int from = total ? offset + 1 : 0
            int to = Math.min(offset + max, total)
            def msg = message(code: code, args: [total, query, from, to, page, pages])
            out << '<div class="paginate-message">' << msg << '</div>'
            out << '<div class="paginate">'
            out << g.paginate(attrs)
            out << '</div></div>'
        }
	}

    def fieldValue = { attrs, body ->
        println 'custom fieldValue tag'
        out << g.fieldValue(attrs, body)
    }

	def youtube = { attrs, body ->
		def useIframe = attrs.boolean('iframe') ?: false
		def w = attrs.get('width') ?: '560'
		def h = attrs.get('height') ?: '315'
		def title = attrs.get('title') ?: 'Youtube Video'
		if (useIframe) {
			out << '<iframe width="' << w << '" height="' << h << '" src="' << attrs.get('src') << '" title="' << title << '" frameborder="no"></iframe>'
		} else {
			def fallback = body() ?: '<p>' << message(code: 'plugin.not.loaded', default: 'Could not load plugin') << '</p>'
			out << object(attrs) {
				'<param name="allowfullscreen" value="true" />' << fallback
			}
		}
	}

	def object = { attrs, body ->
		def w = attrs.get('width') ?: '560'
		def h = attrs.get('height') ?: '315'
		def title = attrs.get('title') ?: ''
		def type = attrs.get('type') ?: 'text/html'
		out << '<object width="' << w << '" height="' << h << '" data="' << attrs.get('src') << '" title="' << title << '" type="' << type << '">'
		out << body() ?: '<p>' << message(code: 'plugin.not.loaded', default: 'Could not load plugin') << '</p>'
		out << '</object>'
	}

	def translateHtml = { attrs, body ->
		def doTranslate = grailsApplication.config.xtaglib.html.translate // to translate can be expensive performancewise
		if (!(doTranslate instanceof Boolean)) {
			doTranslate = true
		}
		def html = attrs.get('html')
		if (doTranslate) {
			if (html) {
	//			def s = '<a href="#{request.contextPath}/apps">here</a>\n<a href="#{request.servletPath}/apps">here</a>'
				def s2 = html
				Pattern pattern = Pattern.compile('\\#\\{([a-zA-Z0-9_\\.]{1,})\\}', Pattern.MULTILINE)
				Matcher matcher = pattern.matcher(s2)
				while (matcher.find()) {
					def g = matcher.group()
					def expr = '"' + g.replace('request', 'x').replace('#', '$') + '"'
					def eva = Eval.x(request, expr)
					s2 = s2.replace(g, eva)
				}
				out << s2
			}
		} else {
			out << html
		}
	}

    def captcha = { attrs, body ->
		// the v parameter in the url to the captcha image is necessary in Firefox to prevent it from caching it!!
		out << '<input type="text" class="form-control text captcha" id="captcha" name="captcha" required="required" autocomplete="off" style="background-image: url(' << createLink(controller: 'captcha', params: [v: new Date().time]).encodeAsHTML() << '); background-repeat: no-repeat; background-position: center right;" />'
	}

    def menuToggleCheckbox = { attrs, body ->
        def id = attrs.get('id') ?: 'menu-toggle'
        //out << '<form id="menuToggleForm" action="#" style="margin:0;padding:0;"><div class="menu-toggle-section"><label for="menu-toggle"><input type="checkbox" id="menu-toggle" />&equiv;</label><button type="submit" style="display: none;">&nbsp;</button></div></form>'
        out << '<input type="checkbox" id="' << id << '" style="display:none;" />'
    }

    // see http://dev.w3.org/html5/html-author/charref
    def menuToggleLabel = { attrs, body ->
        def forId = attrs.get('for') ?: 'menu-toggle'
        def code = attrs.get('code') ?: 'menu.toggle.label'
        def bdy = body() ?: message(code: code, default: '&nbsp;') // &equiv; // &lowast;
        out << '<label id="' << forId << '-label" for="' << forId << '" class="menu-toggle-label">' << bdy << '</label>'
    }

    def menuToggle = { attrs, body ->
        out << menuToggleCheckbox(attrs, body) << menuToggleLabel(attrs, body)
    }

	def searchForm = { attrs, body ->
		String action = request.contextPath + com.grailshouse.webspeed.util.WebUtil.getRequestedURL(request)
		out << form(method: 'get', action: action) {
			'<div class="decorator"><label for="query" class="label">' + message(code: "${resolveControllerName()}.search.label") + '</label><div class="input-wrapper"><input type="search" id="query" name="query" class="form-control search" /></div></div><div class="action-block clearfix"><button type="submit" class="button">' + message(code: "${resolveControllerName()}.button.search.label") + '</button></div>'
		}
	}

	def filterForm = { attrs, body ->
		Class clazz = resolveWebBean('domainInstanceClass')
		String action = request.contextPath + com.grailshouse.webspeed.util.WebUtil.getRequestedURL(request)
		def gdc = findGrailsDomainClass(clazz)
		if (gdc) {
			out << form(method: 'get', action: action) {
				formFields(domainInstance: clazz.newInstance()) {
				} +	'<button type="submit" class="button">' + message(code: "${resolveControllerName()}.button.filter.label") + '</button>'
			}
			return
		}
		List<String> fields = resolveWebBean('sortedFields')
		if (!fields) {
			fields = Arrays.asList(clazz.declaredFields).findAll { Field f ->
				def mods = f.modifiers
				!Modifier.isStatic(mods) && !Modifier.isTransient(mods) && !['id', 'version', 'errors'].contains(f.name)
			}.collect {
				it.name
			}
		}
		// TODO: Finish
        out << form(method: 'get', action: action) {}
	}

    def commandForm = { attrs, body ->
//        def text = 'Dear1 "$firstname1 $lastname",\nSo nice to meet you in <% print city %>.\nSee you in ${month},\n${signed}'
//        def binding = ["firstname":"Sam", "lastname":"Pullara", "city":"San Francisco", "month":"December", "signed":"Groovy-Dev"]
//        def template = engine.createTemplate(text).make(binding)
//        out << template.toString()

//
//
//        String action = request.contextPath + com.grailshouse.webspeed.util.WebUtil.getRequestedURL(request)
//        def command = attrs.get('command')
//        command.constraints.each { k, v ->
//            println "${k}: ${v}"
//        }
//        //println "domain: ${domainInstance}"
//        out << form(id: 'filterForm', method: 'get', action: action) {
////            formFields(domainInstance: domainInstance) {
////
////            }
//        }
    }

    Closure include = { Map attrs, body ->
//        println 123
//        out << 'PER'
        if (attrs.action && !attrs.controller) {
            def controller = request?.getAttribute(GrailsApplicationAttributes.CONTROLLER)
            def controllerName = ((GroovyObject)controller)?.getProperty(ControllerDynamicMethods.CONTROLLER_NAME_PROPERTY)
            attrs.controller = controllerName
        }

        if (attrs.controller || attrs.view) {
            def mapping = new ForwardUrlMappingInfo(controller: attrs.controller as String,
                action: attrs.action as String,
                view: attrs.view as String,
                id: attrs.id as String,
                params: attrs.params as Map)

            if (attrs.namespace != null) {
                mapping.namespace = attrs.namespace as String
            }
            if (attrs.plugin != null) {
                mapping.pluginName = attrs.plugin as String
            }
            out << UrlMappingUtils.includeForUrlMappingInfo(request, response, mapping, (Map)(attrs.model ?: [:]))?.content
//            String includeUrl = buildDispatchUrlForMapping(mapping, true);
//            out << includeForUrl(includeUrl, request, response, (Map)(attrs.model ?: [:]))?.content
        }
    }


    public static IncludedContent includeForUrl(String includeUrl, HttpServletRequest request, HttpServletResponse response, Map model) {
        RequestDispatcher dispatcher = request.getRequestDispatcher(includeUrl);
        HttpServletResponse wrapped = WrappedResponseHolder.getWrappedResponse();
println "response: ${response}"
println "wrapped: ${wrapped}"
        response = wrapped != null ? wrapped : response;

        WebUtils.exposeIncludeRequestAttributes(request);

        Map toRestore = WebUtils.exposeRequestAttributesAndReturnOldValues(request, model)

        try {
            final IncludeResponseWrapper responseWrapper = new IncludeResponseWrapper(response)
            try {
                WrappedResponseHolder.setWrappedResponse(responseWrapper);
//                WrappedResponseHolder.setWrappedResponse(response);
                dispatcher.include(request, responseWrapper);
//                dispatcher.include(request, response);
                if (responseWrapper.getRedirectURL() != null) {
                    return new IncludedContent(responseWrapper.getRedirectURL());
                }
                def ic = new IncludedContent(responseWrapper.getContentType(), responseWrapper.getContent());
//                def ic = new IncludedContent(response.getContentType(), response.getContent());
//                println response.getContent()
                return ic
            }
            finally {
                WrappedResponseHolder.setWrappedResponse(wrapped);
            }
        }
        catch (Exception e) {
            throw new ControllerExecutionException("Unable to execute include: " + e.getMessage(), e);
        }
        finally {
            WebUtils.cleanupIncludeRequestAttributes(request, toRestore);
        }
    }

    private static String buildDispatchUrlForMapping(UrlMappingInfo info, boolean includeParams) {
        if (info.getURI() != null) {
            return info.getURI();
        }

        final StringBuilder forwardUrl = new StringBuilder();

        if (info.getViewName() != null) {
            String viewName = info.getViewName();
            if (viewName.startsWith("/")) {
                forwardUrl.append(viewName);
            }
            else {
                forwardUrl.append(WebUtils.SLASH).append(viewName);
            }
        }
        else {
            forwardUrl.append(WebUtils.GRAILS_SERVLET_PATH);
            forwardUrl.append(WebUtils.SLASH).append(info.getControllerName());

            if (!GrailsStringUtils.isBlank(info.getActionName())) {
                forwardUrl.append(WebUtils.SLASH).append(info.getActionName());
            }
            forwardUrl.append(WebUtils.GRAILS_DISPATCH_EXTENSION);
        }

        final Map parameters = info.getParameters();
        if (parameters != null && !parameters.isEmpty() && includeParams) {
            try {
                forwardUrl.append(WebUtils.toQueryString(parameters));
            }
            catch (UnsupportedEncodingException e) {
                throw new ControllerExecutionException("Unable to include ");
            }
        }
//        println "forwardUrl: ${forwardUrl.toString()}"
        return forwardUrl.toString();
    }


}
