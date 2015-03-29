<g:set var="entityName" value="\${message(code: '${domainClass.propertyName}.label')}" />
<!doctype html>
<html>
<head>
<title><g:message code="${domainClass.propertyName}.edit.label" args="[entityName]" /></title>
<g:render template="form-head" />
</head>
<body>
<gx:editNavigation />
<div id="edit-${domainClass.propertyName}" class="scaffold scaffold-edit" role="main">
<h1><g:message code="${domainClass.propertyName}.edit.label" args="[entityName]" /></h1>
<g:render template="edit-form" />
</div>
</body>
</html>