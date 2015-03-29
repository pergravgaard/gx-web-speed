<g:if env="development">
<gx:script src="${resource(dir: 'js', file: 'DBugger.js', plugin: 'gx-web-speed')}" />
</g:if>
<g:pageProperty name="page.firstScript" />
<g:if test="${['list', 'index', 'tree', 'show', 'edit', 'create', 'save', 'update', 'copy'].contains(actionName)}">
<%--gx:script src="${resource(dir: 'js', file: 'sizzle.js', plugin: 'gx-web-speed')}" /--%>
<gx:script src="${resource(dir: 'js', file: 'DLib.js', plugin: 'gx-web-speed')}" />
<gx:script src="${resource(dir: 'js', file: 'DAjax.js', plugin: 'gx-web-speed')}" />
<gx:script src="${resource(dir: 'js', file: 'DFormLocale.js', plugin: 'gx-web-speed')}" />
<gx:script src="${resource(dir: 'js', file: 'DForm.js', plugin: 'gx-web-speed')}" />
<gx:script src="${resource(dir: 'js', file: 'DCalendar.js', plugin: 'gx-web-speed')}" />
<%--gx:script src="${resource(dir: 'js', file: 'DSpeech.js', plugin: 'gx-web-speed')}" /--%>
<gx:script src="${resource(dir: 'js', file: 'DScroll.js', plugin: 'gx-web-speed')}" />
</g:if>
<%--gx:script src="${resource(dir: 'js', file: 'modernizr.js', plugin: 'gx-web-speed')}" /--%>
<%--gx:script src="${resource(dir: 'js', file: 'menu.js', plugin: 'gx-web-speed')}" /--%>
<g:pageProperty name="page.middleScript" />
