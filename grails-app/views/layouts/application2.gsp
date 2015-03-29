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
<div id="divBodyContainer">
	<div id="divMiddlePane">
		<div id="divMiddleOuter">
			<div id="divMiddleInner">
				<div id="divContentWrapper">
					<div id="divContentPane" class="content">
					<g:layoutBody />
					</div>
				</div>
				<g:render template="/leftpane" />
				<g:render template="/rightpane" />
			</div>
		</div>
	</div>
	<g:render template="/headerpane" />
	<g:render template="/footerpane" />
</div>
<div id="divAjaxProgress"></div>
<div id="divMessages" class="messages"></div>
<%--gx:script>
if (typeof dBugger != "undefined") {
	dBugger.writeMonitor('top:20px;height:400px;');
}
</gx:script--%>
<g:render template="/powered-by" />
<g:render template="/body-html" />
<g:render template="/body-js" />
</body>
</html>