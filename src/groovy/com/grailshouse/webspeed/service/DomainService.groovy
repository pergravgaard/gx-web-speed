package com.grailshouse.webspeed.service

import com.grailshouse.webspeed.model.Domain

interface DomainService {

	int count()
	List<? extends Domain> list(Map map)
	Domain get(Object domainInstanceOrId, boolean refresh)
	Domain get(Object domainInstanceOrId)
	Domain refresh(Domain domainInstance)
	Domain load(Object domainInstanceOrId)
	Domain save(Domain domainInstance)
	boolean update(Domain domainInstance)
	void delete(Object domainInstanceOrId)
	void deleteAll(Collection<? extends Domain> domainInstances)
	void deleteAll(String[] ids)
	
}
