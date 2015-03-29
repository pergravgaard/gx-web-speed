<g:set var="entityName" value="\${message(code: '${domainClass.propertyName}.label')}" />
<gx:form multipart="${!!multiPart}">
<gx:requiredDescription />
<g:render template="edit-fields" />
<div class="action-block scaffold-\${actionName}">
<gx:editActions />
</div>
</gx:form>