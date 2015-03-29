/*
 * TODO:
 * 	- Rename DForm.reportInvalid to DField.reportInvalid and DForm.reportOk to DField.reportOk
 *  - DField.markInvalid: don't keep two separate lists for modelling a message and associated severity
 *  - Create Message API in DLib.js
 *  - Convert severity constants to enum (object literal) 
 *  - File API
NOTE:	None of the D classes in this file has an init method
				   		DField
				  /   \   \		  \
		DTextInput DButton DSelect DChoiceGroup
		/       \					/		\
	DInput   DTextArea			DRadio		DCheckBox

Each instance of these classes should be instantiated through DField.getInstance (which cannot be called before the element is read into the DOM).
The getInstance method saves a reference to the DField instance on the associated DForm instance in order to fetch the same instance again.
In this way a possible config object is preserved for each instance, which is needed across events.
If a config object is not provided on instantiation, a later invocation of getInstance with a config object, then saves the passed config object on the instance.
*/
if (typeof dLib == "undefined") {
	throw new Error('DForm.js: You must load DLib.js!');
};

dLib.assert(typeof dFormLocale != "undefined", 'DForm.js: You must load DFormLocale.js!');

// NOTE: INPUT tags of type hidden are mapped to the DField class. A FIELDSET element is mapped to DElement.
Object.extend(dLib.domMappings, {
	form: "DForm",
	button: "DButton",
	input_button: "DButton",
	input_submit: "DButton",
	input_image: "DButton",
	input_reset: "DButton",
	input_text: "DInput",
	input_file: "DInput",
	input_password: "DInput",
	input_radio: "DRadio",
	input_checkbox: "DCheckBox",
	input: "DField",
	textarea: "DTextArea",
	select: "DSelect"
});

// NOTE: You should instantiate this class via the getInstance function! Otherwise it may not work properly!
function DForm(form, config) {
	this.form = form;
	this.messages = null;
	this.dFields = {};
	this.decoratedFields = [];
	DForm.superConstructor.apply(this, [this.form, config]);
	this.configured = !!config;
}

DForm.inheritFrom(DElement);

DForm.SEVERITY_INFO = 0;
DForm.SEVERITY_WARN = 1;
DForm.SEVERITY_ERROR = 2;
DForm.SEVERITY_FATAL = 3;

DForm.defaultFieldConfig = {
	focusIgnoreCss: true, // if true the CSS properties display and visibility won't be checked when determining whether the field is focusable or not
	msgClass: "field-messages",
	nestedClass: "field", // this class is added to the field element inside the decorator for which a validation message was shown. Is removed again when the form is reset. Useful when a decorator contains another decorator (typically zipcode & city fields)
	scope: null, // shared scope object for the following pseudo handlers
	onBeforeShowMessage: null, // a function (or handler object - an object literal with properties 'scope' and 'handleEvent' - scope defaults to the DField instance) to invoke before showing the message - return false to prevent showing the message
	onAfterShowMessage: null, // a function (or handler object - an object literal with properties 'scope' and 'handleEvent' - scope defaults to the DField instance) to invoke after showing the message
	onBeforeHideMessage: null, // a function (or handler object - an object literal with properties 'scope' and 'handleEvent' - scope defaults to the DField instance) to invoke before hiding the message - return false to prevent hiding the message
	onAfterHideMessage: null // a function (or handler object - an object literal with properties 'scope' and 'handleEvent' - scope defaults to the DField instance) to invoke after hiding the message
};

DForm.defaultConfig = Object.configure({
	boundaryString: "----" + new Date().getTime(), // used if trying to upload file(s) via Ajax. Can be done in Firefox, but requires universal browser privileges.
	msgsId: "messages", // id of container or a function returning a string or DOM element in which validation messages will be written - if null or the empty string no list of messages will be displayed
	hasMessagesClass: "has-messages", // className given to the validation messages container, if validation not successful.
	noMessagesClass: "no-messages", // className given to the validation messages container, when validation is reset.
	processingClass: "processing",
	showProcessing: true,
	changeCursorOnsubmit: true, // changes the cursor for document.body to the progress cursor
	validatePasswordConfirmation: true,
	doEncodeValues: false, // is done in the reportOk method
	resetDelay: 5000, // delay before form is 'reset' (buttons are enabled again and form processing message is hidden) after form submission. Usually only relevant if server not responding or user presses STOP.
	validateFilter: null, // if a function is specified the forms elements will be filtered with this function. Arguments will be the form element, the elements order and the array containing the forms elements. Scope will be the DForm instance. Return true to include the element and false to exclude it.
	getMessagesStartTag: null,
	getMessagesEndTag: null,
	getMessageStartTag: null,
	getMessageEndTag: null,
	getMessagesHeadlineStartTag: null,
	getMessagesHeadlineEndTag: null,
	scope: null, // shared scope object for the following pseudo handlers - if null scope defaults to the DForm instance
	onBeforeSubmit: null, // will be executed in the scope of the DForm instance, return false to prevent submission,
	onAfterSubmit: null, // possible pseudo event handler - will be executed in the scope of the DForm instance, is passed a possible event object
	onBeforeReset: null, // possible pseudo event handler - will be executed in the scope of the DForm instance, must return a boolean
	onAfterReset: null, // possible pseudo event handler - will be executed in the scope of the DForm instance
	onBeforeShowMessages: null, // possible pseudo event handler - will be executed in the scope of the DForm instance, is passed a HTML string, must return a boolean
	onAfterShowMessages: null, // possible pseudo event handler - will be executed in the scope of the DForm instance, is passed a HTML string
	onBeforeHideMessages: null, // possible pseudo event handler - will be executed in the scope of the DForm instance, must return false to prevent hiding messages - will be fired when form decoration is reset
	onAfterHideMessages: null, // possible pseudo event handler - will be executed in the scope of the DForm instance - will be fired when form decoration is reset
	onValidatedOk: null,
	onValidatedNotOk: null,
	/* 	Will be executed if the form has a file upload and you called addAjaxSubmitListener.
		Since only FF (at the time of writing) fully supports uploading files with AJAX, we can simulate Ajax behavior by submitting via a
		hidden iframe. You'll have to specify the property 'useIframeIfMultipart' as true for the configuration object passed to
		addAjaxSubmitListener though. Make sure that the server doesn't issue a redirect as this won't fire the onload event of the hidden iframe.
		The onIframeLoaded method is intended for reading the server response in the hidden iframe and displaying them in the parent page.
		Is executed in the scope of the DForm instance and passed two arguments; the iframe element and the DForm instance.	*/
	onIframeLoaded: null,
	// An object for shared configuration for the fields on the form - properties defined here will be overridden by corresponding properties in the config object for each DField instance
	fieldConfig: DForm.defaultFieldConfig
}, DElement.defaultConfig);

DForm.instances = {};

// Cannot be called before the DOM is ready!
DForm.getInstance = function(form, config) {
	var id = "";
	if (typeof form == "string") {
		id = form;
		form = document.getElementById(id);
	} else {
		id = DElement.getId(form);
	}
	var instance = DForm.instances[id];
	if (!instance) {
		instance = DForm.instances[id] = new DForm(form, config);
	}
	else if (config && !instance.configured) {
		Object.extend(instance.config, config);
		instance.configured = true;
	}
	if (instance.form !== form) { // this can be the case if referring to the DOM in another window (like an iframe)
		instance.form = form;
	}
	return instance;
}

DForm.formatMessage = dLib.util.formatMessage;

DForm.reportInvalid = function(field, msg, severity) {
	var dField = (field instanceof DField) ? field : DField.getInstance(field);
	if (dField) {
		dField.markInvalid(msg, severity);
	}
	return false;
}

DForm.reportOk = function(field, doEncode) {
	field = (field instanceof DField) ? field.field : field;
	if (field && field.type) {
		/*	Make sure that no tags of any kind is submitted in the field by removing the characters '<' and '>'
			It is not allowed to alter the value of a field of type file with JavaScript! */
		if (field.type == "text" || field.type == "hidden" || field.type == "textarea" || field.type == "password") {
			if (typeof doEncode != "boolean") {
				doEncode = true;
			}
			if (doEncode && field.value.encode) {
				field.value = field.value.encode();
			}
		}
	}
	return true;
}

DForm.getForm = function(formNameOrId) {
	if (formNameOrId) {
		var form;
		if (formNameOrId.indexOf("document.") > -1 || formNameOrId.indexOf("document[") > -1) {
			eval('form=' + formNameOrId + ';');
		}
		if (!form) {
			if (document.forms) {
				form = document.forms[formNameOrId];
			}
			else if (document.getElementById) {
				form = document.getElementById(formNameOrId);
			} else {
				form = document[formNameOrId];
			}
		}
		return form;
	}
	return null;
}

/* can also be used after server side validation */
DForm.setFocus = function(formNameOrId, fieldNameOrId) {
	var field;
	var form = formNameOrId ? DForm.getForm(formNameOrId) : null;
	if (form) {
		field = form[fieldNameOrId];
	}
	else if (document.getElementById) {
		field = document.getElementById(fieldNameOrId);
	}
	if (field && typeof field.length == "number" && field.type.indexOf("select") == -1) { // if field is a radio button group or a checkbox group, but not a drop-down list
		field = field[0];
	}
	if (!field && fieldNameOrId) {
		try {
			field = document.forms[0][fieldNameOrId]; // document.forms[0] is a guess
		}
		catch (ex) {
			throw new Error("DForm.js: Unable to guess the form containing the field: '" + fieldNameOrId + "'");
		}
	}
	if (field) {
		// must use DField.getInstance before calling isFocusable to get configured behavior by focusIgnoreCss
		DField.getInstance(field).focus();
	}
	return false;
}

DForm.getMessagesStartTag = function() {
	return '<dl>';
}

DForm.getMessagesHeadlineStartTag = function() {
	return '<dt>';
}

DForm.getMessagesHeadlineEndTag = function() {
	return '<\/dt>';
}

DForm.getMessageStartTag = function(index) {
	return '<dd>';
}

DForm.getMessageEndTag = function(index) {
	return '<\/dd>';
}

DForm.getMessagesEndTag = function() {
	return '<\/dl>';
}

/*	Should be called like this:
	<form ... onsubmit="return DForm.prepareSubmission(this, true);">	*/
DForm.prepareSubmission = function(form, showProcessing) {
	return DForm.getInstance(form).prepareSubmission(showProcessing);
}

// NOTE: In IE6+7+8, Chrome 2 and Safari (3.2.3 + 4 beta) a possible onclick listener on the default submit button won't be fired when pressing ENTER to submit the form. In Chrome and Safari this only applies if the button is a BUTTON tag.
DForm.buttonClicked = function(btn) {
	if (btn.form) {
		DForm.getInstance(btn.form).clickedButton = btn;
	}
}

/*	The bug is fixed in Safari 3.0	*/
DForm.labelClicked = function(e) {
	if (dLib.ua.isLikeSafari_2 && document.getElementById) {
		var label = e.currentTarget;
		var id = label.htmlFor;
		var field;
		if (typeof id == "string") {
			field = document.getElementById(id);
		} else {
			var arr = label.children; // contains element nodes only
			for (var i = 0, l = arr.length; i < l; i++) {
				var el = arr[i];
				if (['INPUT', 'SELECT', 'TEXTAREA'].contains(el.tagName.toUpperCase())) {
					field = el;
					break;
				}
			}
		}
		if (field) {
			if (field.type == "radio" || field.type == "checkbox") {
				field.click();
			} else {
				field.focus();
			}
		}
	}
}

/*	Should be invoked like this:
	<form onsubmit="return DForm.validate(this);" ...other attributes...>	*/
DForm.validate = function(form) {
	return DForm.getInstance(form).onSubmitListener();
}

/*	Should be invoked like this:
	<form onsubmit="return DForm.validateAsync(this, {<see DAjax.js for config parameters>});" ...other attributes...>	*/
DForm.validateAsync = function(form, ajaxConfig) {
	return DForm.getInstance(form).onSubmitAsyncListener(null, ajaxConfig);
}

/*	Should be invoked like this:
	<form onreset="return DForm.reset(this, true);" ...other attributes...>	*/
DForm.reset = function(form, doPrompt) {
	return DForm.getInstance(form).onResetListener(doPrompt);
}

DForm.prototype.getSubmitButtons = function() {
	return q('button[type="submit"], input[type="submit"], input[type="image"]', this.form).elements;
}

DForm.prototype.getDefaultSubmitButton = function() {
	var buttons = this.getSubmitButtons();
	return (buttons.length > 0) ? DField.getInstance(buttons[0]) : null;
}

DForm.prototype.showProcessingFormData = function(htm) {
	this.setDivMessages();
	if (this.divMsgs) {
		htm = htm || dFormLocale.processingFormData;
		this.divMsgs.replaceClass(this.config.noMessagesClass, this.config.hasMessagesClass, true).addClass(this.config.processingClass).html(htm);
	}
	return this;
}

DForm.prototype.enableButtons = function() {
	if (this.disabledButtons) {
		this.disabledButtons.forEach(function(btn) {
			btn.disabled = false;
		});
	}
	return this;
}

// do not disable buttons of type 'button' and 'reset'
DForm.prototype.disableButtons = function() {
	this.disabledButtons = [];
	var buttons = this.getSubmitButtons();
	for (var i = 0, l = buttons.length; i < l; i++) {
		var btn = buttons[i];
		if (typeof btn.disabled == "boolean" && !btn.disabled) { // do not disable already disabled buttons - they should not necessarily be enabled again
			btn.disabled = true;
			this.disabledButtons.push(btn);
		}
	}
	return this;
}

DForm.prototype.getElement = function(elementName) {
    return elementName ? this.form.elements[elementName] : null;
}

DForm.prototype.getIndex = function() {
	for (var i = 0, l = document.forms.length; i < l; i++) {
		if (this.form === document.forms[i]) {
			return i;
		}
	}
	return NaN;
}

DForm.prototype.onResetListener = function(doPrompt) {
	var reset = true;
	if (typeof doPrompt != "boolean") {
		doPrompt = true;
	}
	if (doPrompt) {
		reset = confirm(DForm.formatMessage(dFormLocale.resetForm));
	}
	if (reset) {
		this.resetValidation();
	}
	return reset;
}

DForm.prototype.setDivMessages = function() {
	if (!this.divMsgs) {
		var cfg = this.config;
		var res = (typeof cfg.msgsId == "function") ? cfg.msgsId.apply(cfg.scope || this, [this]) : cfg.msgsId;
		this.divMsgs = g(res);
	}
	return this;
}

DForm.prototype.addMessage = function(msgObj) {
	if (!this.messages) {
		this.messages = [];
	}
	this.messages.push(msgObj);
}

DForm.prototype.resetValidation = function(fireOnHide) {
	this.messages = null;
	this.resetDecoration();
	DChoiceGroup.resetValidation();
	this.hideMessages(fireOnHide);
	return this;
}

DForm.prototype.resetDecoration = function() {
	while (this.decoratedFields.length > 0) {
		var df = this.decoratedFields.shift();
		df.resetDecoration();
	}
}

DForm.prototype.showMessages = function(htm, passedValidation) {
	if (this.fireHandler("onBeforeShowMessages", [htm, !!passedValidation])) {
		if (this.divMsgs) {
			this.divMsgs.html(htm).replaceClass(this.config.noMessagesClass, this.config.hasMessagesClass, true);
		}
	}
	this.fireHandler("onAfterShowMessages", [htm, !!passedValidation])
	return this;
}

DForm.prototype.hideMessages = function(fireOnHide) {
	if (typeof fireOnHide != "boolean") {
		fireOnHide = true;
	}
	if (!fireOnHide || this.fireHandler("onBeforeHideMessages")) {
		if (this.divMsgs) {
			this.divMsgs.replaceClass(this.config.hasMessagesClass, this.config.noMessagesClass, true)
			.removeClass(this.config.processingClass)
			.html('');
		}
	}
	if (fireOnHide) {
		this.fireHandler("onAfterHideMessages");
	}
	return this;
}

DForm.prototype.validateWhenTyping = function(e) {
	var dEvent = (e instanceof DEvent) ? e : g(e);
	// skip strokes on ALT (18), TAB (9) and ENTER (13) for key events
	if (dEvent.type.indexOf("key") == 0) {
		var key = dEvent.getKeyCode();
		if (dEvent.isAltDown() || key == 18 || key == 9 || key == 13) {
			return true;
		}
	}
	var dField = DField.getInstance(dEvent.target);
	dField.resetDecoration(); // important to reset before testing for validation
	if (dField.doValidate() || dField.validateIfNotEmpty(true)) {
		if (dField.hasOwnValidator()) {
			dField.validateByValidator(e);
		} else {
			dField.validate();
		}
		dField.decorate();
	}
	return true;
}

DForm.prototype.showValidationMessages = function(mayFocus, headline) {
	if (this.decoratedFields.length > 0) {
		if (typeof mayFocus != "boolean") {
			mayFocus = true;
		}
		var htm = '';
		var cfg = this.config;
		var sTag = cfg.getMessageStartTag || DForm.getMessageStartTag;
		var eTag = cfg.getMessageEndTag || DForm.getMessageEndTag;
		if (this.messages) {
			for (var i = 0, l = this.messages.length; i < l; i++) {
				var msg = this.messages[i];
				// TODO: fix severity css
				htm += sTag.call(this) + '<span class="' + (msg.severity || 'error-message') + '">' + msg.message + '<\/span>' + eTag.call(this);
			}
		}
		for (var i = 0, l = this.decoratedFields.length; i < l; i++) {
			var dField = this.decoratedFields[i];
			dField.decorate();
			if (dField.msgs.length > 0) {
				var field = dField.field;
				if (mayFocus) {
					dField.focus();
					mayFocus = false; // only focus in the first field
				}
				var args = '';
				if (field.id) {
					args = 'null, \'' + field.id + '\'';
				}
				else if (this.form.id) {
					args = '\'' + this.form.id + '\', \'' + field.name + '\'';
				}
				else if (this.form.name) {
					args = '\'' + this.form.name + '\', \'' + field.name + '\'';
				}
				for (var j = 0, len = dField.msgs.length; j < len; j++) {
					htm += sTag.apply(this, [i + j]);
					htm += '<a class="' + dField.getInvalidLinkClass(j) + '" href="" onclick="return DForm.setFocus(' + args + ')" title="' + DForm.formatMessage(dFormLocale.clickToCorrectError) + '">' + dField.msgs[j] + '<\/a>';
					htm += eTag.apply(this, [i + j]);
				}
			}
		}
		if (htm) {
			var startTag = cfg.getMessagesStartTag || DForm.getMessagesStartTag;
			var endTag = cfg.getMessagesEndTag || DForm.getMessagesEndTag;
			var hlStartTag = cfg.getMessagesHeadlineStartTag || DForm.getMessagesHeadlineStartTag;
			var hlEndTag = cfg.getMessagesHeadlineEndTag || DForm.getMessagesHeadlineEndTag;
			htm = startTag.apply(this, []) + hlStartTag.apply(this, []) + (headline || DForm.formatMessage(dFormLocale.errorsHeadline)) + hlEndTag.apply(this, []) + htm + endTag.apply(this, []);
			this.showMessages(htm);
		}
	}
	return this;
}

DForm.prototype.reset = function(fireOnreset) {
	if (typeof fireOnreset != "boolean") {
		fireOnreset = true;
	}
	var doReset = true;
	if (fireOnreset) {
		doReset = this.form.onreset && this.form.onreset();
	}
	if (doReset) {
		this.form.reset();
	}
	return this;
}

DForm.prototype.submit = function(fireOnsubmit) {
	if (typeof fireOnsubmit != "boolean") {
		fireOnsubmit = true;
	}
	var doSubmit = true;
	if (fireOnsubmit) {
		doSubmit = this.form.onsubmit();
	}
	if (doSubmit) {
		this.form.submit();
	}
	return this;
}

DForm.prototype.submitAsync = function(hrConfig) {
	dLib.assert(typeof HttpRequest === "function", 'DForm.js: You must load DAjax.js to submit the form the Ajax way!');
	var hr, encType = (this.form.enctype || 'application/x-www-form-urlencoded').toLowerCase();
	var isMultipart = (encType.indexOf('multipart/') == 0);
	if (this.httpRequest instanceof HttpRequest) {
		hr = this.httpRequest;
	} else {
		// important to save reference for hrConfig for use in fireAjaxHandler
		this.hrConfig = Object.extend({
			followRedirect: true, // should the code follow a possible redirect url specified by a redirect property in the JSON response - has nothing to do with HTTP 302 redirect
			/*	Should a hidden iframe be used for multipart forms (i.e. has a file upload control)?
			 * 	Only has effect if the browser doesn't support file uploads through Ajax.
			 *	At the time of writing only Firefox fully supports this.
			 *	If true, make sure the server doesn't issue a redirect as this won't fire the onload event
			 *	of the hidden iframe.	*/
			useIframeIfMultipart: false
		}, hrConfig);
		// form.acceptCharset may be the string 'UNKNOWN' in IE!!
		var charset = ((this.form.acceptCharset || '').replace('UNKNOWN', '') || 'UTF-8').split(/\s+|,/g)[0];
		var cfg = Object.extendAll({ timeout: this.config.resetDelay, progressId: this.config.msgsId }, hrConfig || {}, {
			contentType: encType + '; charset=' + charset + ((isMultipart && this.config.boundaryString) ? '; boundary=' + this.config.boundaryString : ''),
			onCompleteOk: this.onCompleteOkHandler.bind(this),
			onCompleteNotOk: this.onCompleteNotOkHandler.bind(this),
			onTimeout: this.onTimeoutHandler.bind(this)
		});
		hr = this.httpRequest = new HttpRequest(cfg);
	}
	if (hr.request) {
		this.setDivMessages();
		this.prepareSubmission();
		var url = hr.config.url = this.form.action;
		var method = hr.config.method = this.form.method.toLowerCase() || 'get';
		if (method == 'get') {
			hr.open(method, url + ((url.indexOf('?') > -1) ? '&' : '?') + this.parameterize()).send();
		}
		else if (method == 'post') {
            var parameters = '';
            if (isMultipart) {
                try {
                    parameters = this.parameterizeAsPostdata();
                }
                catch (ex) {
                    return this.hrConfig.useIframeIfMultipart ? this.submitThroughIframe() : true;
                }
            } else {
                parameters = this.parameterize();
            }
			// open must be called before headers can be set
			hr.open(method, url).send(parameters, false);
		}
		return false;
	}
	return true; // older browser submits the form the traditional way
}

// This is actually not XMLHttpRequest (AJAX), but merely posting to a hidden iframe. Nothing asynchronously about it.
DForm.prototype.submitThroughIframe = function(iframe) {
	this.setDivMessages();
	this.prepareSubmission();
	if (!this.targetName) {
		if (iframe) {
			this.targetName = iframe.name || iframe.id;
		} else {
			dLib.assert(!this.form.target && !this.form.getAttribute("target"), 'DForm.js: The form already has a target attribute! Please supply a reference for the associated iframe/frame as the second argument to "submitThroughIframe".');
			iframe = dLib.util.createIframe(this.config.iframeSource);
			this.targetName = iframe.name;
			// In Safari 3.1.2 (probably 3.x) - and hence Google Chrome - the onload handler of the hidden iframe is fired BEFORE these next lines of code are executed!
			this.form.setAttribute("target", iframe.name);
			this.form.target = iframe.name;
		}
		dLib.event.add(iframe, 'load', function(e, dForm) { dForm.iframeLoaded(this); }.bindAsEventListener(iframe, this));
	}
	return true;
}

DForm.prototype.iframeLoaded = function(iframe) {
	var iframeWin = iframe ? dLib.util.getIframeWindow(iframe) : null;
	if (!iframeWin || iframeWin.location.href == "about:blank" || this.form.action.indexOf(iframeWin.location.pathname) == -1) {
		return this;
	}
	this.resetPreparedSubmission();
	this.fireHandler("onIframeLoaded", [iframeWin]);
	return this;
}

DForm.prototype.scheduleResetValidation = function() {
	if (!isNaN(this.resetTimerId)) {
		clearTimeout(this.resetTimerId);
	}
	var delay = parseInt(this.config.resetDelay, 10);
	if (delay) {
		this.resetTimerId = setTimeout(this.resetValidation.bind(this), delay);
	}
	return this;
}

DForm.prototype.abort = function() {
	if (this.httpRequest && !this.httpRequest.hasCompleted) {
		this.httpRequest.abort();
		this.resetPreparedSubmission();
	}
	return this;
}

DForm.prototype.onTimeoutHandler = function() {
	this.resetPreparedSubmission();
	this.fireAjaxHandler("onTimeout");
	return this;
}

DForm.prototype.onCompleteNotOkHandler = function(e) {
	this.resetPreparedSubmission();
	var hr = this.httpRequest;
	var msg = (hr.json && hr.json.message) ? hr.json.message : DForm.formatMessage(dFormLocale.completeNotOk, ["" + hr.request.status]);
	this.showMessages(msg).scheduleResetValidation().fireAjaxHandler("onCompleteNotOk", e);
	return this;
}

DForm.prototype.onCompleteOkHandler = function(e) {
	this.resetPreparedSubmission();
	var json = this.httpRequest.json;
	if (this.passedAsyncValidation()) {
		var doRedirect = this.hrConfig.followRedirect;
		if (doRedirect && typeof json.redirect == "string") {
			location.href = json.redirect;
		}
		else if (doRedirect && typeof json.redirect == "function") {
			json.redirect.apply(this.config.scope || this, [e, json, this]);
		} else {
			if (json.version && this.form.elements['version']) {
				this.form.elements['version'].value = json.version;
			}
			var msg = json.statusMessage || DForm.formatMessage(dFormLocale.completeOk);
			this.showMessages(msg, true).scheduleResetValidation();
		}
	} else {
		this.showValidationMessages(true, json.statusMessage);
	}
	this.fireAjaxHandler("onCompleteOk", e);
	return this;
}

DForm.prototype.fireAjaxHandler = function(name, e) {
	return dLib.util.applyHandler(this.hrConfig[name], this.hrConfig.scope || this.httpRequest, [e, this.httpRequest, this]);
}

DForm.prototype.fireHandler = dLib.util.fireHandler;

DForm.prototype.passedAsyncValidation = function() {
	var json = this.httpRequest.json;
	var msgs = json.messages || json;
	if (Array.isArray(msgs) && msgs.length > 0) {
		for (var i = 0, l = msgs.length; i < l; i++) {
			var obj = msgs[i]; // an object literal with properties name, message and severity - severity must be one of the values 0, 1, 2 or 3 (info, warn, error or fatal respectively)
			if (obj.name) {
				var field = this.form.elements[obj.name] || DNode.getOwnerDocument(this.form).getElementById(obj.name) || this.form.elements[obj.name + ".id"]; // the latter is to supports Spring's many-to-one mapping
				if (field) {
					DField.getInstance(field).resolveDecorator().toBeDecorated();
					DForm.reportInvalid(field, obj.message, obj.severity);
				}
			} else {
				this.addMessage(obj);
			}
		}
		return false;
	}
	return true;
}

DForm.prototype.getFormData = function() {
    var formData = new FormData();
    this.getSubmittableFields().forEach(function(field) {
        if (field.type == "file" && field.value && field.files) {
            for (var i = 0, l = field.files.length; i < l; i++) {
                formData.append(field.name, field.files[i]);
            }
        } else {
            formData.append(field.name, DField.getValue(field, false)); // do not encode manually - is automatically done by the FormData object
        }
    });
    return formData;
}

DForm.prototype.asObjectLiteral = function(includeFileItems) {
    var formData = {};
    this.getSubmittableFields().forEach(function(field) {
        formData[field.name] = DField.getValue(field, false);
    });
    return formData;
}

// Change signed.applets.codebase_principal_support in about:config to true to get universal privileges which is required to upload files via XMLHttpRequest (Was once true, but not any longer)
DForm.prototype.parameterizeAsPostdata = function(boundary) {
    if (window.FormData) {
        return this.getFormData();
    }
	return HttpRequest.getPostDataString(this.mapSubmittableFields(false), { boundary: boundary || this.config.boundaryString });
}

DForm.prototype.getSubmittableFields = function() {
	// form.elements does not include input elements of type image, it does include fieldset elements of which we have no interest
	return q('input, button, select, textarea', this.form).filter(function(field) { return DField.isSubmittable(field); }).asArray();
}

/*	Returns a list of each submittable element in the form. Each element is represented by an object literal (map) with properties name and value.
	Except if the element is a file upload. Then the map must have properties name and files, where files is a list of File or Blob instances.
	Throws an error if no support for reading file(s) to be uploaded!	*/
DForm.prototype.mapSubmittableFields = function(encodeValue) {
	encodeValue = (typeof encodeValue == "boolean") ? encodeValue : true;
	return this.getSubmittableFields().map(function(field) {
		if (field.type == "file") {
			if (field.value) {
				if (field.files) { // Firefox 3+ and Chrome always goes here (FF 3.6: even if the multiple attribute of the INPUT element is not specified)
					var files = [];
					for (var i = 0, l = field.files.length; i < l; i++) {
						files.push(field.files[i]);
					}
					return {name: field.name, files: files};
				}
				throw new Error("DForm.js: No support for uploading files via Ajax in this browser!");
			}
			// if no file selected return null, since null-values will be discarded in HttpRequest.getPostDataString. If not discarded some frameworks - like Spring Web - will throw a class cast exception, when trying to cast to MultipartFile
			return { name: field.name, value: null };
		}
		return { name: field.name, value: DField.getValue(field, encodeValue) };
	});
}

DForm.prototype.parameterize = function() {
	var str = '';
	q('input, button, select, textarea', this.form).filter(function(field) { return (field.type != "file" && DField.isSubmittable(field)); }).forEach(function(field) {
		var value = DField.getValue(field);
		if (Array.isArray(value)) {
			value.forEach(function(v) {
				str += '&' + field.name + '=' + v;
			});
		} else {
			str += '&' + field.name + '=' + value;
		}
	});
	return str ? str.substring(1) : str;
}

DForm.prototype.eachElement = function(iterator) {
	for (var i = 0, l = this.countElements(); i < l; i++) {
		var el = this.form.elements[i];
		iterator.apply(this, [el, i]);
	}
	return this;
}

// Due to a bug in IE 8 and below an INPUT element named length overwrites the the length property of the elements HTMLCollection. Actually form.elements is identical to the form element in IE 8 and below.
DForm.prototype.countElements = function() {
	var frm = this.form;
	if (frm === frm.elements && typeof frm.elements.length == "object") { // IE8 and below goes here - this is the case if the form has an element with name length
		var input = frm.elements.length;
		input.name = "__replace__";
		var len = frm.elements.length;
		input.name = "length";
		return len;
	}
	return frm.elements.length;
}

DForm.prototype.focusInFirstField = function(ignoreFileUploads, ignoreCss) {
	if (typeof ignoreFileUploads != "boolean") {
		ignoreFileUploads = true;
	}
	for (var i = 0, l = this.countElements(); i < l; i++) {
		var field = this.form.elements[i];
		var dField = (!ignoreFileUploads || field.type != "file") ? DField.getInstance(field) : null;
		if (dField && dField.isFocusable(ignoreCss)) {
			dField.focus(true);
			break;
		}
	}
	return this;
}

DForm.prototype.addAjaxSubmitListener = function(ajaxConfig) {
	return this.addEventListener("submit", this.onSubmitAsyncListener.bindAsEventListener(this, ajaxConfig));
}

DForm.prototype.addSubmitListener = function() {
	return this.addEventListener("submit", this.onSubmitListener.bindAsEventListener(this));
}

DForm.prototype.addResetListener = function(doPrompt) {
	return this.addEventListener("reset", this.onResetListener.bindAsEventListener(this, doPrompt));
}

DForm.prototype.addCapsLockListeners = function() {
	this.eachElement(function (field) {
		if (field.type == "password" && field.name) {
			DField.getInstance(field).addCapsLockListeners();
		}
	});
	return this;
}

DForm.prototype.addTypingValidationListeners = function(eventType) {
	this.eachElement(function (field) {
		if (typeof field.type == "string" && field.type && typeof field.name == "string" && field.name) {
			switch (field.type) {
				case "password":
				case "text":
				case "textarea":
					this.addTypingValidationListener(DField.getInstance(field), eventType);
					break;
			}
		}
	});
	return this;
}

DForm.prototype.addTypingValidationListener = function(dField, eventType) {
	eventType = (typeof eventType != "string") ? "keyup" : eventType || "keyup";
	if (dField.doValidate() || dField.validateIfNotEmpty()) {
		return dField.addEventListener(eventType, this.validateWhenTyping.bindAsEventListener(this));
	}
	return null;
}

DForm.prototype.onSubmitListener = function(e) {
	try {
		var validatedOk = this.validate();
		var ok = this.fireHandler("onBeforeSubmit", [e, validatedOk]) && validatedOk;
		if (!ok && e) {
			e.preventDefault();
		}
		this.fireHandler("onAfterSubmit", [e, validatedOk]);
	}
	catch (ex) {
		if (e) {
			e.preventDefault();
		}
		throw ex;
	}
	return ok;
}

DForm.prototype.onSubmitAsyncListener = function(e, ajaxConfig) {
	try {
		var rv = this.fireHandler("onBeforeSubmit", [e]) && this.submitAsync(ajaxConfig);
		if (!rv && e) {
			e.preventDefault();
		}
		this.fireHandler("onAfterSubmit", [rv]);
	}
	catch (ex) {
		if (e) {
			e.preventDefault();
		}
		throw ex;
	}
	return rv;
}

// A function for form validation. Is used by DForm.prototype.onSubmitListener.
DForm.prototype.validate = function(showValidationMessages, prepareSubmission) {
	showValidationMessages = (typeof showValidationMessages == "boolean") ? showValidationMessages : true;
	prepareSubmission = (typeof prepareSubmission == "boolean") ? prepareSubmission : true;
	// remember to reset any previous validation messages!!
	this.resetValidation(false);
	var password, doSubmit = true, ok = true;
	var els = (typeof this.config.validateFilter == "function") ? DElementList.filter(this.form.elements, this.config.validateFilter, this) : this.form.elements;
	// can be application/x-www-form-urlencoded, multipart/form-data or multipart/x-mixed-replace (see http://en.wikipedia.org/wiki/Push_technology)
	var encType = this.form.enctype.toLowerCase();
	for (var i = 0, l = els.length; i < l; i++) {
		var el = els[i];
		var dField = DField.getInstance(el);
		if (dField) {
			if (dField.doValidate()) {
				if (dField.hasOwnValidator()) {
					ok = dField.validateByValidator();
				}
				else if (el.type == "file") {
					dLib.assert(["post", "put", "options"].contains(this.form.method) && encType.indexOf("multipart/") == 0, 'DForm.js: To upload a file the form must be of method post and have a multipart enctype! The file will not be sent!');
					ok = dField.containsValidString("");
				}
				else if (el.type == "password") {
					var cfg = dField.config;
					if (!password) {
						ok = dField.containsValidString(cfg.passwordPattern, false, cfg.minPasswordChars, cfg.maxPasswordChars);
						password = el.value;
					}
					else if	(!el.value) {
						ok = dField.containsValidString(cfg.passwordPattern, false, cfg.minPasswordChars, cfg.maxPasswordChars);
					}
					else if	(el.value != password && this.config.validatePasswordConfirmation) {
						ok = DForm.reportInvalid(el, DForm.formatMessage(dFormLocale.passwordRepeat));
					}
				} else {
					ok = dField.validate();
				}
			}
			else if (dField.validateIfNotEmpty(true)) {
				ok = dField.validate();
			}
			if (doSubmit) {
				doSubmit = ok;
			}
		}
	}
	if (showValidationMessages) {
		this.setDivMessages();
		this.showValidationMessages();
	}
	if (doSubmit) {
		if (prepareSubmission) {
			this.prepareSubmission();
		}
		this.fireHandler("onValidatedOk");
	} else {
		this.fireHandler("onValidatedNotOk");
	}
	return doSubmit;
}

/*	This method is to be called just before form submission.
	Is called by DForm.prototype.validate if validation was successful, but can also be used by itself. */
DForm.prototype.prepareSubmission = function(showProcessing) {
	if (!this.prepared) {
		if (typeof DTabSet == "function") {
			DTabSet.adjustFormAction(this.form);
		}
		var ok = true;
		if (this.clickedButton) {
			ok = DField.getInstance(this.clickedButton).notifyServer();
		} else {
			var dBtn = this.getDefaultSubmitButton();
			ok = dBtn ? dBtn.notifyServer() : ok;
		}
		/*	Enabling of buttons is necessary if the server response for some reason is slow (or not responding at all)
			(the user might press the stop button). Default delay is 5 seconds.	*/
		var delay = parseInt(this.config.resetDelay, 10);
		if (ok && delay) {
			this.disableButtons();
			if (this.config.changeCursorOnsubmit) {
				document.body.style.cursor = "progress";
			}
			showProcessing = (typeof showProcessing == "boolean") ? showProcessing : this.config.showProcessing;
			if (showProcessing) {
				this.showProcessingFormData();
			}
			this.preparedTimerId = setTimeout(this.resetPreparedSubmission.bind(this), delay);
		}
		this.prepared = true;
	}
	return true;
}

DForm.prototype.resetPreparedSubmission = function() {
	if (this.prepared && this.fireHandler("onBeforeReset")) {
		if (this.clickedButton) {
			var nextEl = DElement.nextElement(this.clickedButton);
			if (nextEl && nextEl.name && nextEl.name === this.clickedButton.name) {
				DNode.remove(DElement.nextElement(this.clickedButton));
			}
			this.clickedButton = null; // important to reset this property again in order to be able to capture the next form submission in IE
		}
		if (!isNaN(this.preparedTimerId)) {
			clearTimeout(this.preparedTimerId);
		}
		this.enableButtons();
		if (this.config.changeCursorOnsubmit) {
			document.body.style.cursor = "default";
		}
		this.resetValidation(false);
		this.prepared = false;
		this.fireHandler("onAfterReset");
	}
	return this;
}

function DField(field, config) {
	this.field = field;
	this.dForm = field.form ? DForm.getInstance(field.form) : null;
	this.decorator = null;
	this.decorClass = "";
	this.msgs = [];
	this.severities = [];
	this.severity = -1;
	var cfg = this.dForm ? Object.extendAll({}, this.dForm.config.fieldConfig, config) : config;
	DField.superConstructor.apply(this, [this.field, cfg]);
	this.configured = !!config;
}

DField.inheritFrom(DElement);

DField.defaultConfig = Object.configure({ // see DForm.defaultConfig.fieldConfig
	validator: null, // a function for custom validation, must return either DForm.reportInvalid or DForm.reportOk, will be passed the field and a possible event object (if using typing validation)
	// classes used for the decorator for each field
	decoratorClass: "decorator",
	requiredClass: "required",
	errorClass: "error",
	fatalClass: "fatal",
	infoClass: "info",
	warnClass: "warning",
	validClass: "valid",
	errorLinkClass: "error-message",
	fatalLinkClass: "fatal-message",
	infoLinkClass: "info-message",
	warnLinkClass: "warning-message"
}, DElement.defaultConfig);

DField.getInstance = function(field, config) {
	var id = "";
	if (typeof field == "string") {
		id = field;
		field = document.getElementById(id);
	} else {
		id = DElement.getId(field);
	}
	var dForm = field.form ? DForm.getInstance(field.form) : null;
	var instance = dForm ? dForm.dFields[id] : null;
	if (!instance) {
		var tName = field.tagName.toLowerCase();
		var key = tName + "_" + field.type;
		var map = dLib.domMappings;
		if (!(key in map)) {
			key = tName;
		}
		if (key in map) {
			instance = new window[map[key]](field, config);
			if (dForm) {
				dForm.dFields[id] = instance;
			}
		} else {
			instance = new DField(field);
		}
	}
	else if (config && !instance.configured) {
		Object.extend(instance.config, instance.dForm.config.fieldConfig, config);
		instance.configured = true;
	}
	if (instance.field !== field) { // this can be the case if referring to the DOM in another window (like an iframe)
		instance.field = field;
	}
	return instance;
}

DField.getValue = function(field, encode) {
	encode = (typeof encode == "boolean") ? encode : true;
	var value;
	switch (field.type) {
		case 'select-one':
			if (field.selectedIndex > -1) {
				value = field.options[field.selectedIndex].value;
			}
			break;
		case 'select-multiple': // if the selected option doesn't have a value attribute, the browser sets the value to the label value
			if (field.selectedIndex > -1) {
				value = [];
				for (var i = 0, l = field.options.length; i < l; i++) {
					var opt = field.options[i];
					if (opt.selected) {
						value.push(encodeURIComponent(opt.value || ''));
					}
				}
			}
			break;
		case 'checkbox':
		case 'radio':
			if (field.checked) {
				value = (typeof field.value == "string") ? field.value : "on"; // the empty string is a valid value - on is only used if no value attribute is present
			}
			break;
		case 'submit':
		case 'image':
			value = field.getAttribute("ievalue") || field.value;
			break;
        case 'file':
            if (field.value && field.files) {
                value = field.files;
            } else {
                value = field.value;
            }
            break;
        case 'number':
            value = (parseInt(field.step, 10) % 1 == 0) ? parseInt(field.value, 10) : parseFloat(field.value);
            break;
        case 'textarea':
		case 'text':
		case 'password':
		case 'hidden':
		case 'email':
		case 'tel':
		case 'color':
		case 'search':
		case 'url':
		case 'range':
		case 'date':
		case 'datetime':
		case 'datetime-local':
		case 'time':
		case 'month':
		case 'week':
			value = field.value;
			break;
	}
	return (encode && value && !Array.isArray(value)) ? encodeURIComponent(value) : value;
}

DField.isSubmittable = function(field) {
	if (!field.name || field.disabled) {
		return false;
	}
	switch (field.type) {
		case 'textarea':
		case 'text':
		case 'password':
		case 'hidden':
		case 'email':
		case 'tel':
		case 'color':
		case 'search':
		case 'url':
		case 'range':
		case 'number':
		case 'date':
		case 'datetime':
		case 'datetime-local':
		case 'time':
		case 'month':
		case 'week':
			return true;
		case 'file':
			return (field.form.enctype.toLowerCase().indexOf('multipart/') == 0);
		case 'select-one':
		case 'select-multiple': // also has a selectedIndex property even though several options might be selected - refers to the first selected option
			return (field.selectedIndex > -1);
		case 'checkbox':
		case 'radio':
			return field.checked;
		case 'submit':
		case 'image':
			var dForm = field.form ? DForm.getInstance(field.form) : null;
			return (dForm && field === dForm.clickedButton);
	}
	return false;
}

DField.isFocusable = function(field, ignoreCss) {
	// on a fieldset element the type attribute is undefined
	var isFocusable = (!!field && typeof field.type == "string" && field.type != "hidden" && (typeof field.readOnly != "boolean" || !field.readOnly) && (typeof field.disabled != "boolean" || !field.disabled) && !!field.focus);
	if (isFocusable && !ignoreCss) {
		var n = field, d = "", v = "";
		var cStyle = DElement.getComputedStyle(n);
		while (n && cStyle) {
			v = cStyle.visibility;
			d = cStyle.display;
			if (v == 'inherit' || d == 'inherit') { // IE may go here - to loop through parent nodes and query their computed style can be quite expensive in performance!
				n = n.parentNode;
				if (n && n != document) {
					cStyle = DElement.getComputedStyle(n);
				}
			} else {
				break;
			}
		}
		isFocusable = !(d == 'none' || v == 'hidden');
	}
	return isFocusable;
}

DField.createTrafficLightValidator = function(partialRegExp, exactRegExp, warnMessage, errorMessage, allowEmpty) {
	return function(field, e) {
		if (field.value || !allowEmpty || (this instanceof DField && this.isRequired())) {
			var exact = exactRegExp.exec(field.value);
			if (!exact) {
				if (e) { // if e is undefined we're dealing with the submit listener and validating partially does not make sense
					var partial = partialRegExp.exec(field.value);
					if (partial) {
						return DForm.reportInvalid(this, warnMessage, DForm.SEVERITY_WARN);
					}
				}
				return DForm.reportInvalid(this, errorMessage, DForm.SEVERITY_ERROR);
			}
		}
		return DForm.reportOk(field);
	}
}

DField.getDisplayName = function(field) {
	if (field.alt) {
		return field.alt;
	}
	if (field.id) {
		var labels = q("label", field.form).elements;
		for (var i = 0, l = labels.length; i < l; i++) {
			var label = labels[i];
			if ((typeof label.htmlFor == "string" && field.id == label.htmlFor) || (label.getAttribute && field.id == label.getAttribute("for"))) {
				return label.innerHTML.replace(/<[^<>]{1,}>/gi, "");
			}
		}
	}
	return field.name;
}

DField.prototype.fireHandler = dLib.util.fireHandler;

DField.prototype.getValue = function(encode) {
	return DField.getValue(this.field, encode);
}

DField.prototype.getDisplayName = function() {
	return DField.getDisplayName(this.field);
}

DField.prototype.isFocusable = function(ignoreCss) {
	ignoreCss = (typeof ignoreCss == "boolean") ? ignoreCss : this.config.focusIgnoreCss;
	return DField.isFocusable(this.field, ignoreCss);
}

DField.prototype.isSubmittable = function() {
	return DField.isSubmittable(this.field);
}

DField.prototype.focus = function(ignoreCapability) { // specify true if you've already called isFocusable to increase performance
	if (ignoreCapability || this.isFocusable()) {
		if (typeof DTabSet == "function") {
			DTabSet.changePossibleTab(this.field);
		}
		try {
			this.field.focus();
		}
		catch (err) {
			// do nothing
		}
	}
	return this;
}

DField.prototype.hasOwnValidator = function() {
	return (typeof this.config.validator == "function");
}

DField.prototype.doValidate = function() {
	var validate = false;
	if (this.field.name) {
		this.resolveDecorator();
		var decorClass = this.decorClass;
		if (decorClass) {
			if (this.hasOwnValidator()) {
				validate = true;
			} else {
				var cfg = this.config;
				validate = [cfg.requiredClass, cfg.infoClass, cfg.warnClass, cfg.errorClass, cfg.fatalClass, cfg.validClass].some(function(clazz) {
					return decorClass.indexOf(clazz) > -1;
				});
			}
		}
		if (validate) {
			this.toBeDecorated();
		}
	}
	return validate;
}

DField.prototype.validateIfNotEmpty = function(testForEmptyValue) {
	return false;
}

DField.prototype.validateByValidator = function(e) {
	var ok = (typeof this.config.validator == "function") ? this.config.validator.apply(this, [this.field, e]) : true;
	dLib.assertType(ok, "boolean", "DField.validateByValidator in DForm.js: The specified function must return a boolean! It should call DForm.reportInvalid on failure and DForm.reportOk on success.");
	return ok;
}

DField.prototype.validate = function() { // override when subclassing
	return true;
}

DField.prototype.resolveDecorator = function() {
	if (!this.decorator) {
		var decor = this.getDecorator();
		this.decorator = decor ? g(decor) : null;
		this.decorClass = this.getCleanDecoratorClass();
	}
	return this;
}

DField.prototype.getDecorator = function() {
	var cfg = this.config;
	function isDecorator(node) {
		if (node) {
			var cName = node.className;
			if (cName) {
				return [cfg.requiredClass, cfg.decoratorClass, cfg.infoClass, cfg.warnClass, cfg.errorClass, cfg.fatalClass, cfg.validClass].some(function(entry) {
					return (cName.indexOf(entry) > -1);
				});
			}
		}
		return false;
	};
	var field = this.field;
	if (isDecorator(field)) {
		return field;
	}
	var pNode = field.parentNode;
	while (pNode) {
		if (isDecorator(pNode)) {
			return pNode;
		}
		pNode = pNode.parentNode;
	}
	if (field.id) {
		var labels = q("label", field.form).elements;
		for (var i = 0, l = labels.length; i < l; i++ ) {
			var label = labels[i];
			if (label.htmlFor == field.id) {
				return label;
			}
		}
	}
	return null;
}

DField.prototype.isRequired = function() {
	var requiredClass = this.config.requiredClass;
	if (requiredClass) {
		return (this.hasClass(requiredClass) || (this.decorator instanceof DElement && this.decorator.hasClass(requiredClass)));
	}
	return false;
}

DField.prototype.markInvalid = function(msg, severity) {
	this.msgs.push(msg || dFormLocale.inputInvalid);
	severity = parseInt(severity, 10);
	if (isNaN(severity) || severity < DForm.SEVERITY_INFO || severity > DForm.SEVERITY_FATAL) {
		severity = DForm.SEVERITY_ERROR;
	}
	this.severities.push(severity);
	if (severity > this.severity) {
		this.severity = severity;
	}
	return this;
}

DField.prototype.getCleanDecoratorClass = function() {
	var cleanClass = this.decorator ? this.decorator.getClass() : "";
	if (cleanClass) {
		if (!this.origRegExp) {
			var cfg = this.config;
			this.origRegExp = new RegExp([cfg.fatalClass, cfg.errorClass, cfg.warnClass, cfg.infoClass, cfg.validClass].join("|"), "g");
		}
		cleanClass = cleanClass.replace(this.origRegExp, "").trim();
	}
	return cleanClass;
}

DField.prototype.toBeDecorated = function() {
	if (this.dForm) {
		var has = this.dForm.decoratedFields.some(function(entry) {
			return this.field.name === entry.field.name;
		}, this); // make sure not to add control groups (radio buttons and checkboxes) more than once
		if (!has) {
			this.dForm.decoratedFields.push(this);
		}
	}
	return this;
}

DField.prototype.decorate = function() {
	// seems like some browsers automatically trims the class attribute - but not IE!
	var d = this.decorator;
	if (d) {
		var cfg = this.config;
		[cfg.fatalClass, cfg.errorClass, cfg.warnClass, cfg.infoClass, cfg.validClass].forEach(function(entry) {
			d.replaceClass(entry, "");
		});
		var hasMessages = (this.msgs.length > 0);
		var c = hasMessages ? this.getInvalidClass() : cfg.validClass;
		d.addClass(c);
		if (hasMessages) {
			d.setAttribute("title", this.msgs.join(' - '));
			if (cfg.nestedClass) {
				this.addClass(cfg.nestedClass);
			}
			if (this.fireHandler("onBeforeShowMessage", [this.msgs])) {
				if (cfg.msgClass) {
					if (this.msgEl === undefined) {
						this.msgEl = q("." + cfg.msgClass, d.element).item(0); // item returns null if no elements found
					}
					if (this.msgEl) {
						var htm, len = this.msgs.length;
						if (len > 1) {
							htm = '<ul class="' + this.getInvalidClass() + '">';
							for (var i = 0; i < len; i++) {
								htm += '<li class="' + this.getInvalidLinkClass(i) + '">' + this.msgs[i] + '<\/li>';
							}
							htm += '<\/ul>';
						} else {
							htm = this.msgs[0];
						}
						this.msgEl.innerHTML = htm;
						var css = { 'visibility': 'visible' };
						if (this.msgEl.tagName.toLowerCase() == "div") {
							var cStyle = DElement.getComputedStyle(this.msgEl);
							if (cStyle && cStyle.display == 'none') {
								css.display = 'block';
							}
						}
						DElement.css(this.msgEl, css);
					}
				}
			}
			this.fireHandler("onAfterShowMessage", [this.msgs]);
		}
	}
	return this;
}

DField.prototype.resetDecoration = function() {
	var d = this.decorator;
	if (d) {
		d.setClass(this.decorClass).removeAttribute("title"); // removeAttribute won't work  in IE (displays 'null' when hovering)
		if (this.msgs.length > 0) {
			if (this.config.nestedClass) {
				this.removeClass(this.config.nestedClass);
			}
			if (this.fireHandler("onBeforeHideMessage")) {
				if (this.msgEl) {
					this.msgEl.innerHTML = "";
					DElement.css(this.msgEl, {
						'display': 'none',
						'visibility': 'hidden'
					})
				}
			}
			this.fireHandler("onAfterHideMessage");
		}
	}
	this.severity = -1;
	this.severities = [];
	this.msgs = [];
	return this;
}

DField.prototype.getInvalidClass = function(index) {
	var cfg = this.config;
	index = parseInt(index, 10);
	var severity = (index > -1) ? this.severities[index] : this.severity;
	switch (severity) {
		case DForm.SEVERITY_FATAL:
			return cfg.fatalClass;
		case DForm.SEVERITY_WARN:
			return cfg.warnClass;
		case DForm.SEVERITY_INFO:
			return cfg.infoClass;
	}
	return cfg.errorClass;
}

DField.prototype.getInvalidLinkClass = function(index) {
	var i = parseInt(index, 10);
	var severity = (i > -1) ? this.severities[i] : this.severity;
	var cfg = this.config;
	switch (severity) {
		case DForm.SEVERITY_FATAL:
			return cfg.fatalLinkClass;
		case DForm.SEVERITY_WARN:
			return cfg.warnLinkClass;
		case DForm.SEVERITY_INFO:
			return cfg.infoLinkClass;
	}
	return cfg.errorLinkClass;
}

function DTextInput(txtInput, config) {
	DTextInput.superConstructor.apply(this, [txtInput, config]);
	this.configured = !!config;
}

DTextInput.inheritFrom(DField);

DTextInput.defaultConfig = Object.configure({
	emailPattern: "^[a-zA-Z&0-9]{1,}([+-_\\.]{1}[a-zA-Z&0-9]{1,}){0,}@[a-zA-Z0-9]{1,}(([-_\\.]{1}[a-zA-Z0-9]{1,}){1,})$",	// TODO: refactor
	capsLockClass: "caps-locked",
	// TODO: maybe do this a bit more elegantly
	mailStr: "mail", // if an INPUT element contains this string in either it's name or className it is assumed to hold an email address and is validated accordingly
	dateStr: "date", // if an INPUT element contains this string in either it's name or className it is assumed to hold a date and is validated accordingly - see datePattern
	timeStr: "time", // if an INPUT element contains this string in either it's name or className it is assumed to hold a time value and is validated accordingly - see timePattern
	numberStr: "digit", // if an INPUT element contains this string in either it's name or className it is assumed to hold numbers only and is validated accordingly - see numberPattern
/*	The following patterns are some commonly used patterns for input fields. */

	numberPattern: "[^\\d]",

	passwordPattern: "[^a-zA-Z0-9-_]",
	minPasswordChars: 4,
	maxPasswordChars: 16,

	domainLength: 16,

/*	A pattern to validate a date-string against.	*/
	datePattern: "d-M-yy",

/*	A pattern to validate a time-string against.	*/
	timePattern: "H:m"
}, DField.defaultConfig);

DTextInput.detectCapsLock = function(e) {
	var dKeyEvent = g(e);
	return DField.getInstance(DEvent.getTarget(e)).detectCapsLock(dKeyEvent);
}

DTextInput.prototype.addCapsLockListeners = function() {
	var onkeydown = this.field.getAttribute("onkeydown");
	if (typeof onkeydown == "function") {
		onkeydown = onkeydown.toString(); // IE goes here
	}
	if (typeof onkeydown == "string" && onkeydown.indexOf(".detectCapsLock(event)") > -1) { // do not add if present in HTML attribute
		return this;
	}
	this.addEventListener("keydown", this.detectCapsLock.bindAsEventListener(this));
	this.addEventListener("keypress", this.detectCapsLock.bindAsEventListener(this));
	return this;
}

/*	DTextInput.containsValidXxx methods:
	Arguments must be of type object, string/(function/object), boolean, integer, integer
	The second argument must be a regular expression or a string.
	Note that a regular expression is of type function in Netscape (4 & 6), but is of type
	object in Internet Explorer and Opera.
	If the second argument is a string a regular expression is created based on the string.
	The third argument is a boolean (default is false) indicating whether or not the regular
	expression should match	the value of the field. In other words if the third argument is
	false the characters/pattern specified in the regular expression must not be found in the value
	of the field.
*/
DTextInput.prototype.containsValidString = function(target, doMatch, minLength, maxLength) {
	target = target || "";
	if (typeof doMatch != "boolean") {
		doMatch = false;
	}
	var txt = this.field.value;
	var fieldType = "field";
	minLength = parseInt(minLength, 10);
	if (!isNaN(minLength) && minLength > 0 && txt.length < minLength) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale[fieldType + "MinNoOfChars"], [minLength, this.getDisplayName()]));
	}
	maxLength = parseInt(maxLength, 10);
	if (!isNaN(maxLength) && maxLength > 0 && txt.length > maxLength) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale[fieldType + "MaxNoOfChars"], [maxLength, this.getDisplayName()]));
	}
	var regExp, found;
	if (typeof target == "string") {
		var pattern = target;
		if (pattern == "") {
			if (txt == pattern) {
				return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.notFilled, this.getDisplayName()));
			}
		} else {
			regExp = new RegExp(pattern);
		}
	}
	else if (target && target.constructor == RegExp) {
		regExp = target;
	}
	if (regExp) {
		found = regExp.exec(txt);
		if (doMatch) {
			if (!found) {
				return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.fieldInvalid, this.getDisplayName()));
			}
		} else {
			if (found) {
				if (found[0].length == 1) {
					if (found.index == 0) {
						return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.charNotAllowedAsFirst, [found[0], this.getDisplayName()]));
					}
					else if (found.index == txt.length - 1) {
						return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.charNotAllowedAsLast, [found[0], this.getDisplayName()]));
					}
					return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.charNotAllowedAsNth, [found[0], found.index + 1, this.getDisplayName()]));
				}
				return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale[fieldType + "StringNotAllowed"], [found[0]]));
			}
		}
	}
	return DForm.reportOk(this.field);
}

DTextInput.prototype.containsValidDate = function(pattern) {
	pattern = pattern || this.config.datePattern;
	pattern = Array.isArray(pattern) ? pattern : [pattern];
	var date;
	for (var i = 0, l = pattern.length; i < l; i++) {
		var p = pattern[i];
		date = Date.parseDate(this.field.value, p);
		if (date) {
			break;
		}
	}
	if (!date) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.dateInvalid, this.getDisplayName()));
	}
	return DForm.reportOk(this.field);
}

/*	Validation of an email address	*/
DTextInput.prototype.containsValidEmailAddress = function() {
	var email = this.field.value.toLowerCase();
	if (email.length > 256) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailTooLong));
	}
/*	Impossible to combine several allowed dots/hyphenations/underscores before the last mandatory dot.
	So the last mandatory dot is checked separately. */
	var regExp = new RegExp(this.config.emailPattern, "i");
	var found = regExp.exec(email);
	if (found == null) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailInvalid));
	}
	// check the last mandatory dot in the domain part of the email
	regExp = new RegExp("((@|[-_\\.]{1})[a-z0-9]{1,}\\.[a-z]{2," + this.config.domainLength + "})$", "i");
	found = regExp.exec(email);
	if (found == null) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailInvalid));
	}
	return DForm.reportOk(this.field);
}

/*	Specific validation of an email address	*/
DTextInput.prototype.containsValidEmail = function() {
	var email = this.field.value.toLowerCase();
	if (email == "") {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailNotFilled));
	}
	if (email.length < 6) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailTooShort));
	}
	if (email.length > 256) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailTooLong));
	}
	var atArray = email.split("@");
	if (atArray.length == 1) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailNoAt));
	}
	if (atArray.length > 2) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailMoreThanOneAt));
	}
	// check for no successive special and otherwise allowed characters
	var regExp = new RegExp("[_\\.@-]{2}","i");
	var found = regExp.exec(email);
	if (found) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailInvalidSequence, [found[0]]));
	}
	// check the first character
	regExp = new RegExp("^[^a-z0-9]","i");
	found = regExp.exec(email);
	if (found) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailInvalidStart, [found[0]]));
	}
	var firstname = atArray[0], lastname = atArray[1];
	/* check "firstname" in mail address */
	regExp = new RegExp("[^a-z&0-9-_+\\.]","i");
	found = regExp.exec(firstname);
	if (found) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailInvalidBeforeAt, [found[0]]));
	}
	/* check "lastname" (domain) in mail address */
	var domArray = lastname.split(".");
	if (domArray.length == 1) {
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailNoDotAfterAt));
	}
	var minLength = 2, maxLength = this.config.domainLength;
	regExp = new RegExp("[^a-z0-9-_]", "i");
	var regEx = new RegExp("[^a-z0-9]", "i");
	for (var i = 0, l = domArray.length; i < l; i++) {
		var str = domArray[i];
		if (i < domArray.length - 1) {
			found = regExp.exec(str);
			if (found) {
				return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailInvalidAfterAt, [found[0]]));
			}
		} else { // check top-level domain
			found = regEx.exec(str);
			if (found) {
				return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailInvalidLastPart, [found[0]]));
			}
			if (str.length < minLength) {
				return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailMinNoOfCharsInLastPartOfDomain, ["" + minLength]));
			}
			if (str.length > maxLength) {
				return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.emailMaxNoOfCharsInLastPartOfDomain, ["" + maxLength]));
			}
		}
	}
	return DForm.reportOk(this.field);
}

DTextInput.prototype.validateIfNotEmpty = function(testForEmptyValue) {
	function test(n) {
		if (!n) {
			return false;
		}
		n = n.toLowerCase();
		return (name.indexOf(n) > -1 || clazz.indexOf(n) > -1);
	}
	var name = this.field.name.toLowerCase();
	var clazz = this.field.className.toLowerCase();
	var cfg = this.config;
	var rv = test(cfg.mailStr) || test(cfg.dateStr) || test(cfg.timeStr) || test(cfg.numberStr) || this.field.type == "password";
	if (testForEmptyValue) {
		rv = !!(rv && this.field.value);
	}
	if (rv) {
		this.toBeDecorated();
	}
	return rv;
}

DTextInput.prototype.validate = function() {
	function test(n) {
		n = (n || "").toLowerCase();
		return (name.indexOf(n) > -1 || clazz.indexOf(n) > -1);
	}
	var cfg = this.config;
	if (this.field.type == "password") {
		return this.containsValidString(cfg.passwordPattern, false, cfg.minPasswordChars, cfg.maxPasswordChars);
	}
	var name = this.field.name.toLowerCase();
	var clazz = this.field.className.toLowerCase();
	if (test(cfg.mailStr)) {
		return this.containsValidEmail();
	}
	if (test(cfg.dateStr)) {
		return this.containsValidDate();
	}
	if (test(cfg.timeStr)) {
		return this.containsValidDate(cfg.timePattern);
	}
	if (test(cfg.numberStr)) {
		return this.containsValidString(cfg.numberPattern, false, 1);
	}
	return this.containsValidString("");
}

/**	Note that pressing Caps Lock on Mac does not necessarily fire any kind of key event and
	that Caps Lock detection is built-in for password fields in Safari on Mac and Windows (but not in version 3.0.x, hmm).
	In other Mac browsers like Shiira and OmniWeb Caps Lock detection is also built-in.
	Since key codes differs in keydown and keypress (in most browsers), you should invoke this
	method on both keydown and keypress! Like this:
	onkeydown="return DTextInput.detectCapsLock(event);" onkeypress="return DTextInput.detectCapsLock(event);"
	Or call addCapsLockListeners when the DOM is ready to do it the unobtrusive way.
	NOTE:
	- Pressing CAPS LOCK in Konqueror 4.1.2 seems to be 2 keystrokes (both onkeydown and onkeypress are fired twice)!?
	- Konqueror 3.5.9 does not support background images for INPUT elements
	- In most browsers holding SHIFT down, when CAPS LOCK is on, reverses the case of the letter you type.
	  The logic in this method relies on this, but in some browsers SHIFT does NOT reverse CAPS LOCK, which causes this logic to fail.	*/
DTextInput.prototype.detectCapsLock = function(e) {
	if (dLib.ua.isLikeSafari4 && this.field.type == "password" && dLib.ua.isMac) {
		return true;
	}
	var dKeyEvent = (e instanceof DKeyEvent) ? e : g(e);
	e = dKeyEvent.event;
	function onKeydown(dEl) {
		if (dKeyEvent.isCapsLockKey()) {
			locked = !locked; // should not necessarily be reversed - is the case if CAPS LOCK is changed when focus is not in field, then set focus in this field and press CAPS LOCK!
		}
		var found = /[a-z]/i.exec(String.fromCharCode(key)); // special letters like æ, ø, å and ü will never match onkeydown
		dEl.isChar = !!found;
	}
	function onKeypress(dEl) {
		if (dEl.isChar) {
			// this check has already been done on keydown, but is necessary to do again on keypress due to keycodes for numpads
			var found = /[a-z]/i.exec(String.fromCharCode(key));
			if (found) {
				var ch = String.fromCharCode(key);
				var shift = dKeyEvent.isShiftDown();
				locked = ((ch == ch.toUpperCase() && !shift) || (ch == ch.toLowerCase() && shift));
			}
		}
	}
	var locked = (typeof this.capsLocked == "boolean") ? this.capsLocked : false;
	var key = dKeyEvent.getKeyCode();
	switch (e.type) {
		case "keydown":
			onKeydown(this);
			break;
		case "keypress":
			onKeypress(this);
			break;
	}
	if (locked) {
		this.addClass(this.config.capsLockClass);
	} else {
		this.removeClass(this.config.capsLockClass);
	}
	this.capsLocked = locked;
	return true;
}

function DButton(button, config) {
	this.button = button;
	DButton.superConstructor.apply(this, [this.button, config]);
	this.configured = !!config;
}

DButton.inheritFrom(DField);

DButton.defaultConfig = Object.configure({
}, DField.defaultConfig);

/*	By passing the name and the value of the pressed button, the server will think the button was clicked.
	Should only be called indirectly by calling DForm.prepareSubmission.
	Returns true to indicate that a parameter with the name of the field was successfully added to the forms action URL.
	Otherwise the buttons shouldn't be disabled.
	There are two reasons for this functionality. First of all it's a workaround for bugs in IE6+7+8b2 with respect to BUTTON tags:
	IE6:
	- if a button tag has a name attribute it's value is passed to the server no matter which button was pressed to submit the form.
	IE6+7:
	 - the value will be the innerHTML of the button, not the value of the value attribute.
	IE6+7+8b2:
	 - a possible name attribute of the default submit button, won't be submitted, when pressing ENTER in a INPUT element, as it should. NOTE: This is fixed in IE8RC1

	This method solves these issues. Secondly it prevents the user from submitting the form twice (or more), if server response time is slow.	*/
DButton.prototype.notifyServer = function() {
	var n = this.button.name;
	if (n && this.button.form) {
		// In IE6+7 the value attribute is always equal to the innerHTML property, which is useless!
		var value = this.button.getAttribute('ievalue') || this.button.value;
		// do not create the hidden field twice
		var hiddenField = q('input[type="hidden"][name="' + n + '"]', this.button.form).item(0) || DElement.create("input", {"type": "hidden"});
		hiddenField.name = n;
		hiddenField.value = value;
		this.insertAfter(hiddenField);
	}
	return true;
}

DButton.prototype.disable = function() {
	this.button.disabled = true;
	return this;
}

DButton.prototype.enable = function() {
	this.button.disabled = false;
	return this;
}

DButton.prototype.click = function() {
    this.button.click();
    return this;
}

function DInput(input, config) {
	this.input = input;
	DInput.superConstructor.apply(this, [this.input, config]);
	this.configured = !!config; // this is important!! if not set after applying super constructor, the concept of DField.getInstance breaks!
}

DInput.inheritFrom(DTextInput);

DInput.defaultConfig = Object.configure({}, DTextInput.defaultConfig);

function DSelect(select, config) {
	this.select = select;
	DSelect.superConstructor.apply(this, [this.select, config]);
	this.configured = !!config;
}

DSelect.inheritFrom(DField);

DSelect.defaultConfig = Object.configure({}, DField.defaultConfig);

DSelect.prototype.validate = function(minSelection, maxSelection) {
	minSelection = parseInt(minSelection, 10);
	if (isNaN(minSelection)) {
		minSelection = 1;
	}
	maxSelection = parseInt(maxSelection, 10);
	dLib.assert(!((minSelection > 1 || maxSelection > 1) && this.select.type.indexOf('multiple') == -1), 'DForm.js: The user cannot choose more than one option in ' + this.select.name + '! You must add the multiple attribute to the select tag.');
	dLib.assert(maxSelection <= this.select.options.length, 'DForm.js: The user cannot choose ' + maxSelection + ' options! There is only ' + this.select.options.length + ' options in the select tag: ' + this.select.name);
	dLib.assert(minSelection <= maxSelection, 'DForm.js: The minimum selected number of options (' + minSelection + ') must be less than or equal to the maximum selected number of options (' + maxSelection + ') in the select tag: ' + this.select.name);
	var count = 0, ok = false;
	// if the value attribute of the selected option is the empty string, it is considered invalid
	for (var i = 0, l = this.select.options.length; i < l; i++) {
		var opt = this.select.options[i];
		if (opt.selected && opt.value) {
			count++;
		}
		if (count >= minSelection) {
			ok = true;
			if (isNaN(maxSelection)) {
				break;
			}
		}
		if (!isNaN(maxSelection) && count > maxSelection) {
			return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.selMaxSelected, [maxSelection, this.getDisplayName()]));
		}
	}
	if (!ok) {
		if (minSelection == 1) {
			return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.selNotChosen, this.getDisplayName()));
		}
		return DForm.reportInvalid(this.field, DForm.formatMessage(dFormLocale.selMinSelected, [minSelection, this.getDisplayName()]));
	}
	return DForm.reportOk();
}

function DTextArea(textarea, config) {
	this.textarea = textarea;
	DTextArea.superConstructor.apply(this, [this.textarea, config]);
	this.configured = !!config;
}

DTextArea.inheritFrom(DTextInput);

DTextArea.defaultConfig = Object.configure({}, DTextInput.defaultConfig);

DTextArea.checkMaxLength = function(e, maxLength) {
	var dKeyEvent = g(e);
	return DField.getInstance(DEvent.getTarget(e)).checkMaxLength(dKeyEvent, maxLength);
}

DTextArea.prototype.addMaxLengthListener = function(maxLength) {
	return this.on("keydown keypress", this.checkMaxLength.bindAsEventListener(this, maxLength));
}

/*	There is no maxlength attribute on a textarea tag, so you can use this method as an onkeydown/onkeypress handler instead.
	Returning false won't prevent typing of the key in Opera onkeydown. It will onkeypress, but onkeypress some of the lowercase
	letters collides with the function keys, so we have to use both:
	<textarea ... onkeydown="return DTextArea.checkMaxLength(event, 5);" onkeypress="return DTextArea.checkMaxLength(event, 5);" ...>	*/
DTextArea.prototype.checkMaxLength = function(dKeyEvent, maxLength) {
	if (dKeyEvent.event.type == "keydown") {
		this.isPrintableKey = dKeyEvent.isPrintableKey();
		return true;
	}
	maxLength = parseInt(maxLength, 10);
	var ok = true;
	if (maxLength > 0) {
		if (this.isPrintableKey) {
			ok = (this.textarea.value.length < maxLength);
		} else {
			if (this.textarea.value.length >= maxLength) {
				ok = (dKeyEvent.getKeyCode() != 13); // ENTER
			}
		}
	}
	if (!ok) {
		dKeyEvent.preventDefault();
	}
	delete this.isPrintableKey;
	return ok;
}

function DChoiceGroup(field, config) {
	DChoiceGroup.superConstructor.apply(this, [field, config]);
	/*	If there is only one choice the length property is not defined and then field is equal to
		field.form[field.name] (group), where field refers to an INPUT tag of type 'checkbox' or 'radio'.	*/
	this.group = this.field.form[this.field.name];
	this.configured = !!config;
}

DChoiceGroup.inheritFrom(DField);

DChoiceGroup.defaultConfig = Object.configure({}, DField.defaultConfig);

DChoiceGroup.validatedGroups = {};

DChoiceGroup.resetValidation = function() {
	DChoiceGroup.validatedGroups = {};
}

DChoiceGroup.prototype.validate = function(minSelection, maxSelection) {
	// do not validate the same group more than once
	var n = this.field.name;
	if (n in DChoiceGroup.validatedGroups) {
		return true;
	}
	DChoiceGroup.validatedGroups[n] = true;
	return this.isChecked(minSelection, maxSelection);
}

// class for radio button group
function DRadio(radio, config) {
	this.radio = radio;
	DRadio.superConstructor.apply(this, [this.radio, config]);
	this.configured = !!config;
}

DRadio.inheritFrom(DChoiceGroup);

DRadio.defaultConfig = Object.configure({}, DChoiceGroup.defaultConfig);

DRadio.prototype.isChecked = function() {
	// if there is only one choice the length property is not defined - and then one should use a checkbox instead.
	if (!this.group || typeof this.group.length != "number") {
		return true;
	}
	for (var i = 0; i < this.group.length; i++) {
		if (this.group[i].checked) {
			return DForm.reportOk();
		}
	}
	return DForm.reportInvalid(this.group[0], DForm.formatMessage(dFormLocale.radioNotChecked, DField.getDisplayName(this.group[0])));
}

// class for handling a checkbox group
function DCheckBox(checkbox, config) {
	this.checkbox = checkbox;
	DCheckBox.superConstructor.apply(this, [this.checkbox, config]);
	this.configured = !!config;
}

DCheckBox.inheritFrom(DChoiceGroup);

DCheckBox.defaultConfig = Object.configure({
	minSelection: 1,
	maxSelection: NaN
}, DChoiceGroup.defaultConfig);

DCheckBox.checkAll = function(e, chboxGroup, checkedOrCheckbox) { // TODO: change to instance method
	var checked = true;
	if (typeof checkedOrCheckbox == "boolean") {
		checked = checkedOrCheckbox;
	}
	else if (checkedOrCheckbox && typeof checkedOrCheckbox == "object" && typeof checkedOrCheckbox.checked == "boolean") {
		checked = checkedOrCheckbox.checked;
	}
	if (typeof chboxGroup.length == "number") {
		for (var i = 0, l = chboxGroup.length; i < l; i++) {
			var chb = chboxGroup[i];
			chb.checked = checked;
//TODO: resolve
			/*if (chb.onclick && g(e)) {
				chb.onclick();
			}*/
		}
	} else {
		chboxGroup.checked = checked;
	}
}

// parent checkbox to be synchronized must be a single INPUT element - i.e. length is undefined and checked is a boolean
DCheckBox.synchronizeParent = function(e, chbox, chboxToSync) { // TODO: change to instance method
	chboxToSync = (chboxToSync instanceof DField) ? chboxToSync.field : chboxToSync;
	if (chbox && typeof chbox.checked == "boolean" && chboxToSync && typeof chboxToSync.checked == "boolean") {
		if (chbox.checked) {
			var chboxGroup = chbox.form[chbox.name];
			if (chboxGroup) { // if inserted by script IE7 fails to update the DOM and chboxGroup will be undefined - to use document.getElementsByName won't work either
				for (var i = 0, l = chboxGroup.length; i < l; i++) {
					if (!chboxGroup[i].checked) {
						return;
					}
				}
			}
		}
		chboxToSync.checked = chbox.checked;
// TODO: finish
		/*if (chboxToSync.onclick && g(e)) {// && e.getTarget() != chbox) {
			chboxToSync.onclick();
		}*/
	}
}

DCheckBox.prototype.isChecked = function(minSelection, maxSelection) {
	if (!this.group || typeof this.group.length != "number") {
		return true; // if there is only one option it doesn't make much sense to make a checkbox mandatory
	}
	minSelection = parseInt(minSelection, 10) || this.config.minSelection;
	maxSelection = parseInt(maxSelection, 10) || this.config.maxSelection;
	dLib.assert(maxSelection <= this.group.length, 'The user cannot choose ' + maxSelection + ' choices!\nThere is only ' + this.group.length + ' choices in the checkbox group:\n' + this.group[0].name);
	dLib.assert(minSelection <= maxSelection, 'DForm.js: The minimum selected number of choices (' + minSelection + ') must be less than or equal to the maximum selected number of choices (' + maxSelection + ') in the checkbox group:\n' + this.group[0].name);
	var count = 0;
	for (var i = 0, l = this.group.length; i < l; i++) {
		if (this.group[i].checked) {
			count++;
		}
	}
	if (count < minSelection) {
		if (minSelection > 1) {
			return DForm.reportInvalid(this.group[0], DForm.formatMessage(dFormLocale.chboxMinSelectedPluralis, [minSelection, DField.getDisplayName(this.group[0])]));
		}
		return DForm.reportInvalid(this.group[0], DForm.formatMessage(dFormLocale.chboxMinSelectedSingularis, DField.getDisplayName(this.group[0])));
	}
	if (!isNaN(maxSelection) && count > maxSelection) {
		return DForm.reportInvalid(this.group[0], DForm.formatMessage(dFormLocale.chboxMaxSelected, [maxSelection, DField.getDisplayName(this.group[0])]));
	}
	return DForm.reportOk();
};

domReady(function() {
//	q('select[multiple]').forEach(function(sel) {
//		var ul = DElement.create('ul', {
//			'class': 'select-multiple-list'
//		});
//		DElement.css(sel, {
//			height: 0,
//			visibility: 'hidden'
//		});
//		var opts = sel.options;
//		for (var i = 0, l = opts.length; i < l; i++) {
//			var opt = opts[i];
//			var li = DElement.create('li', {
//				'data-value': opt.value,
//				'class': 'sel-item'
//			});
//			ul.appendChild(li);
//			li.appendChild(document.createTextNode(opt.text));
//		}
//		sel.parentNode.appendChild(ul);
//
//	});
	// The following ensures proper parameterization of the form when submitting the form the Ajax way:
	q('input[type="image"], input[type="submit"], button[type="submit"]').forEach(function(btn) {
		if (btn.form && (typeof btn.onclick != "function" || btn.onclick.toString().indexOf('DForm.buttonClicked') == -1)) {
			dLib.event.add(btn, "click", function(e) { DForm.buttonClicked(this); });
		}
	});
	// Fix labels in Safari & Shiira - feature testing impossible, so detect Safari && Shiira instead (dLib.ua.isLikeSafari_2 is set in DLib.js)
	if (dLib.ua.isLikeSafari_2) {
		q("label").forEach(function(label) {
			if (typeof label.onclick != "function" || label.onclick.toString().indexOf('DForm.labelClicked') == -1) {
				label.addEventListener("click", function(e) { DForm.labelClicked(e); }, false);
			}
		});
	}
});