<div id="nav-before"></div>
<nav id="nav" role="navigation">
    webspeed
<div>
<label class="menu-toggle-label menu-toggle-label-close" for="menu-toggle"><g:message code="site.menu.label" default="Menu" /></label>
</div>
<dl class="menu-list">
<dt><g:message code="menu.regular.dt" /></dt>
<g:each var="c" in="${grailsApplication.controllerClasses.sort({ it.fullName })}">
<dd class="menu-item"><g:link controller="${c.logicalPropertyName}" class="menu-item" title="See a list of instances">${c.toString() - "Artefact > "}</g:link></dd>
</g:each>
</dl>
</nav>