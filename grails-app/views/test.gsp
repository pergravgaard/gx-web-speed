<!doctype html>
<html>
<head>
<title>Test RESTful CRUD</title>
<gx:script src="${resource(dir: 'js', file: 'DAjax.js')}" />
<gx:script src="${resource(dir: 'js', file: 'jquery-1.7.1.min.js')}" />
<gx:script>
domReady(function() {
	g('frmRest').on('submit', function(e) {
		e.preventDefault();
		var params = 'stayOnPage=true';
		var format = this.elements['format'].value;
		var cName = this.elements['restController'].value;
		var url = this.getAttribute('action') + cName;
		var httpMethod = this.elements['httpMethod'].value;
		var cAction = this.elements['controllerAction'].value;
		var paramId = this.elements['paramId'].value;
		if (cAction) {
			params += '&_method=' + httpMethod;
			switch (cAction) {
				// no id required
				case 'list':
				case 'create':
					url += '/' + cAction;
					break;
				// id required
				case 'show':
				case 'edit':
				case 'save':
				case 'update':
				case 'delete':
					url += '/' + cAction + (paramId ? '/' + paramId : '');
					break;
			}
		}
		else if (paramId) {
			url += '/' + paramId;
		}
		if (format) {
			url += '.' + format;
		} 
		out(params)
		var cfg = {
			url: url + '?' + params,
			method: httpMethod,
			onCompleteOk: function() {
				out(this.request.responseText)
			},
			onCompleteNotOk: function() {
				out('error: ' + this.request.status)
			},
			type: httpMethod.toUpperCase(),
			success: function(data, textStatus, jqXHR) {
				out('jquery: '+textStatus)
			}
		}
		new HttpRequest(cfg).open().send();
		//$.ajax(cfg);
	})
})
</gx:script>
</head>
<body>
<h1>Testing RESTful CRUD</h1>
<form id="frmRest" action="${request.contextPath}/" method="get">
<fieldset>
<legend>RESTful CRUD options</legend>
<div class="decorator">
<label for="selRestController" class="label">Controller</label>
<div class="input-wrapper">
<select id="selRestController" name="restController" class="select">
<option value="rest" selected="selected">Rest</option>
<option value="caze">Caze</option>
</select>
</div>
</div>
<div class="decorator">
<label for="selHttpMethod" class="label">HTTP Method</label>
<div class="input-wrapper">
<select id="selHttpMethod" name="httpMethod" class="select">
<option value="get">GET</option>
<option value="post">POST</option>
<option value="put">PUT</option>
<option value="delete">DELETE</option>
</select>
</div>
</div>
<div class="decorator">
<label for="selControllerAction" class="label">Controller Action</label>
<div class="input-wrapper">
<select id="selControllerAction" name="controllerAction" class="select">
<option value="">Controlled by HTTP method</option>
<option value="list">list</option>
<option value="create">create</option>
<option value="save">save</option>
<option value="show">show</option>
<option value="edit">edit</option>
<option value="update">update</option>
<option value="delete">delete</option>
</select>
</div>
</div>
<div class="decorator">
<label for="selFormat" class="label">Format</label>
<div class="input-wrapper">
<select id="selFormat" name="format" class="select">
<option value="">HTML</option>
<option value="json">JSON</option>
<option value="xml">XML</option>
</select>
</div>
</div>
<div class="decorator">
<label for="selParamId" class="label">Parameter Id</label>
<div class="input-wrapper">
<select id="selParamId" name="paramId" class="select">
<option value="">None</option>
<option value="15">15</option>
</select>
</div>
</div>
</fieldset>
<div class="action-block"><button type="submit" class="button">Submit</button></div>
</form>
<gx:script>
dBugger.writeMonitor();
</gx:script>
</body>
</html>