<gx:doctype />
<html xmlns="http://www.w3.org/1999/xhtml" lang="${request.locale.language}">
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
<gx:messages />
<gx:menuToggle />
<g:render template="/menupane" plugin="gx-web-speed"/>
<div id="divBodyContainer">
	<div id="divMiddlePane">
		<div id="divContentPane" class="content">
		<g:layoutBody />
		</div>
		<g:render template="/leftpane" />
		<g:render template="/rightpane" />
	</div>
	<g:render template="/headerpane" />
	<g:render template="/footerpane" />
</div>
<div id="divModalLayer"></div>
<div id="divProgress"></div>
<div id="divMessages" class="messages"></div>
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