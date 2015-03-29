package com.grailshouse.webspeed.util

final class LocaleUtil {

	private LocaleUtil() {
		super()
	}

	/**
	 * According to the Java API documentation for the Locale class language and country can be either the empty string or a two-letter code.
	 * If not specified, variant will also be the empty string.
	 * This parse method won't accept the empty string for language though. Then null is returned.
	 * @param s
	 * @return
	 */
	static Locale parseLocale(String s) {
		String[] arr = s.split('_', 3)
		def m = [language: '', country: '', variant: '']
		['language', 'country', 'variant'].eachWithIndex { v, i ->
			def value = i < arr.length ? arr[i] : ''
			if (value) {
				if (i == 0 && !value.equals(value.toLowerCase())) {
					throw new IllegalArgumentException("Unable to parse ${s}. Language code must consist of two lower-case letters!")
				}
				if (i == 1 && !value.equals(value.toUpperCase())) { // TODO: It seems like country code does not have to be in uppercase!?
					throw new IllegalArgumentException("Unable to parse ${s}. Country code must consist of two upper-case letters!")
				}
				m[v] = value
			}
		}
		if (m.language) {
			return new Locale(m.language, m.country, m.variant)
		}
		null
	}

}
