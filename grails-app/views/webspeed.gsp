<content tag="middleScript">
<gx:script src="${resource(dir: 'js', file: 'DMousable.js')}" />
</content>

<html>
<head>
<title></title>

<gx:script bundle="second">
domReady(function() {
	var list = document.getElementById('ulList').getElementsByTagName('li');
	DElementList.swapElements(list, 1, 3);
	g('divTest').append('<ul><li>test1</li><li>test2</li></ul>');
	g('link').on('click', function(e, handler) {
		e.preventDefault();
		alert(handler);
		dLib.event.remove(this, e.type, handler);
	})
})
</gx:script>
</head>
<body>
<h1>${grailsApplication.metadata."app.name"}</h1>
<ul id="ulList">
<li>item1</li>
<li>item2<sup>2</sup></li>
<li>item3</li>
<li>item4<sup>4</sup></li>
<li>item5</li>
</ul>
<div id="divTest"></div>
<dl>
<dt>TODO</dt>
<dd>Finish scripts tag</dd>
<dd>Finish CSS compressor</dd>
<dd>Add support for useToken attribute on form tag</dd>
<dd>A date tag which can resolve the format from registered property editor</dd>
<dd>Replace property editor with conversion service</dd>
<dd>CRUD action tags</dd>
<dd>Add tree view for tree entities</dd>
<dd>A support for placeholder attribute on INPUT elements (only allowed for types text, search, url, tel, email, and password and it does not make an associated label element obsolete) and test JavaScript validation on DForm.js accordingly</dd>
<dd></dd>
</dl>
<p>
Provides enhanced CRUD Scaffolding Templates with associated custom tags and cross-browser CSS.
A decorator tag, a messages tag, a field messages tag.
Furthermore the date picker tag is not used by these scaffolding templates as this tag has several issues regarding usability and W3C standard compliance.
The scaffolding templates generates valid XHTML 5 code.
The form tag is enhanced to support RESTful actions.
An abstract base controller is provided which supports REST and call an associated base service (a service layer is added).
</p>
<p>
Adds Domain Filter to remove the 'www' (subdomain) part of a url by redirection.
Furthermore www.domain.dk will be redirected to domain.com/dk. QUE???
</p>
<p><a id="link" href="javascript:alert('default');">TEST</a>
</p>
<p>
Adds Cache Header Filter for static resources
</p>
<%--
<g:set var="pageContext" value="${request."org.codehaus.groovy.grails.PAGE_SCOPE"}" />
<p>:${pageContext}:</p>

<div class="list">
<table class="domain-table">
<caption>Page Scope</caption>
<thead><tr><th>Name</th><th>Value</th></tr></thead>
<tbody>
<g:each in="${pageContext.attributeNames}" var="name">
<tr><td>${name}</td><td>${pageContext.getAttribute(name)}</td></tr>
</g:each>
</tbody>
</table>
</div>
--%>
<div class="list">
<table class="domain-table">
<caption>Request Scope</caption>
<thead><tr><th>Name</th><th>Value</th></tr></thead>
<tbody>
<g:each in="${request.attributeNames}" var="name">
<tr><td>${name}</td><td>${request.getAttribute(name)}</td></tr>
</g:each>
</tbody>
</table>
</div>
<div class="list">
<table class="domain-table">
<caption>Session Scope</caption>
<thead><tr><th>Name</th><th>Value</th></tr></thead>
<tbody>
<g:each in="${request.attributeNames}" var="name">
<tr><td>${name}</td><td>${session.getAttribute(name)}</td></tr>
</g:each>
</tbody>
</table>
</div>
<%--
<div class="list">
<table class="domain-table">
<caption>Application Scope</caption>
<thead><tr><th>Name</th><th>Value</th></tr></thead>
<tbody>
<g:each in="${application.attributeNames}" var="name">
<tr><td>${name}</td><td>${application.getAttribute(name)}</td></tr>
</g:each>
</tbody>
</table>
</div>
--%>
</body>
</html>