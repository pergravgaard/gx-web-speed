<gx:doctype />
<g:set var="manifest" value="${pageProperty(name: 'page.manifest')}" />
<g:if test="${manifest}">
<html xmlns="http://www.w3.org/1999/xhtml" manifest="${manifest}" class="no-js" lang="${request.locale.language}">
</g:if>
<g:else>
<html xmlns="http://www.w3.org/1999/xhtml" class="no-js" lang="${request.locale.language}">
</g:else>
<head>
<g:render template="/meta" />
<g:render template="/meta-extra" />
<g:render template="/title" />
<g:render template="/css" />
<g:render template="/css-extra" />
<g:render template="/grails_js_vars" />
<g:render template="/js" />
<g:render template="/js-extra" />
<g:layoutHead />
</head>
<body>
<gx:menuToggleCheckbox />
<g:render template="/menupane" />
<div id="outer">
<gx:messages />
<div id="messages" class="messages"></div>
<g:render template="/headerpane" />
<div id="main">
<section id="content-pane" class="content" role="main">
<g:layoutBody />
</section>
<g:render template="/content-footer" />
</div>
<g:render template="/footerpane" />
</div>
<div id="modal-layer"></div>
<div id="progress"></div>

<%--gx:script>
if (typeof dBugger != "undefined") {
	dBugger.writeMonitor('bottom:20px;height:300px;');
}
</gx:script--%>
<%--gx:script src="${resource(dir: 'js', file: 'DLib.js', plugin: 'gx-web-speed')}" />
<gx:script src="${resource(dir: 'js', file: 'DAjax.js', plugin: 'gx-web-speed')}" />
<gx:script>
if (typeof dBugger != "undefined") {
	dBugger.writeMonitor('top:20px;height:400px;');
}
(function() {
	//return
	new HttpRequest({
		url: app.contextPath + '/speedControl/getWithinBounds.json',
//		method: 'post',
		onCompleteOk: function(e, hr) {
			out(arguments.length);
		},
		onCompleteNotOk: function(e, hr) {
			if (hr.request.status == 401) {

			}
			g('divMessages').html(hr.json.html).show();
			out('not ok');
			//out(hr.request.responseText)
			//debug(hr);
		}
	}).open().send('upperLeftLatitude=53.461890432859114&upperLeftLongitude=8.667724609375&lowerRightLatitude=52.468124067331644&lowerRightLongitude=10.426025390625');
})();
</gx:script--%>
<g:render template="/body-html" />
<g:render template="/body-js" />
</body>
</html>