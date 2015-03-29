package com.grailshouse.webspeed.model

import org.apache.commons.lang3.builder.HashCodeBuilder
import org.apache.commons.lang3.builder.EqualsBuilder

abstract class AbstractDomainClass implements Domain {

	static mapping = {
		tablePerHierarchy false // this is necessary as several subclasses has a name field/column which is unique and/or nullable for some, but not others. Performance is slower this way, but not an issue I guess.
		id generator: 'uuid', type: 'string'
	}

	String id // if not declared as String, Grails will expect a Long
	Date dateCreated
	Date lastUpdated

	@Override
	int hashCode() {
		new HashCodeBuilder().append(id).toHashCode()
	}

	@Override
	boolean equals(final Object other) {
		if (other == null) {
			return false
		}
		if (this.is(other)) { // Don't write == in Groovy!! It is not necessarily the same as in Java!
			return true
		}
        if (getClass() != other.getClass()) {
            return false;
        }
		final AbstractDomainClass rhs = (AbstractDomainClass) other
        return new EqualsBuilder()
                 .appendSuper(super.equals(other))
                 .append(id, rhs.id)
                 .isEquals()
	}

	@Override
	String toString() {
		return this.class.name
	}

}
