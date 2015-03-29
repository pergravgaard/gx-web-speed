<%-- necessary for IE to avoid the presence of the compatibility mode button --%>
<% response.setHeader("X-UA-Compatible", "IE=edge,chrome=1") %>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${request.locale.language}" class="no-js">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=${request.characterEncoding?:'UTF-8'}" />
<meta name="viewport" content="initial-scale=1.0" />
<title><g:layoutTitle default="Home" /> @ <g:message code="site.title" /></title>
<gx:css rel="shortcut icon" type="image/x-icon" href="${resource(dir: 'images', file: 'favicon.ico')}" />
<gx:css rel="icon" type="image/gif" href="${resource(dir: 'images', file: 'favicon.ico')}" />
<gx:css rel="apple-touch-icon" type="image/png" href="${resource(dir: 'images', file: 'apple-touch-icon.png')}" />
<gx:css href="${resource(dir: 'css', file: 'normalize.css')}" />
<gx:css media="screen" href="${resource(dir: 'css', file: 'layout.css')}" />
<gx:css href="${resource(dir: 'css', file: 'styles.css')}" />
<gx:css href="${resource(dir: 'css', file: 'menu.css')}" />
<gx:css href="${resource(dir: 'css', file: 'errors.css')}" />
<gx:css media="print" href="${resource(dir: 'css', file: 'print.css')}" />
<g:layoutHead />
</head>
<body>
<div id="divBodyContainer">
	<div id="divMiddlePane">
		<div id="divMiddleOuter">
			<div id="divMiddleInner">
				<div id="divContentWrapper">
					<div id="divContentPane" class="content">
					<g:layoutBody />
					</div>
				</div>
				<g:render template="/rightpane" />
			</div>
		</div>
	</div>
	<g:render template="/headerpane" />
	<g:render template="/footerpane" />
</div>
</body>
</html>