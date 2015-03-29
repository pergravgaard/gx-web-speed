<g:set var="entityName" value="\${message(code: '${domainClass.propertyName}.label')}" />
<fieldset>
<legend><g:message code="${domainClass.propertyName}.create.legend" args="[entityName]" /></legend>
<gx:formFields />
</fieldset>
