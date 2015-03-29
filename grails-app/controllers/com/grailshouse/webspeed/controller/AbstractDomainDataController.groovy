package com.grailshouse.webspeed.controller

import com.grailshouse.webspeed.model.Domain
import com.grailshouse.webspeed.model.DomainData
import grails.converters.JSON
import grails.converters.XML
import org.apache.commons.fileupload.FileItem
import org.springframework.web.multipart.MultipartFile

import javax.servlet.http.HttpServletResponse

// TODO: Finish/test customizeDataError
abstract class AbstractDomainDataController extends AbstractDomainController {

	@Override
	protected void bindParams(Domain domainInstance, Map params) {
		assert domainInstance instanceof DomainData
		super.bindParams(domainInstance, params) // Must call super before domainInstance.bind. Otherwise fields be overwritten with "empty" values
		def entry = params.find { k, v ->
			return (v instanceof MultipartFile) || (v instanceof File) || (v instanceof FileItem)
		}
		if (entry) {
			domainInstance.bind(entry.value)
		}
	}

    @Override
    protected List<Map<String, String>> getShowActionsAndLinks(Domain domainInstance) {
        def parms = resolveIdParameters(domainInstance)
        [[type: 'submit', action: 'delete', name: '_action_delete'], [action: 'edit', params: parms], [action: 'copy', params: parms], [action: 'download', params: parms]]
    }

	protected void viewData(DomainData domainData) {
        String mType = domainData.mimetype ?: 'application/octet-stream'
        response.contentType = mType
        response.setHeader 'Content-Type', mType
		response.setDateHeader 'Last-Modified', domainData.lastUpdated.time
		if (request.getDateHeader('If-Modified-Since') >= domainData.lastUpdated.time) {
			response.setStatus HttpServletResponse.SC_NOT_MODIFIED
			return
		}
        try {
            response.outputStream << domainData.data
        }
        catch (IOException ex) {
            log.error ex
            response.outputStream.close()
        }
	}


    // Safari on iPad iOS7 - broken pipe
//    host: 192.168.43.106:8080
//    accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
//    connection: keep-alive
//    cookie: JSESSIONID=2D5ECD15906B7EF6424C597D42C14F7D
//    user-agent: Mozilla/5.0 (iPad; CPU OS 7_0_4 like Mac OS X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11B554a Safari/9537.53
//    accept-language: en-us
//    referer: http://192.168.43.106:8080/bjs/attachment/show/1
//    accept-encoding: gzip, deflate

    // Chrome on Nexus 7 KitKat - connection reset
//    host: 192.168.43.106:8080
//    connection: keep-alive
//    accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8
//    user-agent: Mozilla/5.0 (Linux; Android 4.4.2; Nexus 7 Build/KOT49H) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1700.99 Safari/537.36
//    referer: http://192.168.43.106:8080/bjs/attachment/show/1
//    accept-encoding: gzip,deflate,sdch
//    accept-language: en-GB,en-US;q=0.8,en;q=0.6,da;q=0.4
//    cookie: JSESSIONID=E804B98587F87FEA4FDA7DA89957CD3C; s_sess=%20s_cc%3Dtrue%3B%20s_sq%3D%3B


	protected void downloadData(DomainData domainData) {
        String mType = domainData.mimetype ?: 'application/octet-stream'
        response.contentType = mType
        response.setHeader 'Content-Type', mType
		response.setHeader 'Content-Length', "${domainData.size}"
		response.setHeader 'Content-Disposition', "attachment; filename=\"${domainData.filename ?: 'noname'}\""
        response.setDateHeader 'Last-Modified', domainData.lastUpdated.time
        try {
            response.outputStream << domainData.data
        }
        catch (IOException ex) {
            // do nothing
        }
        //response.outputStream.flush()
	}

	protected void doView(DomainData domainData) {
		if (domainData) {
			withFormat {
				html {
					viewData(domainData)
				}
				xml {
					def map = [filename: domainData.filename, width: domainData.width, height: domainData.height, description: domainData.description]
					render map as XML
				}
				json {
					def map = [filename: domainData.filename, width: domainData.width, height: domainData.height, description: domainData.description]
					render map as JSON
				}
			}
		} else {
			notFound()
		}
	}

    @Override
	protected List<String> getListFieldNames() {
		['filename', 'size', 'mimetype', 'description', 'dateCreated', 'lastUpdated']
	}

	def download() {
		def domainData = getDomainService().get(params.id)
		assert domainData != null
		downloadData(domainData)
	}

	def view() {
		def domainData = getDomainService().get(params.id)
        assert domainData != null
		doView(domainData)
	}

	def viewByFilename() {
		def domainData = getDomainService().findBy('filename', params.filename)
        assert domainData != null
		doView(domainData)
	}

    def downloadByFilename() {
        def domainData = getDomainService().findBy('filename', params.filename)
        assert domainData != null
        downloadData(domainData)
    }

	/*private void customizeDataError(Domain domainInstance) {
		FieldError firstError = null
		domainInstance.errors.getFieldError('data').each {
			firstError = it
		}
		if (firstError) {
			def newErrors = domainInstance.errors.allErrors.collect {
				if (it == firstError) {
					if (domainInstance.filename) {
						def cons = domainInstance.constraints."data"
						return new FieldError(it.objectName, it.field, it.rejectedValue, it.bindingFailure, it.codes, [domainInstance.filename, domainInstance.size / 1000000, cons.maxSize / 1000000].toArray(), null)
					}
					return new FieldError(it.objectName, it.field, it.rejectedValue, it.bindingFailure, (String[]) ["pageImage.data.noFile"].toArray(), null, null)
				}
				return it
			}
			domainInstance.clearErrors()
			newErrors.each {
				domainInstance.errors.addError(it)
			}
		}
	}*/

/*	def iframeCreate = {
		return create()
	}

	def iframeSave = {
        def pageImage = newDomainInstance(params)
		MultipartFile mf = params.data
		if (mf) {
			pageImage.filename = mf.getOriginalFilename()
			pageImage.contentType = mf.getContentType()
			pageImage.size = mf.getSize()
			def bImage = getBufferedImage(mf.getBytes())
			if (bImage) {
				pageImage.width = bImage.getWidth()
				pageImage.height = bImage.getHeight()
			}
		}
		if (pageImage.save(flush: true)) {
        	withFormat {
        		multipartForm {
					request.message = "${pageImage.id}|${pageImage.filename}|images"
					render(view: "iframeSaved", model: [pageImageInstance: pageImage])
        		}
        	}
        } else {
			customizeDataError(pageImage)
    		withFormat {
    			multipartForm {
    				render(view: "iframeCreate", model: [pageImageInstance: pageImage])
    			}
    		}
        }
	}*/
}
