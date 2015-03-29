<gx:css rel="shortcut icon" type="image/x-icon" href="${resource(dir: 'images', file: 'favicon.ico')}" />
<gx:css rel="icon" type="image/gif" href="${resource(dir: 'images', file: 'favicon.ico')}" />
<gx:css rel="apple-touch-icon" type="image/png" href="${resource(dir: 'images', file: 'apple-touch-icon.png')}" />
<gx:css rel="apple-touch-icon" type="image/png" sizes="114x114" href="${resource(dir: 'images', file: 'apple-touch-icon-retina.png')}" />
<gx:css media="screen" href="${resource(dir: 'css', file: 'layout.css', plugin: 'gx-web-speed')}" />
<%--gx:css media="screen" href="${resource(dir: 'css', file: 'mobile-layout.css', plugin: 'gx-web-speed')}" /--%>
<gx:css href="${resource(dir: 'css', file: 'font.css', plugin: 'gx-web-speed')}" />
<%--gx:css href="${resource(dir: 'css', file: 'ionicons.min.css', plugin: 'gx-web-speed')}" /--%>
<gx:css href="${resource(dir: 'css', file: 'styles.css', plugin: 'gx-web-speed')}" />
<gx:css href="${resource(dir: 'css', file: 'menu.css', plugin: 'gx-web-speed')}" />
<g:if test="${['list', 'index', 'tree', 'show', 'edit', 'create', 'save', 'update', 'copy'].contains(actionName)}">
<gx:css href="${resource(dir: 'css', file: 'dcalendar.css', plugin: 'gx-web-speed')}" />
<gx:css href="${resource(dir: 'css', file: 'crud-view.css', plugin: 'gx-web-speed')}" />
<gx:css href="${resource(dir: 'css', file: 'form.css', plugin: 'gx-web-speed')}" />
</g:if>
<g:pageProperty name="page.css" />
<g:if test="${controllerName != 'login' && controllerName != 'signin'}">
<gx:css rel="alternate stylesheet" title="Print Preview" href="${resource(dir: 'css', file: 'print.css', plugin: 'gx-web-speed')}" />
<gx:css media="print" href="${resource(dir: 'css', file: 'print.css', plugin: 'gx-web-speed')}" />
</g:if>

