<g:set var="entityName" value="\${message(code: '${domainClass.propertyName}.label')}" />
<fieldset>
<legend><g:message code="${domainClass.propertyName}.edit.legend" args="[entityName]" /></legend>
<g:hiddenField name="id" value="\${${propertyName}.id}" />
<g:hiddenField name="version" value="\${${propertyName}.version}" />
<gx:formFields />
</fieldset>