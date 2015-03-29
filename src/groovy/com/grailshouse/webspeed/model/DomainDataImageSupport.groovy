package com.grailshouse.webspeed.model

class DomainDataImageSupport {

    static Closure getMapping() {
		DomainDataSupport.getMapping()
	}

    static Closure getConstraints(boolean uniqueFilename) {
		DomainDataSupport.getConstraints(uniqueFilename) << {
    		width(nullable: true, editable: false)
        	height(nullable: true, editable: false)
		}
	}

}
