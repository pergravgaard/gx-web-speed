package com.grailshouse.webspeed.model

interface DomainData extends Domain {

	byte[] getData() // could be bean getter for data field or return the data from associated lazy-loaded binary data domain class. Will be called by AbstractDomainDataController and AbstractDomainDataImageController.
	void setData(byte[] data)
	String getMimetype()
	void setMimetype(String mimetype)
	String getFilename()
	void setFilename(String filename)
	String getDescription()
	void setDescription(String description)
	Long getSize()
	void setSize(Long size)
	Date getDateCreated()
	void setDateCreated(Date dateCreated)
	Date getLastUpdated()
	void setLastUpdated(Date lastUpdated)

}
