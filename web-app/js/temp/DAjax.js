/* TODO:
 * - cross-domain request support
 * - jsonp support
 * - if not POST request, add parameters to url. Requires open and send to be merged.
 * - HttpRequest.getPostDataString: getAsBinary is no longer supported, use FileReader instead
 * */

/*
readyStates:
	0 - open has not yet been called
	1 - open has been called, but send has not been called
	2 - send has been called, but server has not responded yet
	3 - data is being received from the server - Firefox may invoke the readystatechange handler multiple times in this state during large downloads
	4 - the server response is complete

	IMPORTANT SECURITY NOTE:

	If your server returns a JSON response in case of a GET request, it should prefix (and potentially also suffix) the response.
	This is to prevent a malicious site from retrieving the JSON data from the server by simply including a SCRIPT tag pointing towards
	your server. Then in order for this class to successfully parse the JSON response you must configure the properties jsonPrefix and jsonSuffix.
	The default value of each of these properties is the empty string.
	Furthermore regular expressions are used to parse the JSON response meaning that double quotes must be used. Single quotations won't work.
	Additionally each property name must be surrounded by quotations. This is as specified by the JSON standard.
	Actually Crockfords sanitize logic is used before parsing the server response, if it is a JSON response. See http://www.json.org/js.html.
*/

if (typeof dLib == "undefined") {
	throw new Error('DAjax.js: You must load the file DLib.js!');
}

// Cross-browser wrapper class for XMLHttpRequest
function HttpRequest(config) {
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.method = this.config.method.toLowerCase();
	this.crossDomain = false;
	this.async = this.config.async;
	this.resolveUrl(this.config.url); // may alter crossDomain, async and method
	this.request = this.crossDomain ? null : HttpRequest.createRequest(this.config.useActiveX);
	this.username = this.config.username;
	this.password = this.config.password;
	this.aborted = false;
	this.hasCompleted = false;
	this.opened = false; // is set in the open method and reset in the abort and onreadystatechange methods
	this.sent = false; // is set in the send method and reset in the abort and onreadystatechange methods
	this.timeoutId = NaN;
	this.xmlDocument = null; // will be set in the saveResponse method if response content type is XML
	this.json = null; // will be set in the parseJSON method if response content type is JSON
	this.txt = null; // will be set in the saveResponse method if response content type is anything else than listed above
	this.index = 0;
}

// See http://blogs.msdn.com/xmlteam/archive/2006/10/23/using-the-right-version-of-msxml-in-internet-explorer.aspx
HttpRequest.activeXHttpVersions = ["Msxml2.XMLHTTP.6.0", "Msxml2.XMLHTTP.3.0", "Microsoft.XMLHTTP"];
HttpRequest.instances = [];

HttpRequest.defaultConfig = {
	useActiveX: false,
	responseMimetypes: {
		js: 'text/json',
		json: 'text/json',
		xml: 'application/xml'
	},
	resetPreviousResponse: true,
	responseContentType: '', // If not automatically set by the server you must configure the content type of the response here. Otherwise you must save/interpret the response yourself!
	jsonProcessor: null, // function to modify the JSON returned from the server after parsing it as valid JSON
	onCompleteOk: null, // Will only be invoked when ready state is complete and status is ok. The handler is automatically passed the event object and this instance of the HttpRequest class.
	onCompleteNotOk: null, // Will only be invoked when ready state is complete but status is not ok (!= 200). The handler is automatically executed in the scope of this instance of the HttpRequest class.
	onNotComplete: null, // Will only be invoked when ready state is not complete (state < 4). In some frameworks this is called a 'wait' handler or an 'in progress' handler. Note that in some browsers you can't query the status of the request unless readyState is 3.	The handler is automatically executed in the scope of your instance of the HttpRequest class.
	onComplete: null, // Will only be invoked when ready state is complete (state = 4). Is invoked just before onCompleteOk/onCompleteNotOk. The handler is automatically executed in the scope of your instance of the HttpRequest class.
	onAbort: null,
	onBeforeOpen: null,
	onAfterOpen: null,
	onBeforeSend: null, // specify this method to set request headers before sending - will be passed a map with the parameters (the params property) to send, which you can append to
	onAfterSend: null,
	onTimeout: null, // Will only be invoked if the server has not responded in time (before config.timeout ms has passed).
	scope: null, // if null the scope for every handler above will be this HttpRequest instance unless you've bound your handler to another scope (i.e. invoked handler.bind) - specify window for global scope
	method: "get", // is case in-sensitive in this class, as it will be transformed to upper case when calling native open method. This is to avoid certain bugs in some browsers.
	contentType: "application/x-www-form-urlencoded; charset=UTF-8", // used when sending parameters - only has effect for POST/PUT/OPTIONS requests
	jsonPrefix: '', // If you send a GET request, consider specifying a beginning comment (/*)
	jsonSuffix: '', // If you send a GET request, consider specifying a ending comment (*/)
	url: location.href,
	async: true, // false is the default value in XMLHttpRequest.open in Firefox, but according to W3C it should be true
	username: "",
	password: "",
	doCache: false,
	changeCursorOnSend: true,
	progressId: 'divProgress', // id of container (HTML element) to display to the user while waiting for the asynchronous request to respond
	progressClass: 'progress', // CSS class name which will be appended the class attribute of the progress container - is appended on send and removed again on complete
	timeout: 3000 // How long should we wait for the server to respond? Measured in milliseconds.
}

HttpRequest.newInstance = function(config) {
	var hr = new HttpRequest(config);
	hr.index = HttpRequest.instances.length;
	HttpRequest.instances.push(hr);
	return hr;
}

HttpRequest.createRequest = function(useActiveX) {
	var xhrFactory = HttpRequest.xhrFactory;
	if (!xhrFactory) {
		useActiveX = useActiveX && dLib.ua.isIE;
		if (window.XMLHttpRequest && !useActiveX) { // In Firefox 1.5 (not Firefox 1.5.x) typeof XMLHttpRequest is 'object', not 'function'. The same goes for IE7.
			xhrFactory = function() {
				try {
					return new XMLHttpRequest();
				}
				catch (ex) {
				}
			}
		}
		else if (window.ActiveXObject) { // IE
			xhrFactory = function() {
				if (typeof HttpRequest.activeXIndex == "number") {
					return new ActiveXObject(HttpRequest.activeXHttpVersions[HttpRequest.activeXIndex]);
				}
				for (var i = 0, l = HttpRequest.activeXHttpVersions.length; i < l; i++) {
					try {
						var axo = new ActiveXObject(HttpRequest.activeXHttpVersions[i]);
						HttpRequest.activeXIndex = i;
						return axo;
					}
					catch (ex) {
					}
				}
			}
		}
		else if (window.createRequest) { // IceBrowser
			xhrFactory = function() {
				try {
					return window.createRequest();
				}
				catch (ex) {
				}
			}
		} else {
			xhrFactory = function() { return null; }
		}
		HttpRequest.xhrFactory = xhrFactory;
	}
	return HttpRequest.xhrFactory.call();
}

/*	See http://www.ietf.org/rfc/rfc4627.txt and http://bitterjavascript.com/pdf/JavaScript_Hijacking(JSON).pdf
	Example: {"name":"value","othername":"othervalue"} not {name:"value",othername:"othervalue"} nor {name:'value',othername:'othervalue'}
	Always use double quotation marks - also for property names.	*/
HttpRequest.parseJSON = function(txt) {
	txt = txt.trim(); // necessary in IE
	// try to use the native JSON parser first
	if (window.JSON && window.JSON.parse) {
		return window.JSON.parse(txt);
	}
	// logic borrowed from http://json.org/json2.js
	if (txt && /^[\],:{}\s]*$/.test(txt.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]").replace(/(?:^|:|,)(?:\s*\[)+/g, ""))) {
		return (new Function("return " + txt))();
	}
	throw new SyntaxError("Invalid JSON Structure!");
}

/*	Certain headers are considered unsafe and will/should be ignored by browsers. See http://www.w3.org/TR/XMLHttpRequest/#the-setrequestheader-method.
	NOTE: A header cannot be overwritten as other values are just appended to the first one!	*/
HttpRequest.setRequestHeader = function(request, name, value) {
	if (request && name && value) {
		var lName = name.toLowerCase();
		// These headers are considered unsafe by the standards, but Safari 3.1+ not only refuses to set the header, it throws an error. A try-catch block won't help!
		dLib.assert(!["accept-charset", "accept-encoding", "connection", "content-length", "cookie", "cookie2", "content-transfer-encoding", "date", "expect", "host", "keep-alive", "referer", "te", "trailer", "transfer-encoding", "upgrade", "user-agent", "via", "proxy-", "sec-"].some(function(entry) {
			return lName.startsWith(entry);
		}), "Illegal header: " + name + "! This header is controlled by the browser, not by you!");
		request.setRequestHeader(name, value);
	}
}

HttpRequest.success = function(xhr, loc) {
	loc = loc || location;
	try {
		/* HTTP redirects (status 302) are automatically handled by the native XMLHttpRequest object (goes for IE as well).	*/
		// IE error sometimes returns 1223 when it should be 204, so treat as success. Opera returns 0, when status is 304
		var s = xhr.status;
		return (!s && loc.protocol.toLowerCase().indexOf("file") == 0) || (s >= 200 && s < 300) || s === 304 || s === 1223 || s === 0 || (dLib.ua.isSafari && s === undefined);
	}
	catch (err) {
	}
	return false;
}

HttpRequest.getBinaryString = function(blob) {
    if (blob.getAsBinary) {
        return blob.getAsBinary();
    }
    throw "Multipart form submission not supported in the old way. Use FormData instead!";
}

/*	Function for building a HTTP request body to post to the server.
	Each entry in the dataList must be an object literal (map) with properties name and value.
	Except if the map represents a file upload. Then the map must have properties name and files, where files is a list of File or Blob instances.
	You SHOULD specify the boundary as you need to set the request header 'Content-Type' yourself, which must contain the boundary! Otherwise the upload won't succeed!	*/
HttpRequest.getPostDataString = function(dataList, config) {
	var cfg = Object.extend({
		boundary: '----------' + new Date().getTime(),
		crlf: '\r\n',
		doubleDash: '--',
		encodeValue: true, // should each value be URL encoded? Does not apply for file uploads
		contentType: 'application/octet-stream' // used if a File instance
	}, config);
	var boundary = cfg.boundary, crlf = cfg.crlf, dd = cfg.doubleDash, str = '';
	dataList.forEach(function(map) {
		if (map.files) {
			for (var i = 0, l = map.files.length; i < l; i++) {
				var file = map.files[i];
				str += dd + boundary + crlf;
				str += 'Content-Disposition: form-data; name="' + map.name + '"; filename="' + (file.name || file.fileName) + '"' + crlf;
				str += 'Content-Type: ' + (file.type || cfg.contentType);
				str += crlf + crlf + HttpRequest.getBinaryString(file) + crlf; // do NOT encode  // TODO: getAsBinary was removed, use FileReader instead
			}
		}
		else if (typeof map.value == "string") {
			str += dd + boundary + crlf;
			str += 'Content-Disposition: form-data; name="' + map.name + '"';
			str += crlf + crlf + (cfg.encodeValue ? encodeURIComponent(map.value) : map.value) + crlf;
		}
	});
	str += dd + boundary + dd + crlf; // mark end of request body
	return str;
}

HttpRequest.prototype.toString = function() {
	return "[object HttpRequest] XMLHttpRequest wrapper class";
}

HttpRequest.prototype.fireHandler = dLib.util.fireHandler;

HttpRequest.prototype.timeout = function() {
	this.timeoutId = NaN;
	this.abort(false); // do not fire onAbort, when firing onTimeout
	this.fireHandler("onTimeout");
	return this;
}

HttpRequest.prototype.clearTimeout = function() {
	if (!isNaN(this.timeoutId)) {
		clearTimeout(this.timeoutId);
	}
	this.timeoutId = NaN;
	return this;
}

HttpRequest.prototype.toggleProgress = function(show) {
	var cfg = this.config;
	if (cfg.changeCursorOnSend && document.body) { // the last check is necessary since the DOM may not be ready yet
		document.body.style.cursor = show ? "progress" : "default";
	}
	if (cfg.progressId && cfg.progressClass) {
		var dEl = g(cfg.progressId);
		if (dEl && dEl.element) {
			if (show) {
				dEl.addClass(cfg.progressClass);
			} else {
				dEl.removeClass(cfg.progressClass);
			}
		}
	}
	return this;
}

HttpRequest.prototype.abort = function(fire) {
	if (this.request && !this.aborted && !this.hasCompleted) {
		this.aborted = true; // must be set before actually aborting as the readystatechange handler will be invoked by the browser when aborting
		this.request.abort(); // this makes FF and IE (but not Chrome, Safari and Opera) fire the ready state change handler with ready state 4 and status 0 - regardless of previous ready state
		this.clearTimeout().toggleProgress(false);
		this.hasCompleted = true;
		this.opened = false;
		this.sent = false;
		if (typeof fire != "boolean" || fire) {
			this.fireHandler("onAbort");
		}
	}
	return this;
}

HttpRequest.prototype.open = function(method, url, async, username, password) {
	if (!this.request && !this.crossDomain) {
		return this;
	}
	dLib.assert(!this.opened, "DAjax.js: The open method has already been called, but the request has not yet completed!");
	this.resolveUrl(url);
	dLib.assert(this.url, "DAjax.js: No URL was provided for the open method!");
	if (this.crossDomain) {
		this.aborted = false;
		this.hasCompleted = false;
		this.opened = true;
		return this;
	}
	if (this.hasCompleted) { // don't reuse the native xhr object as this causes problems in older browsers like IE6+7
		this.request = HttpRequest.createRequest(this.config.useActiveX);
	}
	if (typeof method == "string") {
		this.method = method.toLowerCase();
	}
	if (typeof async == "boolean") {
		this.async = async;
	}
	/*	Note that auto login by specifying username and password arguments in the open method is only supported by IE, not standard browsers (like Firefox and Opera)!	*/
	if (typeof username == "string") {
		this.username = username;
	}
	if (typeof password == "string") {
		this.password = password;
	}
	this.aborted = false;
	this.hasCompleted = false;
	if (this.fireHandler("onBeforeOpen")) {
		this.request.onreadystatechange = this.onreadystatechange.bindAsEventListener(this);
		// Some browsers like Opera 9.5 and earlier versions of Firefox does not like a null username. It causes Opera to prompt for username and password. So instead of null we pass the empty string.
		this.request.open(this.method.toUpperCase(), this.url, this.async, this.username || "", this.password || ""); // method must be in uppercase in some versions of some browsers
		this.opened = true;
	}
	this.fireHandler("onAfterOpen");
	return this;
}

/*	If parameters is a string it should be URL encoded by use of the encodeURIComponent method.	Otherwise specify an object and this method will URL encode the values for you. */
HttpRequest.prototype.send = function(parameters, doCache) {
	if ((this.request || this.crossDomain) && this.url) {
		dLib.assert(this.opened, "DAjax.js: The open method must be called before the request can be sent!");
		dLib.assert(!this.sent, "DAjax.js: The send method has already been called, but the request has not yet completed!");
		parameters = this.resolveParameters(parameters);
		if (!this.crossDomain) {
			this.setRequestHeaders(window.FormData && parameters instanceof window.FormData);
		}
		if (this.fireHandler("onBeforeSend", [parameters])) {
			this.handleTimeoutAndProgress();
			if (this.crossDomain) {
				this.sendCrossDomainRequest(parameters);
			}
			else if (window.FormData && (parameters instanceof window.FormData)) {
				this.request.send(parameters);
			}
			else if (this.config.contentType.toLowerCase().indexOf("multipart/") == 0 && this.request.sendAsBinary) {
				this.request.sendAsBinary(parameters);
			} else {
				this.request.send(parameters); // some browsers (Opera 8) don't like the values null or undefined for POST requests
			}
			this.sent = true;
		}
		this.fireHandler("onAfterSend");
	}
	return this;
}

HttpRequest.prototype.sendCrossDomainRequest = function(parameters) {
	var callbackName = 'crossDomainCallback' + new Date().getTime();
	window[callbackName] = function(cb, response) {
		this.clearTimeout().toggleProgress(false);
		this.hasCompleted = true;
		this.opened = false;
		this.sent = false;
		if (!this.aborted) {
			this.saveResponse(response); // response will be accessible through HttpRequest.json
			this.fireHandler("onCompleteOk", [null]);
		}
		delete window[cb];
		var scr = document.getElementById(cb);
		scr.parentNode.removeChild(scr);
	}.bind(this, callbackName);
	var url = this.url + '?callback=' + callbackName;
	if (parameters) {
		url += '&' + parameters;
	}
	var head = q('head').item(0);
	var scr = DElement.create('script', {
		'type': 'text/javascript',
		id: callbackName,
		src: url
	});
	head.appendChild(scr);
	return this;
}

HttpRequest.prototype.handleTimeoutAndProgress = function() {
	if (this.async) {
		var cfg = this.config;
		if (cfg.timeout > 0) {
			this.timeoutId = setTimeout(this.timeout.bind(this), cfg.timeout);
		}
		this.toggleProgress(true);
	}
	return this;
}

/*  The parameters argument can be either an object literal, a string or a FormData instance.
	If it is an object literal or a string, a string is returned. If a FormData instance this instance is returned again.
	But in either case possible specified parameters in the url are appended to the returned object. */
HttpRequest.prototype.resolveParameters = function(parameters) {
	parameters = parameters || this.config.data;
	if (Object.isObject(parameters)) {
		parameters = Object.serialize(parameters);
	}
	if (typeof parameters == 'string') {
	    var params = parameters;
		if (this.parameters) {
			var sep = params ? '&' : '';
			params += sep + this.parameters;
		}
		return params;
	}
	if (window.FormData && (parameters instanceof window.FormData)) {
		// Append this.parameters if any - remember to URL decode before appending to formdata otherwise they'll be encoded twice
		if (this.parameters) {
			var arr = this.parameters.split('&');
			for (var i = 0, l = arr.length; i < l; i++) {
				var pair = arr[i].split('=');
				parameters.append(pair[0], decodeURIComponent(pair[1]));
			}
		}
	}
	return parameters;
}

HttpRequest.prototype.setRequestHeaders = function(doNotSetContentType) {
	if (this.method == "get") {
		if (typeof doCache != "boolean") {
			doCache = this.config.doCache; // default value should be true from a theoretical point of view, but in practice you almost always wanna hit the server again
		}
		if (!doCache) {
			// to avoid caching of get requests in IE and Firefox
			this.setRequestHeader("If-Modified-Since", new Date(1971, 0, 1).toUTCString());
			// to avoid caching of get requests in Opera
			this.setRequestHeader("Pragma", "no-cache");
			this.setRequestHeader("Cache-Control", "max-age=0, no-cache");
			this.setRequestHeader("Expires", "0");
		}
	}
	if (["post"].contains(this.method)) {
        // if posting a FormData object you do NOT wanna set the content type manually. Let the browser handle it.
		if (!doNotSetContentType && this.config.contentType) {
			// important to tell the server which charset is used by the browser to encode parameters, otherwise special characters like æ, ø and å won't be decoded correctly by the server
			// Note: Firefox 3+ seems to ignore the specified charset, it always uses UTF-8
			this.setRequestHeader("Content-Type", this.config.contentType);
		}
	}
	this.setRequestHeader("X-Requested-With", "XMLHttpRequest");
	//this.setRequestHeader("Origin", location.protocol + "//" + location.host); // TODO: Google Chrome (WebKit) refuses to set this header as it is considered unsafe. Hmm... I was actually setting it to be safe.
	return this;
}

/*	For some reason some browsers (FF 3.6 and IE7+) fires the readystatechange listener twice with ready state 1.
	Ready state 3 may be invoked more than once in Firefox depending on the amount of data being transferred.
	Do NOT override this method.
	NOTE:
	The readystatechange listener is also invoked when aborting the request.
	The onCompleteOk and onCompleteNotOk won't be fired though. */
HttpRequest.prototype.onreadystatechange = function(e) {
	if (this.request.readyState < 4) {
		this.fireHandler("onNotComplete", [e]);
	}
	else if (this.request.readyState == 4) {
		this.clearTimeout().toggleProgress(false);
		this.hasCompleted = true;
		this.opened = false;
		this.sent = false;
		if (!this.aborted) {
			this.saveResponse(); // no need to save response before readyState is complete
			this.fireHandler("onComplete", [e]);
			this.fireHandler(this.success() ? "onCompleteOk" : "onCompleteNotOk", [e]);
		}
	}
}

HttpRequest.prototype.success = function() {
	return HttpRequest.success(this.request);
}

HttpRequest.prototype.resetPreviousResponse = function() {
	if (this.config.resetPreviousResponse) {
		this.xmlDocument = null;
		this.json = null;
		this.txt = null;
	}
	return this;
}

HttpRequest.prototype.parseResponseContentType = function() {
	var contentType = this.request ? (this.request.getResponseHeader("Content-Type") || this.config.responseContentType) : "";
	if (!contentType) {
		var arr = this.url.split("?")[0].split(".");
		var ext = arr[arr.length - 1].toLowerCase();
		if (ext && ext in this.config.responseMimetypes) { // this is necessary if browser is offline (or has no internet connection)
			contentType = this.config.responseMimetypes[ext];
		}
	}
	if (contentType) {
		contentType = contentType.split(";")[0];
	}
	return contentType;
}

HttpRequest.prototype.saveResponse = function(response) {
	this.resetPreviousResponse();
	if (this.crossDomain && response) {
		this.json = response;
	}
	else if (this.request) {
		var contentType = this.parseResponseContentType();
		switch (contentType) {
			case "text/xml":
			case "application/xhtml+xml":
			case "application/xml":
				this.xmlDocument = new XmlDocument();
				if (this.xmlDocument.document && this.request.responseXML) {
					this.xmlDocument.document = this.request.responseXML;
					XmlDocument.prepareForXPath(this.xmlDocument.document);
				}
				break;
			case "text/json":
			case "text/ecmascript":
			case "text/javascript":
			case "application/json":
			case "application/ecmascript":
			case "application/x-ecmascript":
			case "application/javascript":
			case "application/x-javascript":
				this.parseJSON();
				break;
			default:
				this.txt = this.request.responseText;
				break;
		}
	}
	return this;
}

HttpRequest.prototype.setRequestHeader = function(name, value) {
	HttpRequest.setRequestHeader(this.request, name, value);
	return this;
}

HttpRequest.prototype.resolveUrl = function(url) {
	function isAbsoluteUrl(u) {
		var re = /^(http:|https:|ftp:|\/\/)/;
		return u.match(re) != null
	};
	if (typeof url == "string") {
		if (["post"].contains(this.method)) {
			var a = url.split('?');
			this.url = a[0];
			if (a.length > 1) { // It's assumed that these query string parameters are properly URL encoded!
				this.parameters = a[1];
			}
		} else {
			this.url = url;
		}
		var sameOrigin = true;
		if (isAbsoluteUrl(this.url)) {
			// host is hostname and port combined
			if (this.url.indexOf(location.host) == -1) {
				sameOrigin = false;
			}
			else if (this.url.indexOf('//') == 0 && this.url.indexOf(location.protocol) != 0) {
				sameOrigin = false;
			}
		}
		this.crossDomain = !sameOrigin;
		if (this.crossDomain) {
			this.method = 'get';
			this.async = true;
		}
	}
	return this;
}

HttpRequest.prototype.parseJSON = function() {
	var txt = this.request.responseText && this.request.responseText.trim();
	if (txt) {
		var cfg = this.config;
		if (cfg.jsonPrefix) {
			dLib.assert(txt.indexOf(cfg.jsonPrefix) == 0, new SyntaxError("JSON response must begin with '" + cfg.jsonPrefix + "'! The server responded: " + txt));
			txt = txt.substring(cfg.jsonPrefix.length);
		}
		if (cfg.jsonSuffix) {
			var idx = txt.length - cfg.jsonSuffix.length;
			dLib.assert(txt.indexOf(cfg.jsonSuffix) == idx, new SyntaxError("JSON response must end with '" + cfg.jsonSuffix + "'! The server responded: " + txt));
			txt = txt.substring(0, idx);
		}
		var json = HttpRequest.parseJSON(txt);
		if (typeof cfg.jsonProcessor == "function") {
			var modJson = cfg.jsonProcessor.apply(cfg.scope || this, [json, this]);
			if (modJson) {
				json = modJson;
			}
		}
		this.json = json;
	}
	return this;
}

// Cross-browser wrapper class for DOMDocument
function XmlDocument(config) {
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.document = XmlDocument.createDocument(this.config);
}

XmlDocument.defaultConfig = {
	namespaceURI: "",
	rootElementName: "",
	doctype: null,
	activeXVersions: ["Msxml2.DOMDocument.6.0", "Msxml2.DOMDocument.3.0", "Microsoft.XMLDOM"]
}

XmlDocument.defaultNamespace = 'xmlns="http://www.w3.org/XML/1998/namespace"';

// creates an empty XML document
XmlDocument.createDocument = function(config) {
	var xmlDoc = null;
	config = Object.extendAll({}, XmlDocument.defaultConfig, config);
	var namespaceURI = config.namespaceURI || "";
	var rootElementName = config.rootElementName || "root";
	if (document.implementation && document.implementation.createDocument) { // W3C
		xmlDoc = document.implementation.createDocument(namespaceURI, rootElementName, config.doctype);
		//xmlDoc.documentElement.setAttribute("xmlns:myNS", namespaceURI);
	}
	else if (dLib.ua.isIE && window.ActiveXObject) { // IE
		for (var i = 0, l = config.activeXVersions.length; i < l; i++) {
			try {
				xmlDoc = new ActiveXObject(config.activeXVersions[i]);
				break;
			}
			catch (ex) {
			}
		}
		if (xmlDoc) {
			var namespaces = XmlDocument.defaultNamespace;
			var prefix = "";
			var tagName = rootElementName;
			var index = tagName.indexOf(":");
			if (index > -1) {
				prefix = rootElementName.substring(0, index);
				tagName = rootElementName.substring(index + 1);
			}
			if (namespaceURI) {
				namespaces = 'xmlns:' + prefix + '="' + namespaceURI + '"';
			} else {
				prefix = "";
			}
			var xml = '<';
			if (prefix) {
				xml += prefix + ':';
			}
			xml += tagName + ' ' + namespaces + ' \/>';
			xmlDoc.loadXML(xml);
			xmlDoc.setProperty('SelectionLanguage', 'XPath');
			xmlDoc.setProperty('SelectionNamespaces', namespaces);
		}
	}
	return xmlDoc;
}

XmlDocument.serialize = function(contextNode) {
	return DNode.serialize(contextNode);
}

// For IE only
XmlDocument.prepareForXPath = function(doc) {
	if (!dLib.ua.isIE) {
		return;
	}
	doc.setProperty('SelectionLanguage', 'XPath');
	// read namespaces
	var namespaces = "";
	var prefix = "", attrs = doc.documentElement.attributes;
	for (var i = 0, l = attrs.length; i < l; i++) {
		var attr = attrs[i];
		if (attr.nodeName.startsWith("xmlns:")) {
			namespaces += ' ' + attr.nodeName + '="' + attr.nodeValue + '"';
		}
	}
	namespaces = namespaces ? namespaces.substring(1) : XmlDocument.defaultNamespace;
	doc.setProperty('SelectionNamespaces', namespaces);
}

/*	Cross-browser version of the MS DOMDocument.loadXML method
	Browser behavior if xmlString contains invalid XML:
		IE6+7: documentElement is null, but document.parseError has properties: 'errorCode' (!= 0) and 'reason'
		Firefox: documentElement.nodeName is 'parsererror'
		Konqueror: documentElement.nodeName is 'html'
		Safari: documentElement.firstChild.nodeName is 'parsererror'
		Opera: throws an error (LSException)

	The method returns null for browsers, which do not support XML parsing functionality of any kind.
	Due to different browser behavior the third argument is a boolean indicating if an error should be thrown
	in case of invalid XML. Default value is true.
	Just call this method inside a try-catch block and check for null. A description of a possible parsing error will
	be provided in the message property of the thrown error (Opera doesn't describe the parsing error though).
	Note that Firefox will change a possible xmlEncoding to UTF-8!
	So if a XML declaration is contained in the XML string, it is removed to ensure consistent behavior across browsers.
	To add a Processing Instruction node afterwards only works in IE.
*/
XmlDocument.parse = function(xmlString, mimetype, throwParserError) {
	var xmlDoc = null;
	if (xmlString) {
		mimetype = mimetype || "application/xml";
		if (typeof throwParserError != "boolean") {
			throwParserError = true;
		}
		var msg = "";
		// Firefox (Gecko based browsers) changes character encoding to UTF-8, so if xml declaration is specified, cut it off to ensure consistency across browsers
		var index = xmlString.indexOf("?>");
		if (index > -1) {
			xmlString = xmlString.substring(index + 2);
		}
		if (window.DOMParser) { // typeof DOMParser is 'object' in Safari 3
			try {
				xmlDoc = new DOMParser().parseFromString(xmlString, mimetype);
			}
			catch (ex) { // Opera throws an error (LSException) if xmlString contains invalid XML
				msg = "XML Parsing Error";
			}
		}
		else if (dLib.ua.isIE) { // cannot query xmlDoc.loadXML in IE (typeof returns 'unknown')
			xmlDoc = XmlDocument.createDocument();
			if (xmlDoc) {
				if (!xmlDoc.loadXML(xmlString)) {
					msg = xmlDoc.parseError.reason;
				}
			}
		}
		else if (window.XMLHttpRequest) { // Safari 1.3 + 2 goes here, see page 506 in JavaScript: The Definitive Guide, 5th edition
			// This data URL trick does NOT work in Safari 3!!
			try {
				var url = "data:" + mimetype + ";charset=UTF-8," + encodeURIComponent(xmlString);
				var request = new XMLHttpRequest();
				request.open("GET", url, false); // throws an error in Safari 3 on Windows
				if (request.overrideMimeType) {
				    request.overrideMimeType(mimetype);
	   			}
				request.send(null);
				xmlDoc = request.responseXML;
			}
			catch (ex) {
			}
		}
		if (throwParserError) {
			if (xmlDoc) {
				var root = xmlDoc.documentElement;
				if (root && !msg) {
					var txt = root.textContent;
					if (txt && txt.toLowerCase().indexOf("parsing error") > -1) {
						msg = root.textContent;
					}
					else if (root.nodeName == "parsererror" || (root.firstChild && root.firstChild.nodeName == "parsererror")) {
						msg = txt || "XML Parsing Error";
					}
				}
			}
			dLib.assert(!msg, "DAjax.js: Error parsing XML string: " + msg);
		}
	}
	return xmlDoc;
}

XmlDocument.prototype.toString = function() {
	return "[object XmlDocument] XMLDocument wrapper class";
}

XmlDocument.prototype.getElementsByTagName = function(tagName) {
	return this.document ? DDocument.getElementsByTagName(this.document, tagName) : [];
}

XmlDocument.prototype.getElementsByTagNameNS = function(namespaceURI, localTagName) {
	return this.document ? DDocument.getElementsByTagNameNS(this.document, namespaceURI, localTagName) : [];
}

XmlDocument.prototype.selectNodes = function(xpathExp, contextNode) {
	if (!contextNode && this.document && this.document.documentElement) {
		contextNode = this.document.documentElement;
	}
	return DNode.selectNodes(xpathExp, contextNode);
}

XmlDocument.prototype.selectSingleNode = function(xpathExp, contextNode) {
	if (!contextNode && this.document && this.document.documentElement) {
		contextNode = this.document.documentElement;
	}
	return DNode.selectSingleNode(xpathExp, contextNode);
}

XmlDocument.prototype.serialize = function(contextNode) {
	return XmlDocument.serialize(contextNode || this.document);
}

/*	Loads the specified url synchronously into the document property of this instance of the wrapper class.
	Note that the url must return an xml document/file.
	It will be loaded via a GET request only, but can be used with the file protocol as well.	*/
XmlDocument.prototype.load = function(url, doCache) {
	if (this.document && url) {
		var req = HttpRequest.createRequest();
		req.open("GET", url, false);
		if (typeof doCache != "boolean") {
			doCache = true;
		}
		if (!doCache) {
			// to avoid caching of get requests in IE and Firefox
			var alongTimeAgo = new Date(1971, 0, 1);
			HttpRequest.setRequestHeader(req, "If-Modified-Since", alongTimeAgo.toUTCString());
			// to avoid caching of get requests in Opera
			HttpRequest.setRequestHeader(req, "Pragma", "no-cache");
			HttpRequest.setRequestHeader(req, "Cache-Control", "max-age=0, no-cache");
			HttpRequest.setRequestHeader(req, "Expires", "0");
		}
		req.send(null);
		this.document = req.responseXML;
	}
	return this;
}

XmlDocument.prototype.transformToString = function(xslDoc) {
	return Xslt.transformToString(this.document, xslDoc);
}

XmlDocument.prototype.transformToFragment = function(xslDoc, targetDoc) {
	return Xslt.transformToFragment(this.document, xslDoc, targetDoc);
}

XmlDocument.prototype.transformToDocument = function(xslDoc, targetDoc) {
	return Xslt.transformToDocument(this.document, xslDoc, targetDoc);
}

/*	Utility class for cross-browser versions of XSLT processing methods.	*/
function Xslt() {
}

/*	A cross-browser version of MS DOMDocument.transformNode.	*/
Xslt.transformToString = function(xmlDoc, xslDoc) {
	if (xmlDoc && xslDoc) {
		xmlDoc = (xmlDoc instanceof XmlDocument) ? xmlDoc.document : xmlDoc;
		xslDoc = (xslDoc instanceof XmlDocument) ? xslDoc.document : xslDoc;
		if (window.XSLTProcessor) { // supported by Firefox, Mozilla, Safari, Chrome and Opera, but not Konqueror!
			var resultDoc = Xslt.transformToFragment(xmlDoc, xslDoc);
			var result = g(resultDoc).serialize();
			if (result.indexOf("<transformiix:result") > -1) {
				result = result.substring(result.indexOf(">") + 1, result.lastIndexOf("<"));
			}
			return result;
		}
		if (dLib.ua.isIE) {
			// transformNode returns a string
			return xmlDoc.transformNode(xslDoc);
		}
	}
	return "";
}

Xslt.transformToFragment = function(xmlDoc, xslDoc, targetDoc) {
	if (xmlDoc && xslDoc) {
		if (window.XSLTProcessor) {
			targetDoc = targetDoc || xmlDoc;
			var processor = new XSLTProcessor();
			processor.importStylesheet(xslDoc);
			return processor.transformToFragment(xmlDoc, targetDoc);
		}
		if (dLib.ua.isIE) {
// TODO: Fix this
			//var result = XmlDocument.createDocument();
			/*result.async = false;
			result.validateOnParse = true;
			xmlDoc.async = false;
			xslDoc.async = false;*/
			/*xmlDoc.transformNodeToObject(xslDoc, result); // does not work for HTML documents, maybe for XML documents?
			alert(result.documentElement);
			return null;*/
			var xmlString = Xslt.transformToString(xmlDoc, xslDoc);
			// parse string to xml document and create a node with children to simulate a DocumentFragment
			var doc = XmlDocument.parse("<fragment>" + xmlString + "<\/fragment>");
			return doc.documentElement;
		}
	}
	return null;
}

Xslt.transformToDocument = function(xmlDoc, xslDoc, targetDoc) {
	if (xmlDoc && xslDoc) {
		if (window.XSLTProcessor) {
			targetDoc = targetDoc || xmlDoc;
			var processor = new XSLTProcessor();
			processor.importStylesheet(xslDoc);
			return processor.transformToDocument(xmlDoc, targetDoc);
		}
		if (dLib.ua.isIE) {
			var xmlString = Xslt.transformToString(xmlDoc, xslDoc);
			return XmlDocument.parse(xmlString);
		}
	}
	return null;
};

function dAjax(cfg) {
	return new HttpRequest(cfg).open().send();
}