<%="package ${packageName - 'model' + 'controller'}"%>

import ${packageName}.${className}

import com.grailshouse.webspeed.service.DomainService

class ${className}Controller extends AbstractDomainController {

	def ${propertyName-'Instance'}Service
	
	@Override
	protected DomainService getDomainService() {
		${propertyName-'Instance'}Service
	}

	@Override
	protected Class getDomainInstanceClass() {
		${className}
	}

}