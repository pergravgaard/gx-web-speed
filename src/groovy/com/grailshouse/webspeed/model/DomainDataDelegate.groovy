package com.grailshouse.webspeed.model

import org.apache.commons.fileupload.FileItem
import org.springframework.web.multipart.MultipartFile

/**
 * PURPOSE: Instead of using inheritance in domain classes - which isn't good for SQL performance - we use @Delegate and regular interfaces.
 * Instead of duplicating constraints and mapping - now that we don't have inheritance - we can use closures returned by (static) methods in utility/support classes.
 * Closures can even be merged (constraint sort order?) by using the leftShift operator.
 * Create a field in the class you wan't to 'inherit' the methods from in this class and assign the field an instance of this class.
 * Then annotate the field with the Delegate annotation. Remember to add the field to the static transients list to make Hibernate behave.
 */
class DomainDataDelegate {

	private DomainData domainData

	DomainDataDelegate(DomainData domainData) {
		this.domainData = domainData
	}

	private void bindBytes(byte[] bytes, boolean doBindData) {
		domainData.size = bytes.size()
		if (doBindData) {
			domainData.data = bytes
		}
	}

	// typically called from bootstrapping code - we must bind the actual binary data programmatically
	DomainData bind(File file, String mimetype = null) {
		domainData.filename = file.name
		bindBytes(file.bytes, true)
		domainData.mimetype = mimetype
		domainData
	}

	// called from controller - use ORM to bind the actual binary data (set the value of the name attribute to 'data') or do it programmatically. We don't bind the actual binary data here.
	DomainData bind(MultipartFile mf) {
		domainData.filename = mf.originalFilename
		bindBytes(mf.bytes, false)
		domainData.mimetype = mf.contentType
		domainData
	}

	// called from controller - use ORM to bind the actual binary data (set the value of the name attribute to 'data') or do it programmatically. We don't bind the actual binary data here.
	DomainData bind(FileItem fileItem) {
		domainData.filename = fileItem.name
		bindBytes(fileItem.get(), false)
		domainData.mimetype = fileItem.contentType
		domainData
	}

}
