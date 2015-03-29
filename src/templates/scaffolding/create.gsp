<g:set var="entityName" value="\${message(code: '${domainClass.propertyName}.label')}" />
<!doctype html>
<html>
<head>
<title><g:message code="${domainClass.propertyName}.create.label" args="[entityName]" /></title>
<g:render template="form-head" />
</head>
<body>
<gx:createNavigation />
<div id="create-${domainClass.propertyName}" class="scaffold scaffold-create" role="main">
<h1><g:message code="${domainClass.propertyName}.create.label" args="[entityName]" /></h1>
<g:render template="create-form" />
</div>
</body>
</html>