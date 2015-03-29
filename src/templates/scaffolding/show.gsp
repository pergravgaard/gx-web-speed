<g:set var="entityName" value="\${message(code: '${domainClass.propertyName}.label')}" />
<!doctype html>
<html>
<head>
<title><g:message code="${domainClass.propertyName}.show.label" args="[entityName]" /></title>
</head>
<body>
<gx:showNavigation />
<div id="show-${domainClass.propertyName}" class="scaffold scaffold-show" role="main">
<h1><g:message code="${domainClass.propertyName}.show.label" args="[entityName]" /></h1>
<gx:form>
<fieldset>
<legend><g:message code="${domainClass.propertyName}.show.legend" args="[entityName]" /></legend>
<gx:showFields />
</fieldset>
<div class="action-block scaffold-\${actionName}">
<gx:showActions />
</div>
</gx:form>
</div>
</body>
</html>
