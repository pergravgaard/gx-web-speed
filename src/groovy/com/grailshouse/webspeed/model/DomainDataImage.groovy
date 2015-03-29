package com.grailshouse.webspeed.model

interface DomainDataImage extends DomainData {

	String getFileExtension()
	Integer getWidth()
	void setWidth(Integer width)
    Integer getHeight()
	void setHeight(Integer height)

}
