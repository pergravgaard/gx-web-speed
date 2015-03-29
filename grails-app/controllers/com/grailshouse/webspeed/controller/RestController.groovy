package com.grailshouse.webspeed.controller

import grails.converters.JSON
import grails.converters.XML

class RestController {

	def protected renderResponse(String vw) {
		def map = [action: vw, httpMethod: request.method, id: params.id, enctype: request.contentType, stayOnPage: params.stayOnPage]
		def htm = "<span>view: ${vw}, httpMethod: ${request.method}, id: ${params.id}</span>"
		withFormat {
			html {
				render(contentType: 'text/html', encoding: 'UTF-8', text: htm)
			}
// form seems to have no effect - html will be triggered instead
//			form {
//				render(contentType: 'text/html', encoding: 'UTF-8', text: htm)
//			}
			json {
				render map as JSON
			}
			xml {
				render map as XML
			}
		}
	}

	def index() {
		renderResponse('index')
	}

	def show() {
		renderResponse('show')
	}

	def save() {
		renderResponse('save')
	}

	def update() {
		renderResponse('update')
	}

	def delete() {
		renderResponse('delete')
	}

	def create() {
		renderResponse('create')
	}

	def edit() {
		renderResponse('edit')
	}

	def list() {
		renderResponse('list')
	}
}
