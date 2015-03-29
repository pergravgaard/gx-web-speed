<g:set var="entityName" value="\${message(code: '${domainClass.propertyName}.label')}" />
<gx:form multipart="${!!multiPart}">
<gx:requiredDescription />
<g:render template="create-fields" />
<div class="action-block scaffold-\${actionName}">
<gx:createActions />
</div>
</gx:form>