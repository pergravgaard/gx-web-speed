package com.grailshouse.webspeed.model

class DomainDataSupport {

	static Closure getMapping() {
		return {
			size column: "byte_size" // the word size is a reserved word in Oracle 11g
		}
	}

    static Closure getConstraints(boolean uniqueFilename) {
		return {
			description(nullable: true)
			filename(nullable: true, unique: uniqueFilename, editable: false)
			mimetype(nullable: true, editable: false)
			size(nullable: true, editable: false)
			dateCreated()
			lastUpdated()
		}
	}

}
