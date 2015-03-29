package com.grailshouse.webspeed.model

import com.grailshouse.webspeed.util.ImageUtil
import org.apache.commons.fileupload.FileItem
import org.springframework.web.multipart.MultipartFile

import javax.imageio.ImageIO

/**
 * PURPOSE: Instead of using inheritance in domain classes - which isn't good for SQL performance - we use @Delegate and regular interfaces.
 * Instead of duplicating constraints and mapping - now that we don't have inheritance - we can use closures returned by (static) methods in utility/support classes.
 * Closures can even be merged (constraint sort order?) by using the leftShift operator.
 * Create a field in the class where you wan't to 'inherit' the methods from this class and assign the field an instance of this class.
 * Then annotate the field with the Delegate annotation. Remember to add the field to the static transients list to make Hibernate behave.
 */
class DomainDataImageDelegate {

	private DomainDataImage domainDataImage
	private int maxWidth
	private int maxHeight

	DomainDataImageDelegate(DomainDataImage domainDataImage) {
		this(domainDataImage, 0, 0)
	}

	DomainDataImageDelegate(DomainDataImage domainDataImage, int maxWidth, int maxHeight) {
		super()
		this.domainDataImage = domainDataImage
		this.maxWidth = maxWidth
		this.maxHeight = maxHeight
	}

	// is used in AbstractDomainDataImageController
	String getFileExtension() {
		if (domainDataImage.filename) {
			int i = domainDataImage.filename.lastIndexOf('.')
			if (i > -1) {
				return domainDataImage.filename.substring(i + 1).toLowerCase()
			}
		}
		return ''
	}

	private void bindBytes(byte[] bytes, boolean doBindData) {
		def bImage = ImageUtil.getBufferedImage(bytes) // returns null for empty files
		if (bImage == null) {
			return
		}
		if ((maxWidth > 0 && bImage.width > maxWidth) || (maxHeight > 0 && bImage.height > maxHeight)) {
			bImage = ImageUtil.createZoomImage(bImage, maxWidth, maxHeight)
			def scaledFile = File.createTempFile('tmp-', domainDataImage.fileExtension)
			def fos = new FileOutputStream(scaledFile)
			ImageIO.write(bImage, domainDataImage.fileExtension, fos)
			fos.close()
			domainDataImage.size = scaledFile.bytes.size()
			domainDataImage.data = scaledFile.bytes // always bind scaled bytes since Spring has binded the original bytes
		} else {
			domainDataImage.size = bytes.size()
			if (doBindData) {
				domainDataImage.data = bytes
			}
		}
		domainDataImage.width = bImage.width
		domainDataImage.height = bImage.height
	}

	// typically called from bootstrapping code - we must bind the actual binary data programmatically
	DomainDataImage bind(File file) {
		domainDataImage.filename = file.name
		bindBytes(file.bytes, true)
		domainDataImage.mimetype = domainDataImage.fileExtension ? "image/${domainDataImage.fileExtension}" : null
		domainDataImage
	}

	// called from controller - use ORM to bind the actual binary data (set the value of the name attribute to 'data') or do it programmatically. We don't bind the actual binary data here.
	DomainDataImage bind(MultipartFile mf) {
		domainDataImage.filename = mf.originalFilename
		bindBytes(mf.bytes, false)
		domainDataImage.mimetype = mf.bytes.length ? mf.contentType : null
		domainDataImage
	}

	// called from controller - use ORM to bind the actual binary data (set the value of the name attribute to 'data') or do it programmatically. We don't bind the actual binary data here.
	DomainDataImage bind(FileItem fileItem) {
		domainDataImage.filename = fileItem.name
		bindBytes(fileItem.get(), false)
		domainDataImage.mimetype = fileItem.contentType
		domainDataImage
	}

    DomainDataImage bind(byte[] bytes, String filename = 'noname.png') {
        domainDataImage.filename = filename
        bindBytes(bytes, true)
        domainDataImage.mimetype = "image/${domainDataImage.fileExtension}"
        domainDataImage
    }

}
