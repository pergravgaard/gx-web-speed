package com.grailshouse.webspeed.service

import com.grailshouse.webspeed.model.Domain
import com.grailshouse.webspeed.util.DomainUtil
import grails.gorm.DetachedCriteria
import org.springframework.transaction.annotation.Transactional

/**
 * @author pgr
 *
 */
abstract class AbstractDomainService implements DomainService {

    // TODO: Use Grails Transactional annotation instead?
	static transactional = false

	protected abstract Class getDomainInstanceClass()

	protected Map getSaveOptions() {
		[flush: true]
	}

	protected Map getUpdateOptions() {
		getSaveOptions()
	}

	protected Map getDeleteOptions() {
		getSaveOptions()
	}

    protected Object resolveId(Object domainInstanceOrId) {
        (domainInstanceOrId instanceof Domain) ? DomainUtil.resolveId(domainInstanceOrId) : domainInstanceOrId
    }

	@Transactional(readOnly = true) // sets FlushMode.NEVER and calls setReadOnly(true) on the JDBC connection
	int count() {
		getDomainInstanceClass().count()
	}

	@Transactional(readOnly = true)
	List<? extends Domain> list(Map map) {
		getDomainInstanceClass().list(map)
	}

	// Actually returns a PagedResultList, which cannot be parameterized in the signature!?
    @Transactional(readOnly = true)
    List<? extends Domain> listWithCriteria(Closure query, Boolean useDetachedCriteria = false) {
        def crit = useDetachedCriteria ? new DetachedCriteria(getDomainInstanceClass()) : getDomainInstanceClass().createCriteria()
        useDetachedCriteria ? crit.where(query).list() : crit.list(query)
    }

	@Transactional(readOnly = true)
	List<? extends Domain> listWithCriteria(Map<String, Object> queryParams, Closure query, Boolean useDetachedCriteria = false) {
		def crit = useDetachedCriteria ? new DetachedCriteria(getDomainInstanceClass()) : getDomainInstanceClass().createCriteria()
		useDetachedCriteria ? crit.where(query).list(queryParams) : crit.list(queryParams, query)
	}

    @Transactional(readOnly = true)
    List<? extends Domain> listWithDetachedCriteria(Closure query) {
        new DetachedCriteria(getDomainInstanceClass()).where(query).list()
    }

	@Transactional(readOnly = true)
	List<? extends Domain> findAllWhere(Map<String, Object> queryParams) {
		getDomainInstanceClass().findAllWhere(queryParams)
	}

	@Transactional(readOnly = true)
	Domain findWhere(Map<String, Object> queryParams) {
		getDomainInstanceClass().findWhere(queryParams)
	}

	@Transactional(readOnly = true)
	List<? extends Domain> findAllBy(String fieldCombination, Object value) {
		getDomainInstanceClass()."findAllBy${fieldCombination.capitalize()}"(value)
	}

	@Transactional(readOnly = true)
	Domain findBy(String fieldCombination, Object value) {
		getDomainInstanceClass()."findBy${fieldCombination.capitalize()}"(value)
	}

	@Transactional(readOnly = true)
	List<? extends Domain> findAll(String hql, Map params = null, Map conditions = null) {
		getDomainInstanceClass().findAll(hql, params, conditions)
	}

	@Transactional(readOnly = true)
	Domain find(String hql, Map params = null, Map conditions = null) {
		getDomainInstanceClass().find(hql, params, conditions)
	}

	/**
	 * @param domainInstanceOrId
	 * @param refresh. If true, the entity is looked up in DB (refreshed from DB). Defaults to false.
	 * @return
	 */
    @Transactional(readOnly = true)
	Domain get(Object domainInstanceOrId, boolean refresh = false) {
        def id = resolveId(domainInstanceOrId)
        def domainInstance = getDomainInstanceClass().get(id) // Hibernate can handle String, Long or whatever type the id may have
		if (domainInstance && refresh) {
			domainInstance.refresh() // this is important - otherwise tree entities will be resaved by cascade
		}
		domainInstance
	}

    @Transactional(readOnly = true)
    Domain copy(Domain domainInstance) {
        Domain copy = getDomainInstanceClass().newInstance()
        def props = [:] << domainInstance.properties
        ['id', 'version', 'dateCreated', 'lastUpdated'].each {
            props.remove it
        }
        copy.properties = props
        copy
    }

    @Transactional(readOnly = true)
	Domain refresh(Domain domainInstance) {
		domainInstance.refresh()
		domainInstance
	}

    // Should not be transactional
	Domain load(Object domainInstanceOrId) {
        if (domainInstanceOrId instanceof Domain) {
            return domainInstanceOrId
        }
		getDomainInstanceClass().load(domainInstanceOrId)
	}

	@Transactional
	Domain save(Domain domainInstance) {
		domainInstance.save(getSaveOptions())
	}

	@Transactional
	boolean update(Domain domainInstance) {
		domainInstance.save(getUpdateOptions()) != null
	}

	/* May throw runtime exception - a Hibernate or Spring related unchecked exception in which case the transaction will be rolled back.
	 * Note that Spring will only rollback on unchecked exceptions (except for remote exceptions)!
	 */
	@Transactional
	void delete(Object domainInstanceOrId) {
		if (domainInstanceOrId instanceof Domain) {
			// TODO: Implementation of Domain does not guarantee that we're dealing with a GrailsDomainClass - create protected isGrailsDomainClass method
			domainInstanceOrId.discard() // if the instance is out of sync with the database, it is possible that the instance could be resaved by cascading save. Discarding any changes avoids this resave.
            domainInstanceOrId.refresh() // due to possible parent-child relationship this is also necessary to avoid resaving by cascading save
		}
		load(domainInstanceOrId)?.delete(getDeleteOptions())
	}

	/* Deletes all or none - if deletion of one fails, none are deleted */
	@Transactional
	void deleteAll(Collection<? extends Domain> domainInstances) {
        domainInstances.each { this.delete(it) }
//        getDomainInstanceClass().withNewSession { session ->
//			domainInstances.each { domainInstance ->
//				def proxy = load(domainInstance) // TODO: Won't work
//				if (proxy) {
//					proxy.delete(flush: false)
//				}
//			}
//			// Hibernate session is automatically flushed and cleared by withNewSession
//		}
	}

	/* Deletes all or none - if deletion of one fails, none are deleted */
	@Transactional
	void deleteAll(String[] ids) {
		getDomainInstanceClass().withNewSession { session ->
			ids.each { id ->
				def domainInstance = getDomainInstanceClass().load(id)
				if (domainInstance) {
					domainInstance.delete(flush: false)
				}
			}
			// Hibernate session is automatically flushed and cleared by withNewSession
		}
	}

}
