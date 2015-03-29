<html>
<head>
<meta name="layout" content="${params['layout']?:'application'}" />
<g:set var="statusCode" value="${request.'javax.servlet.error.status_code'}" />
<title><g:message code="http.status.${statusCode}.title" args="${[statusCode]}" /></title>
<gx:css href="${resource(dir: 'css', file: 'errors.css')}" />
</head>
<body>
<g:renderException exception="${exception}" />
</body>
</html>