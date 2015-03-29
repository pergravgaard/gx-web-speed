<g:if test="\${${!!multiPart}}">
<content tag="css">
<gx:css href="\${resource(dir: 'css', file: 'dfileupload.css', plugin: 'gx-web-speed')}" />
</content>
<gx:script src="\${resource(dir: 'js', file: 'DFileUpload.js', plugin: 'gx-web-speed')}" />
</g:if>
<gx:script>
if (typeof dLib == "object" && typeof DForm == "function") {
	domReady(function() {
		if (app.ajaxEnableForms) {
			q('form.ajax-enabled').forEach(function(form) {
				var dForm = DForm.getInstance(form);
				form.action += '.json';
				dForm.addAjaxSubmitListener();
			});
		}
	});
}
</gx:script>