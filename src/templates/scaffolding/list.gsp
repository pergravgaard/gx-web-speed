<g:set var="entityName" value="\${message(code: '${domainClass.propertyName}.label')}" />
<!doctype html>
<html>
<head>
<title><g:message code="${domainClass.propertyName}.list.label" args="[entityName]" /></title>
</head>
<body>
<gx:listNavigation />
<h1><g:message code="${domainClass.propertyName}.list.label" args="[entityName]" /></h1>
<g:render template="data-table" />
</body>
</html>