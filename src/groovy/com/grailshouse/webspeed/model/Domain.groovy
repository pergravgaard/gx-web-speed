package com.grailshouse.webspeed.model

/**
 * @author pgr
 * The purpose of this interface is to act as a common (shared) super type for all domain classes for use by AbstractDomainController.
 * You can also use it for command objects.
 * One would think that to define a getId method in this interface makes sense, since the Hibernate (GORM) plugin will ensure (except if you define another field to act as the id) that each domain class has a getId method.
 * But to define it here, breaks the persistence functionality
 */
interface Domain {
}
