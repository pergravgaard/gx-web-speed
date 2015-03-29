package com.grailshouse.webspeed.propertyeditor

import java.beans.PropertyEditorSupport
import java.text.ParseException
import java.text.SimpleDateFormat

class DateEditor extends PropertyEditorSupport {

	private final SimpleDateFormat dateFormat
	private final Boolean allowEmpty
	private final Boolean lenient
	private final String formatPattern
	private final List<String> parsePatterns
	private final Locale locale

	DateEditor(String formatPattern, Locale locale, Boolean allowEmpty, List<String> parsePatterns = null, Boolean lenient = false) {
		this.formatPattern = formatPattern
		this.locale = locale ?: Locale.ENGLISH
		this.dateFormat = new SimpleDateFormat(formatPattern, this.locale)
		this.allowEmpty = allowEmpty
		this.parsePatterns = (parsePatterns != null) ? Collections.unmodifiableList(parsePatterns) : null
		this.lenient = lenient
		this.dateFormat.lenient = this.lenient ?: false
	}

	@Override
	String getAsText() {
		return (getValue() instanceof Date) ? dateFormat.format(getValue()) : null
	}

	@Override
	void setAsText(String value) {
		if (allowEmpty && ''.equals(value)) {
			setValue(null)
			return
		}
		if (parsePatterns && !parsePatterns.isEmpty()) {
			for (String pattern : parsePatterns) {
				try {
					dateFormat.applyPattern(pattern)
					setValue(dateFormat.parse(value))
					return
				}
				catch (ParseException ex) {
					// do nothing - try format pattern then
				}
			}
		}
		try {
			dateFormat.applyPattern(formatPattern)
			setValue(dateFormat.parse(value))
		}
		catch (ParseException ex) {
			setValue(null)
			throw new IllegalArgumentException("Could not parse date: ${ex.getMessage()}", ex)
		}
	}

}
