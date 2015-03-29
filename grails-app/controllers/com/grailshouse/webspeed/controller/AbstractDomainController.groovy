package com.grailshouse.webspeed.controller

import com.grailshouse.webspeed.model.Domain
import com.grailshouse.webspeed.service.DomainService
import com.grailshouse.webspeed.taglib.XTagLib
import com.grailshouse.webspeed.util.DomainUtil
import org.codehaus.groovy.grails.commons.GrailsDomainClass
import org.codehaus.groovy.grails.orm.hibernate.cfg.CompositeIdentity
import org.codehaus.groovy.grails.orm.hibernate.cfg.GrailsDomainBinder
import org.springframework.validation.FieldError

abstract class AbstractDomainController extends AbstractBaseController {

	static allowedMethods = [save: 'POST', update: ['POST', 'PUT'], delete: ['POST', 'DELETE'], deleteAll: ['POST', 'DELETE']]

	protected abstract DomainService getDomainService()
	protected abstract Class getDomainInstanceClass()

    protected GrailsDomainClass getGrailsDomainClass() {
        findGrailsDomainClass(getDomainInstanceClass())
    }

    protected GrailsDomainClass findGrailsDomainClass(Class clazz) {
        grailsApplication.domainClasses.find { it.clazz.is(clazz) }
    }

	protected Object resolveId(Domain domainInstance) {
		DomainUtil.resolveId(domainInstance)
	}

    protected Map<String, Serializable> resolveIdParameters(Domain domainInstance) {
        DomainUtil.resolveIdParameters(domainInstance, grailsApplication)
    }

	/* helper methods */
	protected void setFlashMessage(String msg) {
		def noFlash = params.boolean('noFlash')
		if (!noFlash) {
			flash.message = msg
		}
	}

	protected void notFound() {
		def args = [getLabelMessage(), params.id]
		def defaultMessage = message(code: 'default.not.found.message', args: args)
		def msg = message(code: "${getDomainInstanceName()}.not.found.message", args: args, default: defaultMessage)
		setFlashMessage(msg)
		withFormat {
			html {
				redirect(controller: controllerName, action: getDefaultAction())
			}
			xml {
				renderAsXml(ok: false, statusMessage: msg, redirect: createLink(controller: controllerName, action: getDefaultAction()))
			}
			json {
				renderAsJson(ok: false, statusMessage: msg, redirect: createLink(controller: controllerName, action: getDefaultAction()))
			}
		}
	}

	protected void resolveMaxParam() {
		params.max = Math.min(params.max ? params.int('max') : (grailsApplication.config.grails.scaffolding.list.defaultPageSize ?: 10), 100)
	}

	protected void resolveListParams() {
		resolveMaxParam()
		if (!params.sort && !!getDomainInstanceClass().metaClass.properties.find { it.name == 'lastUpdated' }) {
			params.sort = 'lastUpdated'
		}
		if (params.sort && !params.order) {
			params.order = "desc"
		}
	}

	/* Methods for rendering validation messages for different formats */

	protected void renderJsonErrorMessages(Domain domainInstance) { // does this argument have to be of type Domain? I don't think so.
		def map = [ok: false]
		map.put 'messages', XTagLib.sortedErrors(domainInstance, grailsApplication).collect({ err ->
			[name: (err instanceof FieldError) ? err.getField() : null, message: message(error: err)]
		})
		renderAsJson map
	}

	protected void renderXmlErrorMessages(Domain domainInstance) { // does this argument have to be of type Domain? I don't think so.
		def map = [ok: false]
		map.put 'messages', XTagLib.sortedErrors(domainInstance, grailsApplication).collect({ err ->
			[name: (err instanceof FieldError) ? err.getField() : null, message: message(error: err)]
		})
		renderAsXml map
	}

	/* Methods for making the CRUD class transparent - it doesn't have to be a Grails Domain Class, a command object could be used as well */

	protected String getDomainClassName() {
		return getDomainInstanceClass().getSimpleName()
	}

	protected String getDomainModelKey(String suffix = '') {
		"${getDomainInstanceName()}${grailsApplication.config.grails.scaffolding.templates.domainSuffix?:'Instance'}${suffix}".toString()
	}

	protected String getDomainInstanceName() {
		def n = getDomainClassName()
		return n.substring(0, 1).toLowerCase() + n.substring(1)
	}

	protected Domain newDomainInstance(Map params) {
		def domainInstance = getDomainInstanceClass().newInstance()
		bindParams(domainInstance, params)
		return domainInstance
	}

	// If you need to exclude/include parameters, just override bindParams in your controller and call bindData
	protected void bindParams(Domain domainInstance, Map params) {
		domainInstance.properties = params
	}

	protected String getLabelMessage() {
		message(code: "${getDomainInstanceName()}.label")
	}

	protected Map<String, String> getCancelLink() {
		def referer = getRefererUrl()
		if (referer) {
			return [href: referer, name: 'cancel']
		}
		[action: 'list', name: 'cancel']
	}

	protected List<Map<String, String>> getActionsAndLinks(Domain domainInstance = null, String action = '') {
		if (!action) {
			action = actionName
		}
		switch (action) {
			case 'create':
			case 'save':
			case 'copy':
				return getCreateActionsAndLinks(domainInstance)
			case 'edit':
			case 'update':
				return getEditActionsAndLinks(domainInstance)
			case 'show':
			default:
				return getShowActionsAndLinks(domainInstance)
		}
	}

	protected List<Map<String, String>> getShowActionsAndLinks(Domain domainInstance) {
		def prms = resolveIdParameters(domainInstance)
        [[type: 'submit', action: 'delete', name: '_action_delete'], [action: 'edit', params: prms], [action: 'copy', params: prms]]
	}

	protected List<Map<String, String>> getCreateActionsAndLinks(Domain domainInstance) {
		[[action: 'save', type: 'submit'], getCancelLink()]
	}

	protected List<Map<String, String>> getEditActionsAndLinks(Domain domainInstance) {
        [[action: 'update', type: 'submit'], [type: 'submit', action: 'delete', name: '_action_delete'], [action: 'copy', params: resolveIdParameters(domainInstance)], getCancelLink()]
	}

	/**
	 *
	 * @param action
	 * @return A list of maps. Each map contains keys: action, code (optional), controller (optional), params (optional), href (optional).
	 *
	 */
	protected List<Map<String, String>> getNavigationLinks(Domain domainInstance = null, String action = '') {
		if (!action) {
			action = actionName
		}
		switch (action) {
			case 'create':
			case 'save':
				return getCreateNavigationLinks(domainInstance)
			case 'edit':
			case 'update':
				return getEditNavigationLinks(domainInstance)
			case 'index':
			case 'list':
				return getListNavigationLinks()
			case 'show':
			default:
				return getShowNavigationLinks(domainInstance)
		}
	}

	protected Map<String, String> getHomeLink() {
		[url: "${request.contextPath}", code: 'home']
	}

	protected List<Map<String, String>> getListNavigationLinks() {
		[] << getHomeLink() << [action: 'create']
	}

	protected List<Map<String, String>> getCreateNavigationLinks(Domain domainInstance) {
		[] << getHomeLink() << [action: 'index']
	}

	protected List<Map<String, String>> getShowNavigationLinks(Domain domainInstance) {
		[] << getHomeLink() << [action: 'index'] << [action: 'create']
	}

	protected List<Map<String, String>> getEditNavigationLinks(Domain domainInstance) {
		[] << getHomeLink() << [action: 'index'] << [action: 'create']
	}

	protected Map getModelWithDomainInstance(Domain domainInstance, Map model = [:], String action = '') {
		model.put getDomainModelKey(), domainInstance
		model.put 'navigationLinks', getNavigationLinks(domainInstance)
		model.put 'actionsAndLinks', getActionsAndLinks(domainInstance)
		model.put 'sortedFields', getSortedFieldNames(action)
        model
	}

	protected Map getModelWithDomainInstanceList(List<Domain> domainInstanceList, int total, Map model = [:], String action = '') {
		model.put getDomainModelKey('List'), domainInstanceList
        model.put getDomainModelKey('Count'), total
        model.put 'sortedFields', getSortedFieldNames(action)
        model.put 'domainInstanceClass', getDomainInstanceClass()
		model.put 'navigationLinks', getNavigationLinks()
        model.put 'linkMapping', getLinkMapping()
		//model.put 'associationLinkMapping', getAssociationLinkMapping()
        model
	}

	/* Methods to control the controller/view flow. Override for customized behavior */

	protected Map getViewNames() {
		// the delete action redirects to an action and is therefore not listed here
		[show: 'show', create: 'create', edit: 'edit', list: 'list', index: 'list', copy: 'create', save: 'create', update: 'edit']
	}

	protected String resolveView() {
		def key = actionName
		if (params.boolean('embedded')) {
			switch (actionName) {
				case 'create':
				case 'edit':
                    def n = params.boolean('fieldsOnly') ? 'fields' : 'form'
					key = "_${actionName}-${n}"
					break
				case 'list':
					key = '_data-table'
					break
				default:
					break
			}
		}
		def viewNames = getViewNames()
		viewNames?.containsKey(key) ? viewNames.get(key) : key
	}

	/**
	 * @return A list of field names to display for the specified view/action. If null is returned all fields will be displayed (except byte array fields)
	 */
	protected List<String> getSortedFieldNames(String action = '') {
		if (!action) {
			action = actionName
		}
		switch (action) {
			case 'list':
				return getListFieldNames()
			case 'index':
                return getIndexFieldNames()
			case 'show':
				return getShowFieldNames()
			case 'edit':
            case 'update':
				return getEditFieldNames()
			case 'create':
            case 'copy':
            case 'save':
                return getCreateFieldNames()
		}
		return getDefaultSortedFieldNames()
	}

    protected List<String> getDefaultSortedFieldNames() {
        null
    }

    protected List<String> getIndexFieldNames() {
        getListFieldNames()
    }

	protected List<String> getListFieldNames() {
        getDefaultSortedFieldNames()
	}

	protected List<String> getShowFieldNames() {
        getDefaultSortedFieldNames()
	}

    protected List<String> getEditFieldNames() {
        getDefaultSortedFieldNames()
    }

    protected List<String> getCreateFieldNames() {
        getDefaultSortedFieldNames()
    }

	/* Methods controlling where to go to after executing certain actions */

	/**
	 * Instead of overriding the index method - which provide RESTful functionality - override this method to control what the index method should do for GET requests with no id in params
	 */
	protected void indexAction() {
		// Note that the redirect method uses the grails.serverURL variable in Config.groovy if present
		//redirect(action: "list", params: params)
		list()
	}

	/**
	 * @return The name of the action to use when no entity found with specified id in URL params
	 */
	protected String getDefaultAction() {
		'list'
	}

	/**
	 * @return Used to construct the link to each record (domain instance) from list views. Note the closure for the params key. It will be called with the domain instance as the one and only argument.
	 */
	protected Map<String, Serializable> getLinkMapping() {
        [action: 'show', params: { domainInstance -> resolveIdParameters(domainInstance) }]
	}

	/**
	 * Used to construct the link to an association for each record (domain instance) from list views.
	 * Return null to link to the default show view for an association
	 * @return
	 */
//	protected Map<Class, Map<String, Serializable>> getAssociationLinkMapping() {
//		null
//	}

	protected Map<String, Serializable> redirectToOnSaveSuccess(Domain domainInstance) {
		def prevReferer = params['prevReferer']
		if (prevReferer) {
			return [url: prevReferer]
		}
        [action: 'show', params: resolveIdParameters(domainInstance)]
	}

	protected Map<String, Serializable> renderOnSaveFailure(Domain domainInstance) {
		[view: resolveView(), model: getModelWithDomainInstance(domainInstance)]
	}

	protected Map<String, Serializable> redirectToOnUpdateSuccess(Domain domainInstance) {
		boolean stayOnPage = params.boolean('stayOnPage')
		if (!stayOnPage) {
			def prevReferer = params['prevReferer']
			if (prevReferer) {
				return [url: prevReferer]
			}
		}
        [action: stayOnPage ? 'edit' : 'show', params: resolveIdParameters(domainInstance)]
	}

	protected Map<String, Serializable> renderOnUpdateFailure(Domain domainInstance) {
		[view: resolveView(), model: getModelWithDomainInstance(domainInstance)]
	}

	protected Map<String, Serializable> redirectToOnDeleteSuccess(Domain domainInstance) {
		def prevReferer = params['prevReferer']
		if (prevReferer) {
			return [url: prevReferer]
		}
		[action: getDefaultAction()]
	}

	/**
	 * If it is possible to delete from other page/view than show, then specify the page/view in params.from or override this method.
	 * @return Map with action and id keys
	 */
	protected Map<String, Serializable> redirectToOnDeleteFailure(Domain domainInstance) {
		def prevReferer = params['prevReferer']
		if (prevReferer) {
			return [url: prevReferer]
		}
        [action: params.from ?: 'show', params: resolveIdParameters(domainInstance)]
	}

	/**
	 * Called after successful save for requests where the request format is either XML or JSON
	 * @param model
	 * @param domainInstance
	 * @return
	 */
	protected Map<String, Serializable> ajaxSaveSuccessModel(Map<String, Serializable> model, Domain domainInstance) {
		model
	}

	/**
	 * Called after successful update for requests where the request format is either XML or JSON
	 * @param model
	 * @param domainInstance
	 * @return
	 */
	protected Map<String, Serializable> ajaxUpdateSuccessModel(Map<String, Serializable> model, Domain domainInstance) {
		model
	}

	protected int getListDomainInstancesCount() {
		getDomainService().count()
	}

	protected List<? extends Domain> getListDomainInstances() {
		getDomainService().list(params)
	}

    protected Domain loadDomainInstance() {
        def identity = new GrailsDomainBinder().getMapping(getDomainInstanceClass())?.identity
        if (identity instanceof CompositeIdentity) {
            return getDomainInstanceClass().load(newDomainInstance(params))
        }
        getDomainService().load(params.id)
    }

	protected Domain getDomainInstance() {
        def identity = new GrailsDomainBinder().getMapping(getDomainInstanceClass())?.identity
        if (identity instanceof CompositeIdentity) {
            // if any of the fields, which define the composite id, are altered, we obviously won't find it in DB - to customize you should override getUpdateDomainInstance in your controller
//            Domain newInstance = null
//            identity.propertyNames.each { p ->
//                if (params[p] instanceof String[]) {
//
//                }
//            }
            return getDomainInstanceClass().get(newDomainInstance(params))
        }
        getDomainService().get(params.id)
	}

    protected Domain getShowDomainInstance() {
        getDomainInstance()
    }

	protected Domain getEditDomainInstance() {
        getDomainInstance()
	}

	protected Domain getUpdateDomainInstance() {
        getDomainInstance()
	}

	protected Domain getDeleteDomainInstance() {
		loadDomainInstance()
	}

    protected String resolveSaveSuccessMessage(Domain domainInstance) {
        def args = [getLabelMessage(), domainInstance.toString()]
        def defaultMessage = message(code: 'default.created.message', args: args)
        message(code: "${getDomainInstanceName()}.created.message", args: args, default: defaultMessage)
    }

    protected String resolveUpdateSuccessMessage(Domain domainInstance) {
        def args = [getLabelMessage(), domainInstance.toString()]
        def defaultMessage = message(code: 'default.updated.message', args: args)
        message(code: "${getDomainInstanceName()}.updated.message", args: args, default: defaultMessage)
    }

    protected String resolveDeleteSuccessMessage(Domain domainInstance) {
        def args = [getLabelMessage(), domainInstance.toString()]
        def defaultMessage = message(code: 'default.deleted.message', args: args)
        message(code: "${getDomainInstanceName()}.deleted.message", args: args, default: defaultMessage)
    }

    /* CRUD actions */

	/**
	 * Together with a restful UrlMappings this index method provide REST functionality. The methods create and edit cannot be hit in a restful way though
	 */
	def index() {
		switch (request.method) {
			case 'DELETE':
				delete()
				break
			case 'POST':
				save()
				break
			case 'PUT':
				update()
				break
			case 'GET':
			default:
				if (params.id) {
					show()
				} else {
					params.remove('actionOrId')
					indexAction()
				}
				break
		}
	}

	def list() {
		resolveListParams()
		def records = getListDomainInstances()
		// no need to call service count method if instance of PagedResultList
		def total = (records instanceof grails.orm.PagedResultList) ? records.totalCount : getListDomainInstancesCount()
        def model = [:]
		withFormat {
			html {
                render(view: resolveView(), model: getModelWithDomainInstanceList(records, total, model))
			}
			xml {
				model.put 'records', records
				model.put 'total', total
				renderAsXml model
			}
			json {
				model.put 'records', records
				model.put 'total', total
				renderAsJson model
			}
		}
		model
	}

	def create() {
		def model = getModelWithDomainInstance(newDomainInstance(params))
		render(view: resolveView(), model: model)
		return model
	}

    // TODO: Make use of withForm...invalidToken. See http://grails.org/doc/latest/guide/single.html#formtokens
	def save() {
		def domainInstance = newDomainInstance(params)
		def saved = getDomainService().save(domainInstance)
		if (saved) {
			domainInstance = saved
			def msg = resolveSaveSuccessMessage(domainInstance)
			setFlashMessage(msg)
			withFormat { // TODO: Should this be request.withFormat?
				html {
					redirect(redirectToOnSaveSuccess(domainInstance))
				}
				xml {
					def map = ajaxSaveSuccessModel([ok: true, statusMessage: msg, redirect: createLink(redirectToOnSaveSuccess(domainInstance)), id: resolveId(domainInstance), version: domainInstance.version], domainInstance)
					renderAsXml map
				}
				json {
					def map = ajaxSaveSuccessModel([ok: true, statusMessage: msg, redirect: createLink(redirectToOnSaveSuccess(domainInstance)), id: resolveId(domainInstance), version: domainInstance.version], domainInstance)
					renderAsJson map
				}
			}
		} else {
			/*
				If grails.mime.use.accept.header = true in Config.groovy the closures multipartForm and form are never hit in the withFormat closure
				If grails.mime.use.accept.header = false in Config.groovy the closures multipartForm and form are only hit if they come before html closure.
				Note that the multipartForm closure will be hit even for non-multipart forms! And the form closure will be hit for multipart forms if before multipartForm closure!
			*/
			withFormat { // TODO: Should this be request.withFormat?
//				form {
//					 'form'
//					render(renderOnSaveFailure(domainInstance))
//				}
//				multipartForm {
//					println 'multipart form1'
//					render(renderOnSaveFailure(domainInstance))
//				}
				html {
					render(renderOnSaveFailure(domainInstance))
				}
				xml {
					renderXmlErrorMessages(domainInstance)
				}
				json {
					renderJsonErrorMessages(domainInstance)
				}
			}
		}
        domainInstance
	}

	def show() {
        def domainInstance = getShowDomainInstance()
		if (domainInstance) {
			withFormat {
				html {
					def model = getModelWithDomainInstance(domainInstance)
					render(view: resolveView(), model: model)
					return model
				}
				xml {
					renderAsXml domainInstance
				}
				json {
					renderAsJson domainInstance
				}
			}
		} else {
			notFound()
		}
	}

	def edit() {
		def domainInstance = getEditDomainInstance()
		if (domainInstance) {
			def model = getModelWithDomainInstance(domainInstance)
			render(view: resolveView(), model: model)
			return model
		}
		notFound()
	}

	def update() {
		def domainInstance = getUpdateDomainInstance()
		if (domainInstance) {
			if (params.version) {
				def version = params.long('version')
				if (domainInstance.version > version) {
					withFormat { // TODO: Should this be request.withFormat?
						html {
							domainInstance.errors.rejectValue('version', 'default.optimistic.locking.failure', [getLabelMessage()] as Object[], domainInstance.toString())
							render(renderOnUpdateFailure(domainInstance))
						}
						xml {
							renderAsXml(statusMessage: message(code: 'default.optimistic.locking.failure', args: [getLabelMessage()]), ok: false)
						}
						json {
							renderAsJson(statusMessage: message(code: 'default.optimistic.locking.failure', args: [getLabelMessage()]), ok: false)
						}
					}
					return null
				}
			}
			bindParams(domainInstance, params)
			if (getDomainService().update(domainInstance)) {
				def msg = resolveUpdateSuccessMessage(domainInstance)
				def stayOnPage = params.boolean('stayOnPage')
				if (!stayOnPage) {
					setFlashMessage(msg)
				}
				withFormat { // TODO: Should this be request.withFormat?
					html {
						redirect(redirectToOnUpdateSuccess(domainInstance))
					}
					xml {
						def map = ajaxUpdateSuccessModel([statusMessage: msg, ok: true], domainInstance)
						if (stayOnPage) {
                            if (domainInstance.version != null) {
                                map.put 'version', domainInstance.version
                            }
						} else {
							map.put 'redirect', createLink(redirectToOnUpdateSuccess(domainInstance))
						}
						renderAsXml map
					}
					json {
						def map = ajaxUpdateSuccessModel([statusMessage: msg, ok: true], domainInstance)
						if (stayOnPage) {
							map.put 'version', domainInstance.version
						} else {
							map.put 'redirect', createLink(redirectToOnUpdateSuccess(domainInstance))
						}
						renderAsJson map
					}
				}
			} else {
                withFormat { // TODO: Should this be request.withFormat?
                    html {
                        render(renderOnUpdateFailure(domainInstance))
                    }
                    xml {
                        renderXmlErrorMessages domainInstance
                    }
                    json {
                        renderJsonErrorMessages domainInstance
                    }
                }
            }
		} else {
			notFound()
		}
        domainInstance
	}

    // TODO: should check possible version field before deleting?
	def delete() {
		def domainInstance = getDeleteDomainInstance()
		if (domainInstance) {
			def s = domainInstance.toString() // the toString implementation can cause Hibernate to call the DB which must be done before deletion
			try {
				getDomainService().delete(domainInstance)
				def msg = resolveDeleteSuccessMessage(domainInstance)
				setFlashMessage(msg)
				withFormat { // TODO: Should this be request.withFormat?
					html {
						redirect(redirectToOnDeleteSuccess(domainInstance))
					}
					xml {
						renderAsXml(ok: true, redirect: createLink(redirectToOnDeleteSuccess(domainInstance)), statusMessage: msg)
					}
					json {
						renderAsJson(ok: true, redirect: createLink(redirectToOnDeleteSuccess(domainInstance)), statusMessage: msg)
					}
				}
                return true
			}
			catch (RuntimeException ex) {
                log.error ex
				def args = [getLabelMessage(), s]
				def defaultMessage = message(code: 'default.not.deleted.message', args: args)
				def msg = message(code: "${getDomainInstanceName()}.not.deleted.message", args: args, default: defaultMessage)
				setFlashMessage(msg)
				withFormat { // TODO: Should this be request.withFormat?
					html {
						redirect(redirectToOnDeleteFailure(domainInstance))
					}
					xml {
						renderAsXml(ok: false, statusMessage: msg)
					}
					json {
						renderAsJson(ok: false, statusMessage: msg)
					}
				}
			}
		} else {
			notFound()
		}
        false
	}

	def deleteAll() {
		def ids = []
		if (params.id instanceof String) {
			ids.add(params.id)
		}
		else if (params.id instanceof String[]) {
			ids.addAll(params.id)
		}
		def ok = !ids.isEmpty()
		if (ok) {
			try {
				getDomainService().deleteAll(ids.asType(String[]))
			}
			catch (RuntimeException ex) {
				log.error(ex)
				ok = false
			}
		}
		def args = [getLabelMessage()]
		def defaultCode = ok ? 'default.deletedAll.message' : 'default.not.deletedAll.message'
		def defaultMessage = message(code: defaultCode, args: args)
		def code = ok ? "${getDomainInstanceName()}.deletedAll.message" : "${getDomainInstanceName()}.not.deletedAll.message"
		def msg = message(code: code, args: args, default: defaultMessage)
		setFlashMessage(msg)
		withFormat { // TODO: Should this be request.withFormat?
			html {
				redirect(action: params.redirectAction ?: actionName)
			}
			xml {
				renderAsXml(ok: ok, statusMessage: msg)
			}
			json {
				renderAsJson(ok: ok, statusMessage: msg)
			}
		}
        ok
	}

	def copy() {
		def domainInstance = getDomainInstance()
		if (domainInstance) {
			def model = getModelWithDomainInstance(getDomainService().copy(domainInstance))
			render(view: resolveView(), model: model)
			return model
		}
		notFound()
	}

}