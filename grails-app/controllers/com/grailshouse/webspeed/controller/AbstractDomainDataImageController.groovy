package com.grailshouse.webspeed.controller

import com.grailshouse.webspeed.model.Domain
import com.grailshouse.webspeed.util.ImageUtil

import java.awt.image.BufferedImage
import javax.imageio.ImageIO
import com.grailshouse.webspeed.model.DomainDataImage
import javax.servlet.http.HttpServletResponse

abstract class AbstractDomainDataImageController extends AbstractDomainDataController {

	protected BufferedImage zoomData(DomainDataImage domainDataImage, Integer width, Integer height) {
		def bImage = ImageUtil.getBufferedImage(domainDataImage.data)
		return ImageUtil.createZoomImage(bImage, width, height)
	}

	protected void doZoom(DomainDataImage domainDataImage) {
		if (domainDataImage) {
//			response.setDateHeader 'Last-Modified', domainDataImage.lastUpdated.time
//			response.contentType = domainDataImage.mimetype
//			if (request.getDateHeader('If-Modified-Since') >= domainDataImage.lastUpdated.time) {
//				response.setStatus HttpServletResponse.SC_NOT_MODIFIED
//				return
//			}
			def w = params.int('zw')
			def h = params.int('zh')
			def thumbnail = zoomData(domainDataImage, w, h)
			if (thumbnail) {
				ImageIO.write(thumbnail, domainDataImage.fileExtension, response.outputStream)
			} else {
				viewData(domainDataImage)
			}
		} else {
			notFound()
		}
	}

	@Override
	protected List<String> getListFieldNames() {
        def listFieldNames = super.getListFieldNames()
        if (listFieldNames) {
            listFieldNames.add 1, 'height'
            listFieldNames.add 1, 'width'
            return listFieldNames
        }
        null
	}

    @Override
    protected List<Map<String, String>> getShowActionsAndLinks(Domain domainInstance) {
        def parms = resolveIdParameters(domainInstance)
        [[type: 'submit', action: 'delete', name: '_action_delete'], [action: 'edit', params: parms], [action: 'copy', params: parms], [action: 'download', params: parms], [action: 'view', params: parms]]
    }

	def zoom() {
		def domainDataImage = getDomainService().get(params.id)
		doZoom(domainDataImage)
	}

	def zoomByFilename() {
		def domainDataImage = getDomainService().findBy('filename', params.filename)
		doZoom(domainDataImage)
	}

}
