<gx:script>
(function() {
    window.app = window.app || {
        messages: {
            progress: "${message(code: 'default.progress.text')}",
            confirmDelete: "${message(code: 'default.confirmDelete.text')}",
            http500: "${message(code: 'default.500.text')}"
        }
    };
    app.mode = '${grails.util.Environment.current}';
    app.contextPath = '${request.contextPath}';
    app.controllerName = '${controllerName}';
    app.entityId = '${request."${controllerName}${grailsApplication.config.grails.scaffolding.templates.domainSuffix?:'Instance'}"?.hasProperty('id')?request."${controllerName}${grailsApplication.config.grails.scaffolding.templates.domainSuffix?:'Instance'}".id:''}';
    app.requestUrl = '${request.forwardURI}';
    app.actionName = '${actionName}';
    app.locale = '${request.locale?.language}';
    app.ajaxEnableForms = '${grailsApplication.config.xtaglib.form.ajaxEnabled ?: ''}' === 'true';
    if (document.documentElement && document.documentElement.className.indexOf('no-js') > -1) {
        document.documentElement.className = document.documentElement.className.replace('no-js', 'js');
    }
})();
</gx:script>