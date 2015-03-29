package com.grailshouse.webspeed.taglib

import grails.test.mixin.TestFor
import org.junit.Before

/**
 * See the API for {@link grails.test.mixin.web.GroovyPageUnitTestMixin} for usage instructions
 */
@TestFor(XTagLib)
class XTagLibTests {

    @Before
    void setup() {
        messageSource.addMessage('paginate.message', Locale.ENGLISH, 'Displaying {2} - {3} of {0} records (page {4} of {5})')
    }

    void testCreateFormTagWithNoAttributes() {
		tagLib.metaClass.controllerName = 'domainClass'
        tagLib.metaClass.actionName = 'create'
        assert applyTemplate('<gx:form />') == '<form role="form" action="/domainClass/save" method="post" novalidate="novalidate"><div class="field-container"></div></form>'
        assert applyTemplate('<gx:form action="" />') == '<form role="form" action="/domainClass/create" method="post" novalidate="novalidate"><div class="field-container"></div></form>'
        assert applyTemplate('<gx:form rest="true" />') == '<form role="form" action="/domainClass" method="post" novalidate="novalidate"><div class="field-container"></div></form>'
    }

	void testCopyFormTagWithNoAttributes() {
		tagLib.metaClass.controllerName = 'domainClass'
		tagLib.metaClass.actionName = 'copy'
        assert applyTemplate('<gx:form />') == '<form role="form" action="/domainClass/save" method="post" novalidate="novalidate"><div class="field-container"></div></form>'
        assert applyTemplate('<gx:form action="" />') == '<form role="form" action="/domainClass/save" method="post" novalidate="novalidate"><div class="field-container"></div></form>'
        assert applyTemplate('<gx:form action="/domainClass/save" method="post" />') == '<form role="form" action="/domainClass/save" method="post" novalidate="novalidate"><div class="field-container"></div></form>'
    }

	void testEditFormTagWithNoAttributes() {
		tagLib.metaClass.controllerName = 'domainClass'
		tagLib.metaClass.actionName = 'edit'
        assert applyTemplate('<gx:form />') == '<form role="form" action="/domainClass/update" method="post" novalidate="novalidate"><div class="field-container"></div></form>'
        assert applyTemplate('<gx:form action="" />') == '<form role="form" action="/domainClass/edit" method="post" novalidate="novalidate"><div class="field-container"></div></form>'
        assert applyTemplate('<gx:form rest="true" />') == '<form role="form" action="/domainClass" method="post" novalidate="novalidate"><div class="field-container"><input type="hidden" name="_method" value="PUT" /></div></form>'
    }

	void testShowFormTagWithNoAttributes() {
		tagLib.metaClass.controllerName = 'domainClass'
		tagLib.metaClass.actionName = 'show'
        assert applyTemplate('<gx:form />') == '<form role="form" action="/domainClass/delete" method="post" novalidate="novalidate"><div class="field-container"></div></form>'
        assert applyTemplate('<gx:form action="" />') == '<form role="form" action="/domainClass/show" method="post" novalidate="novalidate"><div class="field-container"></div></form>'
        assert applyTemplate('<gx:form rest="true" />') == '<form role="form" action="/domainClass" method="post" novalidate="novalidate"><div class="field-container"><input type="hidden" name="_method" value="DELETE" /></div></form>'
    }

	void testFormTagWithAttributes() {
        assert applyTemplate('<gx:form method="get" action="/search" />') == '<form role="form" action="/search" method="get" novalidate="novalidate"><div class="field-container"></div></form>'
    }

	void testSortColumnWhenNoUrlParameters() {
		tagLib.metaClass.request = [parameterMap: [:]]
		assert applyTemplate('<gx:sortColumn field="lastUpdated" text="text" />') == '<th class="sortable"><a href="?sort=lastUpdated&amp;order=asc">text</a></th>'
	}

	void testSortColumnWithUrlParameters() {
		Map<String, List<String>> map = new LinkedHashMap<String, List<String>>()
		map.put 'lang', ['en', 'da']
		tagLib.metaClass.request = [parameterMap: map]
		params.sort = 'dateCreated'
		assert applyTemplate('<gx:sortColumn field="lastUpdated" text="text" />') == '<th class="sortable"><a href="?lang=en&amp;lang=da&amp;sort=lastUpdated&amp;order=asc">text</a></th>'
	}

	void testSortColumnToggleOrder() {
		params.sort = 'lastUpdated'
		params.order = 'asc'
		assert applyTemplate('<gx:sortColumn field="lastUpdated" text="text" />') == '<th class="sortable sorted asc"><a href="?sort=lastUpdated&amp;order=desc">text</a></th>'
	}

    void testPaginate() {
        assert applyTemplate('<gx:paginate total="0" />') == ''
        assert applyTemplate('<gx:paginate total="5" />') == '<div class="paginate-bar" rel="5"><div class="paginate-message">Displaying 1 - 5 of 5 records (page 1 of 1)</div><div class="paginate"></div></div>'
        assert applyTemplate('<gx:paginate total="10" />') == '<div class="paginate-bar" rel="10"><div class="paginate-message">Displaying 1 - 10 of 10 records (page 1 of 1)</div><div class="paginate"></div></div>'
        assert applyTemplate('<gx:paginate total="15" />') == '<div class="paginate-bar" rel="15"><div class="paginate-message">Displaying 1 - 10 of 15 records (page 1 of 2)</div><div class="paginate"><span class="currentStep">1</span><a href="?offset=10&amp;max=10" class="step">2</a><a href="?offset=10&amp;max=10" class="nextLink">Next</a></div></div>'
        assert applyTemplate('<gx:paginate total="20" />') == '<div class="paginate-bar" rel="20"><div class="paginate-message">Displaying 1 - 10 of 20 records (page 1 of 2)</div><div class="paginate"><span class="currentStep">1</span><a href="?offset=10&amp;max=10" class="step">2</a><a href="?offset=10&amp;max=10" class="nextLink">Next</a></div></div>'
        assert applyTemplate('<gx:paginate total="25" />') == '<div class="paginate-bar" rel="25"><div class="paginate-message">Displaying 1 - 10 of 25 records (page 1 of 3)</div><div class="paginate"><span class="currentStep">1</span><a href="?offset=10&amp;max=10" class="step">2</a><a href="?offset=20&amp;max=10" class="step">3</a><a href="?offset=10&amp;max=10" class="nextLink">Next</a></div></div>'
    }

}
