// TODO: add support for mouseenter and mouseleave (they are not triggered by child elements and do not propagate/bubble). Also add support for tap event on mobile devices.
var dLib = {
	version: '1.2',
	ieSettings: {
		doPurge: false // if true DNode.purge, which nullifies each possible event handler on an element, will be run on each element inside the BODY tag (the BODY tag included)!
	},

	require: function(url, callback) {
		if (url) {
			var pNode = document.documentElement || document.body;
			var scr = DElement.create('script', {
				'type': 'text/javascript',
				src: url
			});
			scr.onload = scr.onreadystatechange = function() {
				// TODO: Finish
				//log('loaded: '+arguments.length);

//					if ( isAbort || !script.readyState || /loaded|complete/.test( script.readyState ) ) {
//
//						// Handle memory leak in IE
//						script.onload = script.onreadystatechange = null;
//
//						// Remove the script
//						if ( script.parentNode ) {
//							script.parentNode.removeChild( script );
//						}
//
//						// Dereference the script
//						script = null;
//
//						// Callback if not abort
//						if ( !isAbort ) {
//							callback( 200, "success" );
//						}
//					}
			};
			pNode.appendChild(scr);
			if (typeof callback == 'function') {
				callback();
			}
		}
	},
	isNative: function(obj, prop) { // determines if the property prop is natively defined in obj - does not work in Firefox and Opera, if a native property is brutally overwritten (fx: Array.prototype.reduce in prototype-1.6.0.3.js), since the overwrite does not make it enumerable (visible in a for-in loop)
		if (prop in obj) {
			if (obj[prop] && obj[prop].toString().indexOf('native code') > -1) {
				return true;
			}
			for (var p in obj) {
				if (p === prop) {
					return false;
				}
			}
			return true;
		}
		return false;
	},

	domMappings: {
		element: "DElement" // default
	},
	// event manager
	event: {
		readyListeners: [],
		listeners: [],
		isDOMReady: false,
		isListenerAdded: function(target, eventType, handler, doCapture) {
			var view = DElement.getDefaultView(target);
			if (view == window) { // adding listeners to other windows or elements residing in other windows - we don't keep track of them
				for (var i = 0, l = dLib.event.listeners.length; i < l; i++) {
					var entry = dLib.event.listeners[i];
					if (entry.target === target && entry.origHandler === handler && entry.eventType === eventType && entry.doCapture === doCapture) {
						return true;
					}
				}
			}
			return false;
		},

		fireListeners: function() {
			dLib.event.readyListeners.forEach(function(entry) { (entry)(); });
		},

	/**	Cross-browser addEventListener method (uses Window/Document/Element.attachEvent in IE).
		W3C DOM Event Model and MS DOM Event Model:
		Please note that when a handler/listener is added you won't be able to remove it again
		by setting target['on' + eventType] to null or the empty function!
		This applies for both addEventListener and attachEvent. You'll need to call removeEventListener/detachEvent.
		There are some drawbacks when using attachEvent.
		Note that attachEvent may not execute the handlers in the order they were added!
		In theory this goes for addEventListener too. The spec does not require the implementation of this method to
		execute listeners in the order they were added, but Gecko-based browsers, Opera, Chrome, Safari and Konqueror do so.
		Also note that the this keyword in a handler assigned by attachEvent will refer to the
		window object (the global object), not the target object!
		Also note that attachEvent DOES pass the event object as the first argument to your handler
		as it should according to the W3C DOM Level 2 Event Model.
		If your target already has an event handler	as an HTML attribute, the return value of this handler is ignored
		when assigning additional handlers with attachEvent. Then you must set the returnValue property of the event object.
		Note that addEventListener honors the original signed return value, but you can overrule it by invoking
		the preventDefault method of the event object. If no event handler assigned	in advance you must call event.preventDefault()
		to cancel the default action (if any). It is not enough to let your handler (assigned with addEventListener) return false.

		The scope issue (what the keyword this refers to) is fixed in this cross-browser method by invoking bindAsEventListener on your handler/listener though.
		But only if you haven't done so yourself!
		Note that this method returns this possibly altered handler/listener for possible removal later.
		If you wan't your handler to be executed in another scope than the target object (say an instance of your own class),
		you'll have to pass the instance to bindAsEventListener yourself though.	*/
		add: function(target, eventType, handler, doCapture) {
			if (typeof doCapture != "boolean") {
				doCapture = false;
			}
			if (eventType.indexOf("on") == 0) {
				eventType = eventType.substring(2);
			}
			if (dLib.event.isListenerAdded(target, eventType, handler, doCapture)) {
				return handler;
			}
			var obj = { target: target, origHandler: handler, eventType: eventType, doCapture: doCapture };
		/*	It is necessary in IE6 with SP1 to change the target from self to window.
			This is due to the fact that self == window (by value), but self !== window (by reference).
			What a bug Microsoft! */
			if (target == window) {
				target = window; // if the target reference is not changed from self to window the event will not be fired!
			}
			// IE6, IE7, IE8, Safari2 and Shiira are the only (modern) browsers, which doesn't support a listener object with a handleEvent method
			if (typeof handler == "object") {
		 		var newHandler;
				if (typeof handler.handleEvent == "function") { // due to the call to bindAsEventListener below, standard compliant browser goes here as well
					newHandler = handler.handleEvent;
				}
				else if (typeof handler["on" + eventType] == "function") {
					newHandler = handler["on" + eventType];
				}
				dLib.assert(newHandler, "DLib.js: You didn't supply a valid event listener!");
				var o = handler;
				if (newHandler.bound) {
					handler = newHandler;
				} else {
					handler = newHandler.bindAsEventListener(handler);
				}
				o["_on" + eventType + "_handler_"] = handler; // save reference for possible removal later
			}
			if (!handler.bound) {
				handler = handler.bindAsEventListener(target);
			}
			if (target.addEventListener) {
				target.addEventListener(eventType, handler, doCapture);
			}
			else if (target.attachEvent) { // the event handler is automatically passed the event object as the first argument as it should according to the spec!!
				if (doCapture && target.setCapture) { // the document object does not support setCapture, but it supports releaseCapture?
					target.setCapture();
				}
				target.attachEvent("on" + eventType, handler);
			}
			obj.handler = handler;
			if (DElement.getDefaultView(target) == window) {
				dLib.event.listeners.push(obj);
			}
			target = null; // avoid memory leak in IE
			return handler;
		},

		remove: function(target, eventType, handler, doCapture) {
			if (typeof doCapture != "boolean") {
				doCapture = false;
			}
			if (eventType.indexOf("on") == 0) {
				eventType = eventType.substring(2);
			}
			if (typeof handler == "object") {
				handler = handler["_on" + eventType + "_handler_"];
			}
			var handlerToRemove;
			dLib.event.listeners = dLib.event.listeners.filter(function(entry) {
				if (entry.target === target && (entry.handler === handler || entry.origHandler === handler) && entry.eventType === eventType && entry.doCapture === doCapture) {
					handlerToRemove = entry.handler;
					return false;
				}
				return true;
			});
			if (handlerToRemove) {
				if (target.removeEventListener) {
					target.removeEventListener(eventType, handlerToRemove, doCapture);
				}
				else if (target.detachEvent) {
					if (target.releaseCapture && doCapture) {
						target.releaseCapture(); // triggers the onlosecapture event
					}
					target.detachEvent("on" + eventType, handlerToRemove);
				}
			}
		},

		// removes all added listeners for a certain type of event for the given target
		removeAll: function(target, eventType, doCapture) {
			eventType = eventType || "*";
			var toBeRemoved = [], i, l, entry;
			for (i = 0, l = dLib.event.listeners.length; i < l; i++) {
				entry = dLib.event.listeners[i];
				if (entry.target === target && (entry.eventType === eventType || "*" === eventType) && (entry.doCapture === doCapture || doCapture == null)) {
					toBeRemoved.push(entry);
				}
			}
			for (i = 0, l = toBeRemoved.length; i < l; i++) {
				entry = toBeRemoved[i];
				dLib.event.remove(entry.target, entry.eventType, entry.handler, entry.doCapture);
			}
		},

	/**	Cross-browser method to add an onDOMReady listener.
		See http://peter.michaux.ca/article/553.

		The altered listener is returned to allow possible removal later.
		The scope of the listener will be document!

		NOTE:
		In IE7 the onload handler may be fired before the script tag is ready!	*/
		addDOMReady: function(listener) {
			if (typeof listener == "object") {
				var mName = "";
				if (typeof listener.handleEvent == "function") {
					mName = "handleEvent";
				}
				else if (typeof listener.onDOMContentLoaded == "function") {
					mName = "onDOMContentLoaded";
				}
				if (mName) {
					if (listener[mName].bound) {
						listener = listener[mName];
					} else {
						listener = listener[mName].bindAsEventListener(listener);
					}
				}
			}
			listener.hasRun = false;
			var f = function(e) {
				if (listener.hasRun) {
					return;
				}
				if (!dLib.event.isDOMReady) {
					dLib.event.isDOMReady = true;
				}
				if (e && e.type) {
					if (document.removeEventListener) {
						document.removeEventListener(e.type, arguments.callee, false);
					}
					else if (document.detachEvent) {
						document.detachEvent("on" + e.type, arguments.callee);
					}
				}
				listener.apply(document, [g(e)]);
				listener.hasRun = true;
			};
			f.bound = true; // make sure binding doesn't happen in dLib.event.add
			if (document.addEventListener) {
				dLib.event.add(document, "DOMContentLoaded", f);
			}
			else if (document.attachEvent) {
				dLib.event.readyListeners.push(f);
				document.attachEvent("onreadystatechange", function() {
					if (document.readyState === "complete") {
						document.detachEvent("onreadystatechange", arguments.callee);
						dLib.event.fireListeners();
					}
				});
				if (document.documentElement.doScroll && window == window.top) { // the doScroll trick is not safe to use in a frame or iframe - will simply not invoke the listener
					(function() {
						try {
							// if IE is used, use the trick by Diego Perini (http://javascript.nwbox.com/IEContentLoaded/). Note that this may be fired AFTER the onload event has been fired! Also see http://dean.edwards.name/weblog/2005/09/busted2/
							document.documentElement.doScroll("left");
							dLib.event.fireListeners();
						}
						catch (ex) {
							setTimeout(arguments.callee, 0);
						}
					})();
				}
			}
			dLib.event.add(window, "load", f);
			return f;
		},

		removeDOMReady: function(listener) {
			dLib.assert(!(typeof listener == "object" && (typeof listener.handleEvent == "function" || typeof listener.onDOMContentLoaded == "function")), "DLib.js: To remove a DOMReady listener you must pass the listener returned by the addDOMReadyListener method!");
			dLib.event.readyListeners.remove(listener, true);
			dLib.event.remove(document, "DOMContentLoaded", listener);
			dLib.event.remove(window, "load", listener);
		}

	},

	assert: function(condition, msg) {
		if (!condition) {
			throw msg || "Condition violated!";
		}
	},

	assertType: function(obj, sType, msg) {
		dLib.assert(typeof obj === sType, new TypeError(msg));
	},

	/*
	The first most common mistake is to do all animation effects at a constant speed.
	For many types of effects, linear/constant speed animation looks clunky because the animation starts and stops so abruptly.
	The solution is to adjust the speed of the animation based on a sinusoidal curve rather than a line so that the transition looks smoother.
	Basically, it should start slow and end slow and speed up in the middle.
	The second most common mistake is to do all animation at a constant frame rate.
	Given the dramatic DOM performance differences between web browsers and operating systems, an animation with a constant number of frames can take an order of magnitude longer on some computers.
	The solution is to perform animation in a constant amount of time, adjusting the frame rate based on the performance of the user's browser.
	Hence the following transitions. See DElement.ease and DElement.animate.
	*/

	transitions: {
		cubic: function(x) {
			return 1 + Math.pow(x - 1, 3);
		},

		linear: function(x) {
			return x;
		},

		elastic: function(x) {
			if (x < 0.25) {
				return 4 * x;
			}
			var n = 0.375 * Math.sin(32 * Math.PI * (x - 0.25) / 3) / Math.PI;
			if (x < 19 / 64) {
				return 1 + n;
			}
			var k = 64 * Math.log(2) / 45;
			return 1 + n * (Math.exp(k * (1 - x)) - 1);
		},

		elasticB: function(x) {
			if (x < 0.25) {
				return 4 * x;
			}
			var n = 0.5 * Math.sin(8 * Math.PI * (x - 0.25)) / Math.PI;
			if (x < 0.3125) {
				return 1 + n;
			}
			var k = 16 * Math.log(2) / 11;
			return 1 + n * (Math.exp(k * (1 - x)) - 1);
		},

		sinusoidal: function(x) {
			return 0.5 * (1 - Math.cos(x * Math.PI));
		},

		reverse: function(x) {
			return 1 - x;
		},

		flicker: function(x) {
			return Math.min(Math.sqrt(0.5) - Math.cos(0.25 * x * Math.PI) + 0.25 * Math.random(), 1);
		},

		wobble: function(x) {
			return 0.5 * (1 - Math.cos(9 * Math.PI * Math.pow(x, 2)));
		},

		pulse: function(x, pulses) {
			pulses = pulses || 5;
			var n = x * pulses * 2;
			if (Math.round((x % (1 / pulses)) * pulses) == 0) {
				return (n - Math.floor(n));
			}
			return 1 - (n - Math.floor(n));
		},

		spring: function(x) {
			return 1 - Math.cos(x * 4.5 * Math.PI) / Math.exp(x * 6);
		},

		none: function(x) {
			return 0;
		},

		full: function(x) {
			return 1;
		}
	},

	util: {

		/*	function to concatenate a customized error message to the user	*/
		formatMessage: function(msg, arr) {
			if (typeof msg == "string" && msg) {
				if (arr && !Array.isArray(arr)) {
					arr = [arr];
				}
				if (arr) {
					for (var i = 0, l = arr.length; i < l; i++) {
						msg = msg.replace(new RegExp("\{[" + i + "]\}"), arr[i]);
					}
				}
			}
			return msg;
		},

		resolveLabel: function(label, config) {
			var cfg = Object.configure(config, {
				accessKeyClass: "Accesskey",
				target: "*",
				allowedKeys: "a-z"
			});
			if (label) {
				var obj = {};
				// find first occurrence of * and make sure it is not the last character and is not preceeded by another * - must be special character since \\ is used in the pattern
				var patternString = "\\" + cfg.target + "[" + cfg.allowedKeys + "]{1}";
				var found = new RegExp(patternString, "i").exec(label);
				if (found && label.indexOf('' + cfg.target + cfg.target) == -1) {
					var k = found[0].substring(1);
					return {
						accessKey: k,
						accessKeyClass: cfg.accessKeyClass,
						plain: label.replace(cfg.target, ''),
						label: label.replace(found[0], '<span class="' + cfg.accessKeyClass + '">' + k + '<\/span>')
					}
				}
				return {label: label};
			}
			return null;
		},

		mapCSS: {
			"float": "cssFloat",
			styleFloat: "cssFloat"
		},

		mapIECSS: {
			"float": "styleFloat",
			cssFloat: "styleFloat"
		},

		translateCSSProperty: function(prop) {
			prop = prop.camelize();
			var map = dLib.ua.isIE ? dLib.util.mapIECSS : dLib.util.mapCSS;
			if (prop in map) {
				prop = map[prop];
			}
			return prop;
		},

		mapHTML: {
			"for": "htmlFor",
			"class": "className",
			"readonly": "readOnly",
			"maxlength": "maxLength",
			"cellspacing": "cellSpacing",
			"cellpadding": "cellPadding",
			"rowspan": "rowSpan",
			"colspan": "colSpan",
			"tabindex": "tabIndex",
			"accesskey": "accessKey"
		},

		createIframe: function(src) {
			if (typeof src != "string") {
				src = "javascript:false"; // if protocol is HTTPS this value does not cause IE to prompt for displaying mixed content
			}
			var name = 'ifrHidden' + new Date().getTime(); // need to use dynamic name to avoid XSS hijacking (phishing)
			var iframe = DElement.create('iframe', {
				id: name,
				name: name,
				src: src,
				width: "0%",
				height: "0%",
				frameborder: "0"
			});
			document.body.appendChild(iframe);
			return iframe;
		},

		/*	May throw an error due to the Same-Origin Policy!
			Returns null in Konqueror if src is 'about:blank' */
		getIframeDocument: function(iframe) {
			return iframe.contentDocument || iframe.Document;
		},

		getIframeWindow: function(iframe) {
			return DElement.getDefaultView(this.getIframeDocument(iframe));
		},

		fireHandler: function(name, args, cfg) {
			args = args || [];
			args.push(this);
			cfg = cfg || this.config;
			return dLib.util.applyHandler(cfg[name], cfg.scope || this, args);
		},

		applyHandler: function(handler, scope, args) {
			if (typeof handler == "object" && handler) {
				scope = handler.scope || scope;
				handler = handler.handleEvent;
			}
			var rv = (typeof handler == "function") ? handler.apply(handler.bound ? null : scope, args || []) : true;
			return (typeof rv == "boolean") ? rv : true;
		}

	},

	// the universal getter function that makes the DOM mapping work
	get: function(obj, config, win) {
		if (Array.isArray(obj)) {
			var elements = [];
			for (var i = 0, len = obj.length; i < len; i++) {
				elements.push(dLib.get(obj[i], config, win));
			}
			return elements;
		}
		win = win || window;
		if (typeof obj == "string") {
			obj = win.document.getElementById(obj);
		}
		if (obj) {
			if (!(obj instanceof DNode) && typeof obj.nodeName == "string") { // IE5.5 does not support the nodeName property for the document object
				if (typeof obj.tagName == "string") {
					var tName = obj.tagName.toLowerCase();
					var tNameType = obj.type ? tName + "_" + obj.type : "";
					var cName = dLib.domMappings["element"];
					if (tNameType && tNameType in dLib.domMappings) {
						cName = dLib.domMappings[tNameType];
					}
					else if (tName in dLib.domMappings) {
						cName = dLib.domMappings[tName];
					}
					if (typeof window[cName].newInstance == "function") {
						obj = window[cName].newInstance(obj, config); // must be window, not win!
					} else {
						obj = new window[cName](obj, config); // must be window, not win!
					}
				}
				else if (obj.nodeName == "#document") {
					obj = new DDocument(obj, config);
				} else {
					obj = new DNode(obj, config);
				}
			}
			else if (typeof obj.type == "string" && (obj.target !== undefined || obj.srcElement !== undefined)) { // is an event object
				switch (obj.type) {
					case "keydown":
					case "keypress":
					case "keyup":
						obj = new DKeyEvent(obj);
						break;
					case "click":
					case "dblclick":
					case "mousedown":
					case "mouseup":
					case "mousemove":
					case "mouseover":
					case "mouseout":
					case "mouseenter":
					case "mouseleave":
						obj = new DMouseEvent(obj);
						break;
					default:
						obj = new DEvent(obj);
					break;
				}
			}
			else if (obj === win.document) { // IE 5.5 goes here
				obj = new DDocument(obj, config);
			}
		}
		return obj;
	},

	query: function(query, context) {
		return new DElementList(query, context);
	},

/**	A way to detect some browsers regardless of how they identify themselves in navigator.userAgent.
	This is necessary since some bugs in these browsers can't be circumvented with feature testing.
	Where possible feature testing is used and when branching for different browser (or more precise
	their support for different features) the standard way is almost always the first branch. This is
	due to some browsers (mostly Opera) support for both the W3C DOM and MS DOM and it is important to use the
	standard (W3C DOM). However branching this ways does not always work. Some features can't be queried in some browsers
	(mostly IE). If you do, the feature is actually invoked/executed. Due to this strange behavior it is necessary to
	identify some browsers in another way. Unfortunately browser identification may also mean identifying the browser version!
	This is the case, when the bug in question is fixed in a more recent version of the browser.
	But to query navigator.userAgent when identifying the browser is not a solution, since several browsers
	allow the user to change this identification. This applies for Konqueror, Safari and earlier versions of Opera.
	Furthermore a browser may support some kind of add-on/plugin which allows the user to modify the identification.
	But changing the browser identification, does not mean that the browser suddenly supports another implementation of the DOM!
	So code depending on navigator.userAgent (or navigator.appVersion) will most likely fail, when the user changes the browser identification.
	Hence the following identifications.
	So far the following different browsers needs to be identified and so far these identifications have been successful.	*/
	ua: (function() {
		var ua = {}; // TODO: clean up - remove those not used
		var agent = navigator.userAgent.toLowerCase();
		var vendor = (typeof navigator.vendor == "string") ? navigator.vendor.toLowerCase() : "";
		var platform = (typeof navigator.platform == "string") ? navigator.platform.toLowerCase() : agent;
		ua.isChrome = ((vendor.indexOf("apple") > -1 || vendor.indexOf("google") > -1) && !!window.external);
		ua.isLikeSafari = (vendor.indexOf("apple") > -1 && !ua.isChrome); // vendor contains 'apple' in Shiira and Chrome too
		ua.isLikeSafari3 = ua.isLikeSafari && !!window.Entity; // Entity is supported in Shiira too
		ua.isLikeSafari4 = ua.isLikeSafari3 && !!window.CanvasRenderingContext2D; // CanvasRenderingContext2D is supported in Shiira too
		ua.isLikeSafari_2 = ua.isLikeSafari && !ua.isLikeSafari3; // is less than or equal to a Safari2 like browser
		ua.isLikeSafari_3 = ua.isLikeSafari3 && !ua.isLikeSafari4; // is less than or equal to a Safari3 like browser
		ua.isSafari = ua.isLikeSafari && !!window.showModalDialog; // Shiira and OmniWeb does not support showModalDialog
		ua.isSafari3 = ua.isLikeSafari3 && !!window.showModalDialog;
		ua.isSafari4 = ua.isLikeSafari4 && !!window.showModalDialog;
		ua.isShiira = ua.isLikeSafari && !window.showModalDialog; // Shiira does not support showModalDialog
		ua.isOpera = !!window.opera;
		ua.isIE = !!window.ActiveXObject && !!window.showModalDialog && !!document.all && !ua.isOpera;
		/*@cc_on
			ua.isIE = true;
		@*/
		ua.isIE5 = ua.isIE && !!window.attachEvent; // is IE5 or higher
		ua.isIE55 = ua.isIE && !!window.createPopup; // is IE5.5 or higher
		ua.isIE6 = ua.isIE && !!document.compatMode; // is IE6 or higher
		// In IE7 native XMLHttpRequest support may be disabled causing window.XMLHttpRequest to be undefined and Conditional Comments written with document.write won't work!
		ua.isIE7 = ua.isIE && !!document.documentElement && typeof document.documentElement.style.maxHeight != "undefined"; // is IE7 or higher
		ua.isIE8 = ua.isIE && !!window.XDomainRequest; // is IE8 or higher
		ua.isIE_55 = ua.isIE && !ua.isIE6; // is less than or equal to IE5.5
		ua.isIE_6 = ua.isIE && !ua.isIE7; // is less than or equal to IE6
		ua.isIE_7 = ua.isIE && !ua.isIE8; // is less than or equal to IE7
		ua.isLikeIE7 = (ua.isIE7 && !ua.isIE8) || (ua.isIE8 && !isNaN(document.documentMode) && document.documentMode == 7);
		ua.isKonqueror = (vendor.indexOf('kde') > -1);
		ua.isCamino = (vendor.indexOf('camino') > -1);
		ua.isGecko = (!!window.netscape) || (typeof navigator.product == "string" && navigator.product == "Gecko" && !ua.isLikeSafari);
		ua.isNS4 = !!window.Layer && !ua.isKonqueror;
		ua.isMac = (platform.indexOf('mac') > -1);
		/*@cc_on
			@if (@_mac)
				ua.isMac = true;
			@end
		@*/
		ua.isMacIntel = (ua.isMac && platform.indexOf('intel') > -1);
		ua.isWindows = (platform.indexOf("win") > -1);
		/*@cc_on
			@if (@_win32)
				ua.isWindows = true;
			@end
			@if (@_win16)
				ua.isWindows = true;
			@end
		@*/
		ua.isVista = (ua.isWindows && agent.indexOf("windows nt 6") > -1);
		ua.isLinux = (platform.indexOf("linux") > -1);
		ua.isUnix = (platform.indexOf("unix") > -1);
		ua.getUserMedia = function(cfg, loadHandler, errorHandler) {
			var prefixes = ['', 'webkit', 'webKit', 'moz', 'o', 'ms'];
			for (var i = 0, l = prefixes.length; i < l; i++) {
				var prefix = prefixes[i];
				var p = prefix ? prefix + 'GetUserMedia' : 'getUserMedia';
				if (p in navigator) {
					navigator[p](cfg, loadHandler, errorHandler);
					return true;
				}
			}
			return false;
		};
		return ua;
	})()

};

/** Core fixes:
	Implement JavaScript 1.6 (made part of ECMAScript 5) Array methods if not supported by the browser:
	indexOf, lastIndexOf, map, every, some, forEach, filter	*/

(function() {

	var isNative = dLib.isNative;

	if (!isNative(String.prototype, "trim")) {
		// remove leading and trailing white spaces
		String.prototype.trim = function() { // made part of ECMAScript 5
			return this.replace(/\s+$|^\s+/g, "");
		}
	}

	if (!isNative(String.prototype, "toJSON")) {
		String.prototype.toJSON = function() {
			return this.valueOf();
		}
	}

	if (!isNative(Number.prototype, "toJSON")) {
		Number.prototype.toJSON = function(key) {
			return this.valueOf();
		}
	}

	if (!isNative(Boolean.prototype, "toJSON")) {
		Boolean.prototype.toJSON = function(key) {
			return this.valueOf();
		}
	}

	if (!isNative(Date.prototype, "toJSON")) {
		// IE8 has a native toJSON method for the Date class. But as Crockfords toJSON method in json2.js it is buggy; any year before year 1000 will not be presented with 4 characters!
		Date.prototype.toJSON = function() {
			function pad(n, len) { // Format numbers to have at least len digits.
				return String.leftPad(n, len);
			}
			if (!isFinite(this.valueOf())) {
				return "Invalid Date"; // As does Firefox
			}
			return pad(this.getUTCFullYear(), 4) + '-' + pad(this.getUTCMonth() + 1) + '-' + pad(this.getUTCDate()) + 'T' + pad(this.getUTCHours()) + ':' + pad(this.getUTCMinutes()) + ':' + pad(this.getUTCSeconds()) + '.' + pad(this.getUTCMilliseconds(), 3) + 'Z';
		}
	}

	if (!isNative(Array, "isArray")) {
		Array.isArray = function(arr) {
			return (!!arr && (arr.constructor === Array || Array.toString() === "" + arr.constructor)); // the latter comparison is necessary if the array (arr) is constructed in another window
		}
	}

	if (!isNative(Array.prototype, "indexOf")) {
		Array.prototype.indexOf = function(target, from) {
			var len = this.length;
			from = Number(from);
			if (isNaN(from)) {
				from = 0;
			} else {
				from = (from < 0) ? Math.ceil(from)	: Math.floor(from);
				if (from < 0) {
					from += len;
				}
			}
			for (; from < len; from++) {
				if (from in this && this[from] === target) {
					return from;
				}
			}
			return -1;
		}
	}

	/**	Returns the index of the given item's last occurrence.	*/
	if (!isNative(Array.prototype, "lastIndexOf")) {
		Array.prototype.lastIndexOf = function(target, from) {
			var len = this.length;
			from = Number(from);
			if (isNaN(from)) {
				from = len - 1;
			} else {
				from = (from < 0) ? Math.ceil(from)	: Math.floor(from);
				if (from < 0) {
					from += len;
				}
				else if (from >= len) {
					from = len - 1;
				}
			}
			for (; from > -1; from--) {
				if (from in this && this[from] === target) {
					return from;
				}
			}
			return -1;
		}
	}

	/**	Runs a function on every item in the array.	*/
	if (!isNative(Array.prototype, "forEach")) {
		Array.prototype.forEach = function(fn, thisObj) {
			dLib.assertType(fn, "function", "Array.prototype.forEach needs a function as the first argument!");
			for (var i = 0, l = this.length; i < l; i++) {
				if (i in this) {
					fn.apply(thisObj, [this[i], i, this]);
				}
			}
		}
	}

	/**	Runs a function on every item in the array in the specified scope and returns the results in an array.	*/
	if (!isNative(Array.prototype, "map")) {
		Array.prototype.map = function(fn, thisObj) {
			dLib.assertType(fn, "function", "Array.prototype.map needs a function as the first argument!");
			var len = this.length, result = new Array(len);
			for (var i = 0; i < len; i++) {
				if (i in this) {
					result[i] = fn.apply(thisObj, [this[i], i, this]);
				}
			}
			return result;
		}
	}

	/**	Runs a function on every item in the array if and only if the function returns true for every item. Returns true if the function returns true for every item.	*/
	if (!isNative(Array.prototype, "every")) {
		Array.prototype.every = function(fn, thisObj) {
			dLib.assertType(fn, "function", "Array.prototype.every needs a function as the first argument!");
			for (var i = 0, len = this.length; i < len; i++) {
				if (i in this && !fn.apply(thisObj, [this[i], i, this])) {
					return false;
				}
			}
			return true;
		}
	}

	/**	Runs a function on every item in the array and returns an array of all items for which the function returns true.	*/
	if (!isNative(Array.prototype, "filter")) {
		Array.prototype.filter = function(fn, thisObj) {
			dLib.assertType(fn, "function", "Array.prototype.filter needs a function as the first argument!");
			var result = [];
			for (var i = 0, len = this.length; i < len; i++) {
				var entry = this[i];
				if (i in this && fn.apply(thisObj, [entry, i, this])) {
					result.push(entry);
				}
			}
			return result;
		}
	}

	/**	Runs a function on every item in the array and returns true if the function returns true for any item.	*/
	if (!isNative(Array.prototype, "some")) {
		Array.prototype.some = function(fn, thisObj) {
			dLib.assertType(fn, "function", "Array.prototype.some needs a function as the first argument!");
			for (var i = 0, len = this.length; i < len; i++) {
				if (i in this && fn.apply(thisObj, [this[i], i, this])) {
					return true;
				}
			}
			return false;
		}
	}

	if (!isNative(Array.prototype, "reduce")) {
		// See http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Reference:Objects:Array:reduce
		Array.prototype.reduce = function(fn, initialValue) {
			dLib.assertType(fn, "function", "Array.prototype.reduce needs a function as the first argument!");
			var len = this.length;
			// no value to return if no initial value and an empty array
			dLib.util.assert(len == 0 && initialValue == null, "Array.prototype.reduce must be invoked on a non-empty array or invoked with an initial value as the second argument!");
			var i = 0;
			var rv = initialValue;
			if (rv == null) {
	      		while (true) {
					if (i in this) {
						rv = this[i++];
						break;
					}
					// if array contains no values, no initial value to return
					dLib.util.assert(++i >= len, "Array.prototype.reduce must be invoked on a non-empty array or invoked with an initial value as the second argument!");
				}
			}
			for (; i < len; i++) {
	      		if (i in this) {
	        		rv = fn.apply(null, [rv, this[i], i, this]);
				}
			}
			return rv;
		}
	}

	if (!isNative(Array.prototype, "reduceRight")) {
		// See http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Reference:Objects:Array:reduceRight
		Array.prototype.reduceRight = function(fn, initialValue) {
			dLib.assertType(fn, "function", "Array.prototype.reduceRight needs a function as the first argument!");
			var len = this.length;
			// no value to return if no initial value, empty array
			dLib.util.assert(len == 0 && initialValue == null, "Array.prototype.reduceRight must be invoked on a non-empty array or invoked with an initial value as the second argument!");
			var i = len - 1;
			var rv = initialValue;
			if (rv == null) {
				while (true) {
					if (i in this) {
						rv = this[i--];
						break;
					}
					// if array contains no values, no initial value to return
					dLib.util.assert(--i < 0, "Array.prototype.reduceRight must be invoked on a non-empty array or invoked with an initial value as the second argument!");
				}
			}
			for (; i >= 0; i--) {
	      		if (i in this) {
	        		rv = fn.apply(null, [rv, this[i], i, this]);
				}
			}
		    return rv;
		}
	}

	if (!isNative(Function.prototype, "bind")) {
		/*	The this keyword in your function body will refer to the targetObj argument, when invoking this method on your function.
		 *	NOTE: The bind method has become a part of ECMAScript 5.
		 *	The implementation below does NOT make the returned function inherit from the binding function as described by ECMAScript 5!
		 *	See https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/bind
		 *	*/
		Function.prototype.bind = function(targetObj) {
			var args = [].addAll(arguments);
			args.shift();
			var fn = this;
			var f = function() {
				return fn.apply(targetObj, args.concat([].addAll(arguments)));
			}
			f.bound = true;
			return f;
		}
	}

	if (!isNative(Function.prototype, "bindAsEventListener")) {
		/** The this keyword in your body function will refer to the targetObj argument, when invoking this method on your function.	*/
		Function.prototype.bindAsEventListener = function(targetObj) {
			var args = [].addAll(arguments);
			args.shift();
			var fn = this;
			var f = function(e) {
				if (!e) {
					// The targetObj variable may not refer to a node in this window! The following code allows execution in another window
					var win = DElement.getDefaultView(targetObj) || window;
					if (win && win.event) {
						e = win.event;
					}
				}
				return fn.apply(targetObj, [g(e)].concat(args));
			}
			f.bound = true;
			return f;
		}
	}

})();

/** Core extensions */

Object.isObject = function(obj) {
	return (!!obj && (obj.constructor === Object || Object.toString() === "" + obj.constructor)); // the latter comparison is necessary if the object (obj) is constructed in another window
}

Object.serialize = function(obj, prefix, converters, nullAsEmptyString) {
    prefix = prefix || '';
	var s = [];
	for (var p in obj) {
		var converter = (converters && typeof converters[p] == "function") ? converters[p] : null;
        var o = converter ? converter(obj[p]) : obj[p];
        if (Object.isObject(o)) {
            s.push(Object.serialize(o, p + '.'));
        } else {
            if (o === null && nullAsEmptyString) {
                o = '';
            }
            s.push(prefix + p + "=" + encodeURIComponent(o));
        }
	}
	return s.join("&");
}

Object.clone = function(source) {
	return Object.extend({}, source, true, false);
}

/*	This function does not just copy properties from one object (source) to another (target)
	If a property is an object literal (map) and exists as a map in the target object, the property will be extended as well, if mergeMaps is true.
	And so on...	*/
Object.extend = function(target, source, override, mergeMaps) {
	if (typeof override != "boolean") {
		override = true;
	}
	if (typeof mergeMaps != "boolean") {
		mergeMaps = true;
	}
	mergeMaps = override && mergeMaps;
	for (var property in source) {
		try { // when extending prototype objects in Gecko-based browsers an exception may be thrown for some properties
			if (override || !(property in target)) {
				var so = source[property];
				var to = target[property];
				if (mergeMaps && Object.isObject(to) && Object.isObject(so)) {
					target[property] = Object.extend(Object.clone(to), so, override, mergeMaps);
				} else {
					target[property] = so;
				}
			}
		}
		catch (err) {
			// do nothing
		}
	}
	return target;
}

Object.extendAll = function() {
	var obj = arguments[0];
	for (var i = 1, l = arguments.length; i < l; i++) {
		obj = Object.extend(obj, arguments[i]);
	}
	return obj;
}

// Copies functions only
Object.implement = function(target, source, override) {
	if (typeof override != "boolean") {
		override = true;
	}
	for (var property in source) {
		try { // when extending prototype objects in Gecko-based browsers an exception may be thrown for some properties
			var v = source[property];
			if (typeof v == "function" && (override || !(property in target))) {
				target[property] = v;
			}
		}
		catch (ex) {
			// do nothing
		}
	}
	return target;
}

//Returns an empty object which inherits from the provided object (prototypal inheritance)
Object.inheritFrom = function(obj) {
	var ProtoConstructor = function() {};
	ProtoConstructor.prototype = obj;
	return new ProtoConstructor();
}

Object.configure = function(config, parentConfig) {
	var cfg = Object.inheritFrom(parentConfig); // create empty object which inherits from defaultConfig (prototypal inheritance)
	// Now pass every property from config to the newly created object
	// And if a property is an object literal and the parentConfig also has this property (and is an object literal too), make this object inherit from the object in parentConfig
	for (var p in config) {
		try { // when extending prototype objects in Gecko-based browsers an exception may be thrown for some properties
			if (Object.isObject(config[p]) && Object.isObject(parentConfig[p])) {
				cfg[p] = Object.configure(config[p], parentConfig[p]);
			} else {
				cfg[p] = config[p];
			}
		}
		catch (err) {
			// do nothing
		}
	}
	return cfg;
}

Array.prototype.clone = function() {
	return [].concat(this);
}

Array.prototype.plus = function(arr) {
	for (var i = 0, l = arr.length; i < l; i++) {
		if (i in this) {
			this[i] += arr[i];
		}
	}
	return this;
}

Array.prototype.minus = function(arr) {
	for (var i = 0, l = arr.length; i < l; i++) {
		if (i in this) {
			this[i] -= arr[i];
		}
	}
	return this;
}

Array.prototype.multiply = function(arr) {
	for (var i = 0, l = arr.length; i < l; i++) {
		if (i in this) {
			this[i] *= arr[i];
		}
	}
	return this;
}

Array.prototype.divide = function(arr) {
	for (var i = 0, l = arr.length; i < l; i++) {
		if (i in this) {
			this[i] /= arr[i];
		}
	}
	return this;
}

Array.prototype.contains = function(target, compareByRefOrComparator) {
	for (var i = 0, len = this.length; i < len; i++) {
		if (!(i in this)) {
			continue;
		}
		if (typeof compareByRefOrComparator == "function") {
			if (compareByRefOrComparator.apply(this, [target, this[i]])) {
				return true;
			}
		}
		else if (compareByRefOrComparator) {
			if (this[i] === target) {
				return true;
			}
		}
		else if (this[i] == target) {
			return true;
		}
	}
	return false;
}

Array.prototype.unique = function(compareByRefOrComparator) {
	var arr = [];
	for (var i = 0, len = this.length; i < len; i++) {
		var entry = this[i];
		if (i == 0 || !arr.contains(entry, compareByRefOrComparator)) {
			arr.push(entry);
		}
	}
	return arr;
}

Array.prototype.remove = function(target, compareByRefOrComparator) {
	for (var i = 0, l = this.length; i < l; i++) {
		if (!(i in this)) {
			continue;
		}
		var found = false, entry = this[i];
		if (typeof compareByRefOrComparator == "function") {
			if (compareByRefOrComparator.apply(this, [target, entry])) {
				found = true;
			}
		}
		else if (compareByRefOrComparator) {
			if (entry === target) {
				found = true;
			}
		}
		else if (entry == target) {
			found = true;
		}
		if (found) {
			this.splice(i, 1);
			return entry;
		}
	}
	return null;
}

// Array.prototype.concat only accepts an actual array as argument, not lists (like a NodeList)
Array.prototype.addAll = function(list) {
	if (list && typeof list.length == "number") {
		for (var i = 0, l = list.length; i < l; i++) {
			this.push(list[i]);
		}
	}
	return this;
}

Array.prototype.swap = function(i, j) {
	var m = this.length - 1;
	if (i != j && i.inRange(0, m) && j.inRange(0, m)) {
		var iv = this[i];
		this[i] = this[j];
		this[j] = iv;
	}
	return this;
}

Array.prototype.shuffle = function(randomGenerator) {
	if (typeof randomGenerator != "function") {
		randomGenerator = function() { return Math.random(); }
	}
	// discard element 0, as 0 <= j <= i
	for (var l = this.length, i = l - 1; i > 0; i--) {
		var j = Math.floor(randomGenerator() * (i + 1));
		this.swap(i, j);
	}
	return this;
}

String.compare = function(str1, str2) {
	return str1.compareTo(str2);
}

String.leftPad = function(s, len, pad) {
	len = parseInt(len, 10) || 2;
	s = "" + s; // convert to string
	pad = "" + (pad || "0");
	while (s.length < len) {
		s = pad + s;
	}
	return s;
}

String.rightPad = function(s, len, pad) {
	len = parseInt(len, 10) || 2;
	s = "" + s; // convert to string
	pad = "" + (pad || "0");
	while (s.length < len) {
		s += pad;
	}
	return s;
}

String.prototype.leftPad = function(len, pad) {
	return String.leftPad(this, len, pad);
}

String.prototype.rightPad = function(len, pad) {
	return String.rightPad(this, len, pad);
}

String.prototype.toJsonUrl = function() {
	var a = this.split('?');
	return a[0] + '.json' + (a.length > 1 ? '?' + a[1] : '');
}

String.prototype.compareTo = function(str) {
	return (this < str) ? -1 : (this > str ? 1 : 0);
}

String.prototype.endsWith = function(target) {
	return (this.lastIndexOf(target) == this.length - target.length);
}

String.prototype.startsWith = function(target) {
	return (this.indexOf(target) == 0);
}

String.prototype.truncate = function(length, truncation) {
	length = parseInt(length, 10);
	if (isNaN(length)) {
		length = 30;
	}
	truncation = (typeof truncation != "string") ? '...' : truncation;
	return (this.length > length) ? this.slice(0, length - truncation.length) + truncation : this.toString();
}

String.prototype.camelize = function() {
	var parts = this.split('-');
	var len = parts.length;
	if (len == 1) {
		return parts[0];
	}
	var camelized = (this.charAt(0) == '-') ? parts[0].charAt(0).toUpperCase() + parts[0].substring(1) : parts[0];
	for (var i = 1; i < len; i++) {
		camelized += parts[i].charAt(0).toUpperCase() + parts[i].substring(1);
	}
	return camelized;
}

String.prototype.capitalize = function() {
	var str = this.trim();
	if (str) {
		str = str.charAt(0).toUpperCase() + str.substring(1);
	}
	return str;
}

/**	Returns the empty string if pName isn't found	*/
String.prototype.getParameter = function(pName, pDel, vDel, qDel) {
	var values = this.getParameterValues(pName, pDel, vDel, qDel);
	if (values && values.length > 0) {
		return values[0];
	}
	return "";
}

/** Returns an array of string literals (or null if the parameter doesn't exist)	*/
String.prototype.getParameterValues = function(pName, pDel, vDel, qDel) {
	var map = this.getParameterMap(pDel, vDel, qDel);
	if (pName in map) {
		values = map[pName];
		return (typeof values == "string") ? [values] : values;
	}
	return null;
}

String.prototype.getParameterMap = function(pDel, vDel, qDel) {
	if (!pDel || typeof pDel != "string") {
		pDel = "&";
	}
	if (!vDel || typeof vDel != "string") {
		vDel = "=";
	}
	if (!qDel || typeof qDel != "string") {
		qDel = "?";
	}
	var query = this;
	var index = query.indexOf(qDel);
	query = query.substr(++index); // ignore everything before query delimiter (possibly a question mark) - including the query delimiter itself
	if (pDel == "&" && vDel == "=" && qDel == "?") { // string is assumed to be an url
		query = query.replace(/&amp;/g, '&'); // replace &amp; with &
	}
	var map = {};
	if (query) {
		var pArr = query.split(pDel);
		for (var i = 0, l = pArr.length; i < l; i++)	{
			var arr = pArr[i].split(vDel, 2);
			if (arr.length == 2) {
				var n = arr[0];
				var v = arr[1].urlDecode();
				if (n in map) {
					if (!Array.isArray(map[n])) {
						map[n] = [map[n]];
					}
					map[n].push(v);
				} else {
					map[n] = v;
				}
			}
		}
	}
	return map;
}

String.prototype.setParameter = function(pName, pValue, pDel, vDel, qDel) {
	return this.setParameterValues(pName, [pValue], pDel, vDel, qDel);
}

String.prototype.setParameterValues = function(pName, pValues, pDel, vDel, qDel) {
	if (!pName || typeof pName != "string" || !Array.isArray(pValues) || pValues.length < 1) {
		return this;
	}
	if (!pDel || typeof pDel != "string") {
		pDel = "&";
	}
	if (!vDel || typeof vDel != "string") {
		vDel = "=";
	}
	if (!qDel || typeof qDel != "string") {
		qDel = "?";
	}
	var map = this.getParameterMap(pDel, vDel, qDel);
	map[pName] = pValues;
	return this.setParameterMap(map, pDel, vDel, qDel);
}

String.prototype.setParameterMap = function(map, pDel, vDel, qDel) {
	if (!Object.isObject(map)) {
		return this;
	}
	if (!pDel || typeof pDel != "string") {
		pDel = "&";
	}
	if (!vDel || typeof vDel != "string") {
		vDel = "=";
	}
	if (!qDel || typeof qDel != "string") {
		qDel = "?";
	}
	var arr = this.split(qDel);
	var s = "";
	for (var p in map) {
		var v = map[p];
		if (Array.isArray(v)) {
			for (var i = 0, l = v.length; i < l; i++) {
				s += pDel + p + vDel + encodeURIComponent(v[i]);
			}
		} else {
			s += pDel + p + vDel + encodeURIComponent(v);
		}
	}
	if (s) {
		s = qDel + s.substring(1);
	}
	return arr[0] + s;
}

String.prototype.htmlEncode = function() {
	var specialChars = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' };
	return this.replace(/[\&\<\>\"]|[^,\-_a-z0-9]/gim, function(match) {
		return (match in specialChars) ? specialChars[match] : "&#x" + Number.toHexString(match.charCodeAt(0)) + ";";
	});
}

String.prototype.htmlDecode = function() {
	var specialChars = { '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>' };
	return this.replace(/\&amp;|\&lt;|\&gt;|\&quot;|\&\#x([0-9a-f]{2,4})\;/gim, function(match, partialMatch) {
		return (match in specialChars) ? specialChars[match] : String.fromCharCode(Number.parseHexString(partialMatch));
	});
}

String.prototype.urlEncode = function(asCompleteURL) {
	if (typeof encodeURI != "undefined") {
		if (asCompleteURL) {
			return encodeURI(this);
		}
		return encodeURIComponent(this);
	}
	return escape(this);
}

String.prototype.urlDecode = function(asCompleteURL) {
	try {
		if (asCompleteURL) {
			return decodeURI(this);
		}
		return decodeURIComponent(this);
	}
	catch (ex) { // this try-catch is necessary since browsers still use escape as their default encoding of URL parameters - the escape method uses the Latin character set encodeURIComponent uses UTF-8 (see http://xkr.us/articles/javascript/encode-compare/)
	}
	return unescape(this);
}

Number.toHexString = function(x, length) {
	var s = x.toString(16);
	var z = Math.floor(length);
	while (z > s.length) {
		s = "0" + s;
	}
	return s;
}

Number.toBinaryString = function(x, length) {
	var s = x.toString(2);
	var z = Math.floor(length);
	while (z > s.length) {
		s = "0" + s;
	}
	return s;
}

Number.parseHexString = function(s) {
	var v = "0123456789abcdef";
	if (s.indexOf("0x") == 0) {
		s = s.substring(2);
	}
	var n = 0;
	var arr = s.toLowerCase().split("");
	for (var i = 0, l = arr.length; i < l; i++) {
		n += v.indexOf(arr[l - 1 - i]) * Math.pow(16, i);
	}
	return n;
}

Number.parseBinaryString = function(s) {
	var v = "01";
	var n = 0;
	var arr = s.toLowerCase().split("");
	for (var i = 0, l = arr.length; i < l; i++) {
		n += v.indexOf(arr[l - 1 - i]) * Math.pow(2, i);
	}
	return n;
}

Number.format = function(no, del) {
	var n = '' + no;
	if (n.length > 3) {
		del = del || ',';
		var pos = n.length % 3;
		var s = n.substring(0, pos);
		while (pos < n.length) {
			if (s) {
				s += del;
			}
			s += n.substr(pos, 3);
			pos += 3;
		}
		return s;
	}
	return n;
}

Number.prototype.format = function(del) {
	return Number.format(this.valueOf(), del);
}

Number.prototype.inRange = function(begin, end) {
	return this >= parseInt(begin, 10) && this <= parseInt(end, 10);
}

/*
Note that the Date class in JavaScript is lenient.
Lenient means that:
var date = new Date(2004, 10, 25, 24, 47);
is the time 26th of November 2004 47 minutes past midnight
and that:
var date = new Date(2004, 10, 25, 25, 47);
is the time 26th of November 2004 47 minutes past one o'clock in the morning.
Also note that months is indexed from 0 to 11 (like in Java), not from 1 to 12.
*/
// static fields - according to the Calendar class in Java
Date.SUNDAY = 1;
Date.MONDAY = 2;
Date.TUESDAY = 3;
Date.WEDNESDAY = 4;
Date.THURSDAY = 5;
Date.FRIDAY = 6;
Date.SATURDAY = 7;

// language dependent Date variables - copied to the prototype object
Date.firstDayOfWeek = Date.firstDayOfWeek || Date.MONDAY; // default first day of week - ISO 8601 standard is monday - in Java it is sunday (a value of 1) if the locale is en_US and monday (a value of 2) if the locale is da_DK
Date.minimalDaysInFirstWeek = Date.minimalDaysInFirstWeek || 4; // ISO 8601 standard is 4 - in Java the value is 1 if the locale is en_US and 4 if the locale is da_DK
Date.formatPattern = Date.formatPattern || "d-M-yy";
// other language dependent Date variables
Date.jsonPattern = Date.jsonPattern || "yyyy-MM-dd'T'HH:mm:ss.SSSZ";
Date.days = Date.days || ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
Date.daysShort = Date.daysShort || ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
Date.daysMedium = Date.daysMedium || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
Date.months = Date.months || ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
Date.monthsShort = Date.monthsShort || ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
Date.daysSuffix = Date.daysSuffix || ["st", "nd", "rd", "th", "th", "th", "th", // 1st - 7th
				                      "th", "th", "th", "th", "th", "th", "th", // 8th - 14th
				                      "th", "th", "th", "th", "th", "th", "st", // 15th - 21st
				                      "nd", "rd", "th", "th", "th", "th", "th", // 22nd - 28th
				                      "th", "th", "st"];                        // 29th - 31st

Date.isDate = function(date) {
	return (!!date && (date.constructor === Date || Date.toString() === "" + date.constructor)); // the latter comparison is necessary if the date (date) is constructed in another window
}

/*	An alternative static method to the built-in static parse method of the Date class.
	The built-in parse method only parses string representations of a date on the form MMM dd, yyyy (Dec 25, 1995).
	This method returns a date object (in local time unless timezone is specified), which is null if parsing fails!
	A date-time string will be interpreted as universal time (UTC) if ending with a Z (like in the Date.prototype.toJSON method)!
	NOTE:
	UTC (Universal Coordinated Time) = GMT (Greenwich Mean Time)
	CET (Central European Time) = UTC+0100
	CEST (Central European Summer Time) = UTC+0200
	Be aware of a bug in Safari 2.0.4 (and probably earlier versions).
	If one of the methods setMonth, setDate, setHours, setMinutes and setSeconds is called with a value greater than 127 the lenient behavior fails!
	*/
/*
TODO:
	- possible to use suffix as in the format method (May 3rd)
	- finish a, h, k and K
*/
Date.parseDate = function(dateString, patternOrConfig) {
	var funcs = {
		d: function(str, target) { // Day in month: 1-28/29/30/31
			var found = new RegExp("^[0-9]{1,2}").exec(str);
			if (found) {
				dd = parseInt(found[0], 10);
				return str.replace(found[0], "");
			}
			return str;
		},
		H: function(str, target) { // Hour in day: 0-23
			var found = new RegExp("^[0-9]{1,2}").exec(str);
			if (found) {
				HH = parseInt(found[0], 10);
				return str.replace(found[0], "");
			}
			return str;
		},
		m: function(str, target) { // Minute in hour: 0-59
			var found = new RegExp("^[0-9]{1,2}").exec(str);
			if (found) {
				mm = parseInt(found[0], 10);
				return str.replace(found[0], "");
			}
			return str;
		},
		M: function(str, target) { // Month in year: July/Jul/07/7
			var ln = target.length;
			var re = (ln > 2) ? new RegExp("^[a-z]{" + ln + ",}", "i") : new RegExp("^[0-9]{1,2}");
			var found = re.exec(str);
			if (found) {
				if (ln > 2) {
					for (var i = 0, l = months.length; i < l; i++) {
						var month = months[i];
						if (month.indexOf(found[0]) == 0) {
							MM = i + 1;
							ln = found[0].length;
							break;
						}
					}
					return str.substring(ln);
				}
				MM = parseInt(found[0], 10);
				return str.replace(found[0], "");
			}
			return str;
		},
		s: function(str, target) { // Second in minute: 0-59
			var found = new RegExp("^[0-9]{1,2}").exec(str);
			if (found) {
				ss = parseInt(found[0], 10);
				return str.replace(found[0], "");
			}
			return str;
		},
		S: function(str, target) { // Millisecond: 0-999
			var found = new RegExp("^[0-9]{1,3}").exec(str);
			if (found) {
			/*	Necessary to specify the second argument in parseInt as 10!!
				Otherwise a value like 034 will	be parsed as a hexadecimal number. */
				SS = parseInt(found[0], 10);
				return str.replace(found[0], "");
			}
			return str;
		},
	/*	This function parses the year according to the SimpleDateFormat class in Java.	*/
		y: function(str, target) { // Year: 1986/86
			var ln = target.length;
			var isBeforeChrist = false;
			if (str.charAt(0) == '-') {
				isBeforeChrist = true;
				str = str.substring(1);
			}
			var end = greedy ? 4 : ln;
			var found = new RegExp("^[0-9]{1," + end + "}").exec(str);
			if (found) {
				var f0 = found[0];
				yy = parseInt(f0, 10);
				if (ln <= 2 && f0.length >= target.length && yy < 100 && !isBeforeChrist) {
					var fullYear = new Date().getFullYear();
					var century = parseInt(fullYear / 100, 10);
					if (fullYear % 100 + 20 <= yy) {
						century--;
					}
					if (f0.length == 1) {
						yy = parseInt(century + "0" + f0, 10);
					} else {
						yy = parseInt(century + f0, 10);
					}
				}
				if (!isNaN(yy) && isBeforeChrist) {
					yy = -yy;
				}
				return str.replace(f0, "");
			}
			return str;
		},
		// General time zone: must be on the form: GMT sign digit digit colon digit digit or just GMT
		z: function(str, target) {
			if (str == 'GMT') {
				str = str + '+00:00';
			}
			if (str == target) {
				timezoneOffset = 0;
			} else {
				var found = /^(GMT)(\+|-)([0-9]{1,2})(:){1}([0-9]{2})$/.exec(str);
				if (found && found.length == 6) {
					var offset = 0;
					var sign = (found[2] == '-') ? -1 : 1;
					var hours = parseInt(found[3], 10);
					var minutes = parseInt(found[5], 10);
					if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
						// Date.getTimezoneOffset returns -60 for GMT+01:00, so reverse timezoneOffset accordingly
						timezoneOffset = -1 * sign * (60 * hours + minutes);
						return str.replace(found[0], "");
					}
				}
			}
			return str.substring(target.length);
		},
		// RFC 822 time zone: must be on the form: sign digit digit [colon] digit digit
		Z: function(str, target) {
			if (str == target) {
				timezoneOffset = 0;
			} else {
				var found = /^(\+|-)([0-9]{2})([0-9]{2})$/.exec(str);
				if (found && found.length == 4) {
					var offset = 0;
					var sign = (found[1] == '-') ? -1 : 1;
					var hours = parseInt(found[2], 10);
					var minutes = parseInt(found[3], 10);
					if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
						// Date.getTimezoneOffset returns -60 for GMT+01:00, so reverse timezoneOffset accordingly
						timezoneOffset = -1 * sign * (60 * hours + minutes);
						return str.replace(found[0], "");
					}
				}
			}
			return str.substring(target.length);
		}
	}
	if (typeof dateString != "string" || dateString == "") {
		return null;
	}
	var date = new Date(1970, 0, 1); // NOTE: This is local time, not UTC time!
	var cfg = Object.configure(Object.isObject(patternOrConfig) ? patternOrConfig : {}, { pattern: date.formatPattern, lenient: false, months: Date.months });
	var pattern = (typeof patternOrConfig == "string" && patternOrConfig) ? patternOrConfig : cfg.pattern;
	var months = cfg.months;
	var yy, MM, dd, HH, mm, ss, SS;
	var timezoneOffset = NaN;
	var found;
	if (pattern.indexOf("'") > -1) { // remove comments from pattern
		var regExp = /'([^']{0,})'/;
		while ((found = regExp.exec(pattern)) != null) {
			pattern = pattern.replace(found[0], " ");
			dateString = dateString.replace(found[1], " ");
		}
		pattern = pattern.trim();
		dateString = dateString.trim();
	}
	var letters = "dmMyHsSzZ", del = ".-/:";
	var greedy = false; // is set to true if a delimiter is present in the pattern - is necessary to know when determining the year
	while (dateString && pattern) {
		var ch = pattern.charAt(0);
		var ch0 = dateString.charAt(0);
		if (!greedy) {
			greedy = del.indexOf(ch0) > -1 || (pattern.startsWith('y') && pattern.endsWith('y'));
		}
		if (letters.indexOf(ch) > -1) {
			if (del.indexOf(ch0) > -1 && ch != 'Z') {
				return null;
			}
			found = new RegExp("^([" + ch + "]{1,})").exec(pattern);
			if (found) {
				if (ch in funcs) {
					dateString = funcs[ch](dateString, found[0]);
				}
				pattern = pattern.replace(found[0], "");
			}
		} else {
			if (del.indexOf(ch) > -1 && ch0 != ch) {
				return null;
			}
			dateString = dateString.substring(1);
			pattern = pattern.substring(1);
		}
	}
	if (pattern || dateString || (!yy && !MM && !dd && !HH && !mm && !ss && !SS)) { // pattern and dateString must be empty strings at this point
		return null;
	}
	/*	Important to set month before date:
	 	If today is 10th of February 2005 and you parse the string 31-05-2005 you'll get
		3rd of May, because there is only 28 days in February.
		The same goes for year and month (the date object is lenient).	*/
	if (!isNaN(yy)) {
		date.setFullYear(yy);
	}
	var lenient = cfg.lenient;
	if (!isNaN(MM)) {
		if (!lenient && (MM < 1 || MM > 12)) {
			return null;
		}
		date.setMonth(--MM);
	}
	if (!isNaN(dd)) {
		if (!lenient && (dd < 1 || dd > date.getDaysInMonth())) {
			return null;
		}
		date.setDate(dd);
	}
	// time variables are set to 0, if not specified
	if (isNaN(HH)) {
		HH = 0;
	} else {
		if (!lenient && (HH < 0 || HH > 23)) {
			return null;
		}
	}
	date.setHours(HH);
	if (isNaN(mm)) {
		mm = 0;
	}
	else if (!lenient && (mm < 0 || mm > 59)) {
		return null;
	}
	date.setMinutes(mm);
	if (isNaN(ss)) {
		ss = 0;
	}
	else if (!lenient && (ss < 0 || ss > 59)) {
		return null;
	}
	date.setSeconds(ss);
	if (isNaN(SS)) {
		SS = 0;
	}
	else if (!lenient && (SS < 0 || SS > 999)) {
		return null;
	}
	date.setMilliseconds(SS);
	if (!isNaN(timezoneOffset)) {
		// getTimezoneOffset returns -60 for GMT+01:00
		var sign = (timezoneOffset < date.getTimezoneOffset()) ? -1 : 1;
		var adj = sign * Math.abs(timezoneOffset - date.getTimezoneOffset());
		if (adj != 0) {
			// Does the setMinutes method behave in a lenient way in Safari (no) and Konqueror (no)?
			date.setMinutes(date.getMinutes() + adj);
		}
	}
	return date;
}

Date.parseJSON = function(dateString, pattern) {
	return Date.parseDate(dateString, pattern || Date.jsonPattern);
}

Date.compare = function(dateA, dateB) {
	var at = dateA.getTime(), bt = dateB.getTime();
	if (at < bt) {
		return -1;
	}
	if (at > bt) {
		return 1;
	}
	return 0;
}

Date.min = function() {
	var min = arguments[0];
	for (var i = 1, l = arguments.length; i < l; i++) {
		var d = arguments[i];
		if (d.before(min)) {
			min = d;
		}
	}
	return min;
}

Date.max = function() {
	var max = arguments[0];
	for (var i = 1, l = arguments.length; i < l; i++) {
		var d = arguments[i];
		if (d.after(max)) {
			max = d;
		}
	}
	return max;
}

Date.getDaysInYear = function(y) {
	if (y % 400 == 0 || (y % 4 == 0 && y % 100 != 0)) {
		return 366;
	}
	return 365;
}

Date.isLeapYear = function(y) {
	return Date.getDaysInYear(y) == 366;
}

Date.prototype.firstDayOfWeek = Date.firstDayOfWeek;
Date.prototype.minimalDaysInFirstWeek = Date.minimalDaysInFirstWeek;
Date.prototype.formatPattern = Date.formatPattern;

Date.prototype.compareTo = function(anotherDate) {
	return Date.compare(this, anotherDate);
}

Date.prototype.getDaysInYear = function() {
	return Date.getDaysInYear(this.getFullYear());
}

Date.prototype.isLeapYear = function() {
	return Date.isLeapYear(this.getFullYear());
}

Date.prototype.after = function(anotherDate, sharp) {
	if (sharp) {
		return (Date.compare(this, anotherDate) > 0);
	}
	return (Date.compare(this, anotherDate) >= 0);
}

Date.prototype.before = function(anotherDate, sharp) {
	if (sharp) {
		return (Date.compare(this, anotherDate) < 0);
	}
	return (Date.compare(this, anotherDate) <= 0);
}

Date.prototype.clone = function() {
	return new Date(this.getTime());
}

Date.prototype.isDST = function() {
	return new Date(this.getFullYear(), 0, 1).getTimezoneOffset() != this.getTimezoneOffset();
}

Date.prototype.between = function(start, end, sharp) {
	if (start && end) {
	    var t = this.getTime();
	    if (sharp) {
	    	return start.getTime() < t && t < end.getTime();
	    }
	    return start.getTime() <= t && t <= end.getTime();
	}
	if (start) {
		return this.after(start, sharp);
	}
	if (end) {
		return this.before(end, sharp);
	}
	return false;
}

Date.prototype.setFirstDayOfWeek = function(no) {
	no = parseInt(no, 10);
	if (!isNaN(no) && no > 0) { // must be between 1 and 7
		no = --no % 7; // modulus 7 gives values between 0 and 6 for non-negative integers
		this.firstDayOfWeek = ++no;
	}
}

Date.prototype.setMinimalDaysInFirstWeek = function(no) {
	no = parseInt(no, 10);
	if (no > 0) { // must be between 1 and 7
		no = --no % 7;
		this.minimalDaysInFirstWeek = ++no;
	}
}

Date.prototype.getDayOfYear = function() {
	var offsetDate = new Date(this.getFullYear(), 0, 1);
	var toDay = new Date(this.getFullYear(), this.getMonth(), this.getDate());
	return (Math.round((toDay.getTime() - offsetDate.getTime()) / 864e5) + 1);
}

Date.prototype.getDayOfWeek = function() {
/*	Plus 1 because in JavaScript days are numbered from 0, but in Java's Calendar
	class (which is simulated in this file) days are numbered from 1.	*/
	return this.getDay() + 1;
}

Date.prototype.getWeekOfYear = function() {
	var offsetDate = new Date(this.getFullYear(), 0, 1);
	var i = 0;
	while (offsetDate.getDayOfWeek() != this.firstDayOfWeek) {
		offsetDate.next();
		i++;
	}
	/*	Now the day of offsetDate is the first day of a week and 0 <= i <= 6
	Determine if this date is before or after offsetDate.
	Then determine if the days prior to offsetDate should count for a week (i >= this.minimalDaysInFirstWeek)	*/
	var no = parseInt(Math.max(this.getDayOfYear() - offsetDate.getDayOfYear(), 0) / 7, 10) + 1;
	if (this.compareTo(offsetDate) >= 0) {
		if (i >= this.minimalDaysInFirstWeek) {
			no++;
		}
		offsetDate = new Date(this.getFullYear(), 11, 31);
		i = 1;
		while (offsetDate.getDayOfWeek() != this.firstDayOfWeek) {
			offsetDate.prev();
			i++;
		}
	/*	Now offsetDate is the first day of the last week this year.
		If this date is after offsetDate, then determine if this really
		is the last week of the year or it is the first week of next year.	*/
		if (this.compareTo(offsetDate) >= 0 && i <= 7 - this.minimalDaysInFirstWeek) {
			no = 1;
		}
	}
	else if (i < this.minimalDaysInFirstWeek) {
		offsetDate = new Date(this.getFullYear() - 1, 11, 31);
		offsetDate.setFirstDayOfWeek(this.firstDayOfWeek);
		offsetDate.setMinimalDaysInFirstWeek(this.minimalDaysInFirstWeek);
		no = offsetDate.getWeekOfYear(); // this can never be an endless loop of recursion
	}
	return no;
}

Date.prototype.isSameYear = function(date) {
	return (Date.isDate(date) && this.getFullYear() == date.getFullYear());
}

Date.prototype.isSameMonth = function(date) {
	return (this.isSameYear(date) && this.getMonth() == date.getMonth());
}

Date.prototype.isSameDate = function(date) {
	return (this.isSameMonth(date) && this.getDate() == date.getDate());
}

Date.prototype.getDaysInMonth = function() {
	var days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	return this.getMonth() == 1 && this.isLeapYear() ? 29 : days[this.getMonth()];
}

// tells if ante meridiem or post meridiem
Date.prototype.getAmPmMarker = function() {
	return (this.getHours() > 11) ? "PM" : "AM";
}

Date.prototype.addMonth = function(step) {
	step = step || 1;
	this.setMonth(this.getMonth() + step);
	return this;
}

Date.prototype.addYear = function(step) {
	step = step || 1;
	this.setFullYear(this.getFullYear() + step);
	return this;
}

Date.prototype.add = function(step) {
	step = step || 1;
	this.setDate(this.getDate() + step);
	return this;
}

Date.prototype.next = function() {
	return this.add(1);
}

Date.prototype.prev = function() {
	return this.add(-1);
}

/**
	When using the Date constructor a year below 100 (year 100 A.C. that is) will be interpreted as if it is in the 20th century (year 63 will be interpreted as 1963).
	If this is not your intention you can use this set method:
	So if you need a Date object representing the 10th of March year 75 A.C., you cannot write
	new Date(75, 2, 10) as this will be interpreted as 10th of March year 1975 A.C.
	But you can write new Date().set(75, 2, 10) and get the desired result.
	The method returns the date instance itself allowing you to use a chainable coding style.
*/
Date.prototype.set = function(year, month, date, hours, minutes, seconds, milliseconds) {
	if (!isNaN(year)) {
		this.setFullYear(year);
	}
	if (!isNaN(month)) {
		this.setMonth(month);
	}
	if (!isNaN(date)) {
		this.setDate(date);
	}
	if (!isNaN(hours)) {
		this.setHours(hours);
	}
	if (!isNaN(minutes)) {
		this.setMinutes(minutes);
	}
	if (!isNaN(seconds)) {
		this.setSeconds(seconds);
	}
	if (!isNaN(milliseconds)) {
		this.setMilliseconds(milliseconds);
	}
	return this;
}

Date.prototype.isWeekend = function() {
	var day = this.getDayOfWeek();
	return (day == Date.SUNDAY || day == Date.SATURDAY);
}

Date.prototype.getSuffix = function() {
	return Date.daysSuffix[this.getDate() - 1];
}

Date.prototype.isHoliday = function() {
	return (this.getDayOfWeek() == Date.SUNDAY);
}

Date.prototype.setTimeOnly = function(hours, minutes, seconds, milliseconds) {
	return this.set(NaN, NaN, NaN, hours, minutes, seconds, milliseconds);
}

Date.prototype.clearTime = function(clone) {
	if (clone) {
		return this.clone().clearTime();
	}
	return this.setTimeOnly(0, 0, 0, 0);
}

Date.prototype.getFirstDateOfWeek = function() {
	var first = this.clone();
	var firstDay = first.firstDayOfWeek;
	while (firstDay != first.getDayOfWeek()) {
		first.prev();
	}
	return first.setTimeOnly(0, 0, 0, 0);
}

Date.prototype.getFirstDateOfMonth = function() {
	return new Date(this.getFullYear(), this.getMonth(), 1);
}

Date.prototype.getLastDateOfMonth = function() {
	return new Date(this.getFullYear(), this.getMonth(), this.getDaysInMonth(), 23, 59, 59, 999);
}

/*	Simulates the behavior of the SimpleDateFormat.format method in Java.
	With a few extensions and a few exceptions though.
	The letter n has special meaning as opposed to Java.
	Specifying dn (d for date) is translated into 1st, 2nd etc., if the language is english.
	Supported letters: adDEGhHkKmMnsSwyzZ
	The letters F (day of week in month) and W (week in month) haven't (yet) any meaning in this method.	*/
Date.prototype.format = function(patternOrConfig) {
	if (!isFinite(this.valueOf())) {
		return "Invalid Date";
	}
	var date = this;
	var cfg = Object.configure(Object.isObject(patternOrConfig) ? patternOrConfig : {}, {
		pattern: date.formatPattern,
		days: Date.days,
		daysShort: Date.daysShort,
		months: Date.months,
		monthsShort: Date.monthsShort,
		daysSuffix: Date.daysSuffix,
		useUTC: false
	});
	if (cfg.useUTC) {
		date = this.clone();
		date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
	}
	var pattern = (typeof patternOrConfig == "string" && patternOrConfig) ? patternOrConfig : cfg.pattern;
	function prepend(s, reps) {
		var limit = Math.max(reps - s.length, 0);
		for (var i = 0; i < limit; i++) {
			s = "0" + s;
		}
		return s;
	}
	var funcs = {
	    a: function() {
	        return date.getAmPmMarker();
	    },
	    d: function(reps) {
	    	return prepend("" + date.getDate(), reps);
	    },
	    D: function(reps) { // day of year
			return prepend("" + date.getDayOfYear(), reps);
	    },
	    E: function(reps) { // day in week
	    	if (reps >= 4) {
				return cfg.days[date.getDay()];
			}
			return cfg.daysShort[date.getDay()];
	    },
	    G: function() {
	    	return (date.getFullYear() > 0) ? "AD" : "BC";
	    },
	    H: function(reps) { // 0-23
			return prepend("" + date.getHours(), reps);
	    },
	    h: function(reps) { // 1-12
	    	var h = (date.getHours() % 12) || 12;
			return prepend("" + h, reps);
	    },
	    K: function(reps) { // 0-11
			return prepend("" + (date.getHours() % 12), reps);
	    },
	    k: function(reps) { // 1-24
	    	var hours = date.getHours() || 24;
			return prepend("" + hours, reps);
	    },
	    M: function(reps) {
	    	if (reps == 4) {
	    		return cfg.months[date.getMonth()];
	    	}
	    	if (reps == 3) {
	    		return cfg.monthsShort[date.getMonth()];
	    	}
	    	return prepend("" + (date.getMonth() + 1), reps);
	    },
	    m: function(reps) {
	    	return prepend("" + date.getMinutes(), reps);
	    },
	    n: function() {
	    	return cfg.daysSuffix[date.getDate() - 1];
	    },
	    S: function(reps) {
	    	return prepend("" + date.getMilliseconds(), reps);
	    },
	    s: function(reps) {
	    	return prepend("" + date.getSeconds(), reps);
	    },
	    w: function(reps) {
	    	return prepend("" + date.getWeekOfYear(), reps);
	    },
		y: function(reps) {
			var year = date.getFullYear();
		/*	In Java year -4 is represented as year 05/0005 BC (Before Christ)
			and year 0 is represented as 01/0001 BC.
			Year 1 is represented as 01/0001 AD.	*/
			if (year < 0) {
				year *= -1;
				year++;
			}
			else if (year == 0) {
				year++;
			}
			var yy = "" + year;
		/*	Specifying less than 4 y's results in a representation with 2 characters,
			no matter if there's 1, 2, 3 or 4 digits in the year.	*/
			if (reps < 4) {
				if (yy.length > 2) {
					return yy.substring(yy.length - 2);
				}
				return prepend(yy, 2);
			}
			return prepend(yy, reps);
		},
		z: function() {
			return "GMT" + funcs.Z();
		},
		Z: function() {
			if (cfg.useUTC) {
				return "";
			}
			var n = date.getTimezoneOffset(); // measured in minutes with opposite sign
			var sign = (n > 0) ? "-" : "+";
			n = Math.abs(n);
			var hours = Math.floor(n / 60);
			var minutes = n - hours * 60;
			return sign + prepend("" + hours, 2) + prepend("" + minutes, 2);
		}
	}
	var ch, nextChar, result = "", letters = "adDEGhHkKmMnsSwyzZ", escapeChar = "'";
	while (pattern) {
		ch = pattern.charAt(0);
		if (ch == escapeChar && pattern.split(escapeChar).length % 2 == 1) { // found first escape character and there is an odd number of them
			while (true) {
				pattern = pattern.substring(1);
				ch = pattern.charAt(0);
				nextChar = pattern.charAt(1);
				if (ch == escapeChar) {
					pattern = pattern.substring(1);
					ch = pattern.charAt(0);
					if (nextChar != escapeChar) { // found last escape character
						break;
					}
					// else escape the escape character
					nextChar = pattern.charAt(1);
				}
				result += ch;
			}
		}
		if (!pattern) { // pattern may be the empty string here
			break;
		}
		if (letters.indexOf(ch) > -1) { // if the character has special meaning
			for (var i = 4; i >= 1; i--) {
				var p = "^([" + ch + "]{" + i + ",})";
				var found = new RegExp(p).exec(pattern);
				if (found) {
					if (ch in funcs) {
						result += funcs[ch](found[0].length);
						pattern = pattern.replace(found[0], "");
						break;
					} else {
						pattern = pattern.substring(1);
					}
				}
			}
		} else {
			result += ch;
			pattern = pattern.substring(1);
		}
	}
	return result;
}

Function.prototype.getName = function() {
    var found = /function\s([a-z]{1,}[a-z0-9]{0,})\(/i.exec(this.toString());
	if (found) {
		return found[1];
	}
	return 'N/A';
}

Function.prototype.inheritFrom = function(superConstructor) {
	dLib.assertType(superConstructor, "function", "Illegal argument: Parent class must be specified by a function!");
	// prevent built-in types from inheriting
	dLib.assert(![Object, String, Function, Array, Date, Number, RegExp, Boolean, Error, TypeError, URIError, SyntaxError, RangeError, ReferenceError, EvalError].some(function(entry) { return (entry === this); }.bind(this)), "Illegal operation: You cannot change the prototype chain for a built-in or native function!");
/*	Use a dummy constructor to create prototypes.
	This means that the real constructor doesn't need to guard against initialization if we are creating a prototype (versus a regular instance).
	Neither do we have to delete properties from the prototype instance which are own properties as our dummy constructor is not given any own properties.	*/
	var ProtoConstructor = function() {}; // this dummy constructor ensures that our prototype object does not have any properties on its own.
	// modify the prototype chain to ensure that this class inherits from the superConstructor class (actually a constructor function).
	ProtoConstructor.prototype = superConstructor.prototype;
	this.prototype = new ProtoConstructor(); // not enough to do: this.prototype = superConstructor.prototype as 'own' properties on the superConstructor then will be discarded
	// change the constructor property back to the class itself
	this.prototype.constructor = this;
	// give this constructor a reference to the super (parent) constructor
	this.superConstructor = superConstructor;
}

Function.prototype.applySuper = function(/* String */fnName, /* Object */scope, /* Array */args) {
	if (this.superConstructor && typeof this.superConstructor.prototype[fnName] == "function") {
		return this.superConstructor.prototype[fnName].apply(scope, args);
	}
	return undefined;
}

/** DOM Wrapper classes	*/

function DEvent(event) {
	this.event = event;
	this.type = event.type;
	this.target = DEvent.getTarget(event);
	this.relatedTarget = DEvent.getRelatedTarget(event);
}

DEvent.getTarget = function(e) {
	//e = e || window.event; // TODO: If this is necessary here, it is so a lot of other places as well
	var target = e.target || e.srcElement || document;
	if (target.nodeType == 3) {
		target = target.parentNode; // defeat old Safari bug
	}
	return target;
}

DEvent.getRelatedTarget = function(e) { // TODO: test
	var target = e.relatedTarget;
	if (!target && e.fromElement) {
		target = (e.fromElement === this.target) ? e.toElement : e.fromElement;
	}
	return target;
}

DEvent.stopPropagation = function(e) {
	if (typeof e.stopPropagation == "function") {
		e.stopPropagation();
	}
	if (typeof e.cancelBubble == "boolean") {
		e.cancelBubble = true;
	}
}

DEvent.preventDefault = function(e) {
	if (typeof e.preventDefault == "function") {
		e.preventDefault();
	}
	e.returnValue = false;
}

/**	The pageX property IS adjusted for possible scrolling of the page, but the property is not defined in IE!
	The clientX property is NOT adjusted for possible scrolling of the page.
	This goes for pageY and clientY as well.	*/
DEvent.getPageX = function(e) {
	var x = 0;
	e = (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0] : e;
	if (typeof e.pageX == "number") {
		x = e.pageX;
	}
	else if (typeof e.clientX == "number") {
		x = e.clientX + getScrollX();
	}
	return x;
}

DEvent.getPageY = function(e) {
	var y = 0;
	e = (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0] : e;
	if (typeof e.pageY == "number") {
		y = e.pageY;
	}
	else if (typeof e.clientY == "number") {
		y = e.clientY + getScrollY();
	}
	return y;
}

DEvent.isMouseEvent = function(e) {
	return e.type.startsWith('mouse');
}

DEvent.isTouchEvent = function(e) {
	return !!e.touches;
}

DEvent.isOneTouchEvent = function(e) {
	return !!e.touches && e.touches.length == 1;
}

/*	Event.ALT_MASK is 1
	Event.CONTROL_MASK is 2
	Alt GR is 3 - it is a combination of the ctrl key and the alt key held down simultaneously.
	Event.SHIFT_MASK is 4
	CTRL + SHIFT is 6
	In IE and Opera the ctrlKey property is true when Alt GR is held down.	*/
DEvent.isAltDown = function(e) {
	if (e.modifiers) {
		return (e.modifiers == Event.ALT_MASK);
	}
	return (e.altKey === true);
}

/** The meta key is the APPLE key in Mac OS	*/
DEvent.isMetaDown = function(e) {
	if (e.modifiers) {
		return (e.modifiers == Event.META_MASK);
	}
	return (e.metaKey === true);
}

DEvent.isCtrlDown = function(e) {
	if (e.modifiers) {
		return (e.modifiers == Event.CONTROL_MASK);
	}
	if (dLib.ua.isMac) {
		return DEvent.isMetaDown(e);
	}
	return (e.ctrlKey === true);
}

DEvent.isShiftDown = function(e) {
	if (e.modifiers) {
		return (e.modifiers == Event.SHIFT_MASK);
	}
	return (e.shiftKey === true);
}

/** Synthetic events	*/
DEvent.TYPE_HTML_EVENTS = "HTMLEvents";
DEvent.TYPE_UI_EVENTS = "UIEvents";
DEvent.TYPE_KEY_EVENTS = "KeyEvents"; // is not part of the W3C DOM (yet) - some browsers (like Chrome, Safari and Konqueror) supports the KeyboardEvent
DEvent.TYPE_MOUSE_EVENTS = "MouseEvents";
DEvent.syntheticEvents = [DEvent.TYPE_HTML_EVENTS, DEvent.TYPE_UI_EVENTS, DEvent.TYPE_KEY_EVENTS, DEvent.TYPE_MOUSE_EVENTS]; // legal values + KeyEvents - actually other values are legal in Opera and Firefox, but not in Safari and Konqueror

/** Cross-browser method to create a synthetic event (see DocumentEvent.createEvent in the DOM).	*/
DEvent.create = function(eventType) {
	var e = null;
	if (typeof eventType != "string" || eventType == "") {
		eventType = DEvent.TYPE_HTML_EVENTS;
	} else {
		var found = false;
		for (var i = 0, l = DEvent.syntheticEvents.length; i < l; i++) {
			if (eventType == DEvent.syntheticEvents[i]) {
				found = true;
				break;
			}
		}
		if (!found) {
			eventType = DEvent.TYPE_HTML_EVENTS;
		}
	}
	if (eventType == DEvent.TYPE_KEY_EVENTS) {
		if (typeof KeyEvent == "undefined") {
			eventType = (typeof KeyboardEvent != "undefined") ?	"KeyboardEvent" : DEvent.TYPE_HTML_EVENTS;
		}
	}
	if (document.createEvent) {
		e = document.createEvent(eventType);
	}
	else if (document.createEventObject) {
		e = document.createEventObject();
	}
	return e;
}

/*	Cross-browser method to initialize a synthetic event (is not necessary in the MS DOM Event Model).
	The args object can contain any of the following properties depending on which type of event you're creating:
	view, bubbles, cancelable, view, detail, screenX, screenY, clientX, clientY, ctrlKey, altKey, shiftKey, metaKey,
	button, relatedTarget, keyCode, charCode	*/
DEvent.init = function(e, eventType, args) {
	if (e && typeof eventType == "string" && eventType) {
		eventType = eventType.toLowerCase();
		if (eventType.indexOf('on') == 0) {
			eventType = eventType.substr(2);
		}
		args = Object.configure(args, {
			bubbles: true,
			cancelable: true,
			view: window
		});
		if (eventType === "keypress" && typeof args["keyCode"] == "number" && !("charCode" in args)) {
			args["charCode"] = args["keyCode"];
		}
		var initialized = false;
		try {
			if (e.initMouseEvent) {
				e.initMouseEvent(eventType, args["bubbles"], args["cancelable"], args["view"], args["detail"], args["screenX"], args["screenY"], args["clientX"], args["clientY"], args["ctrlKey"], args["altKey"], args["shiftKey"], args["metaKey"], args["button"], args["relatedTarget"]);
			}
			else if (e.initKeyEvent) {
				e.initKeyEvent(eventType, args["bubbles"], args["cancelable"], args["view"], args["ctrlKey"], args["altKey"], args["shiftKey"], args["metaKey"], args["keyCode"], args["charCode"]);
			}
			else if (e.initKeyboardEvent) {
				e.initKeyboardEvent(eventType, args["bubbles"], args["cancelable"], args["view"], args["ctrlKey"], args["altKey"], args["shiftKey"], args["metaKey"], args["keyCode"], args["charCode"]);
			}
			else if (e.initUIEvent) {
				e.initUIEvent(eventType, args["bubbles"], args["cancelable"], args["view"], args["detail"]);
			} else { // IE goes here
				Object.extend(e, args);
			}
			initialized = true;
		}
		catch (err) { // Opera goes here
			Object.extend(e, args);
		}
		if (!initialized && e.initEvent) {
			e.initEvent(eventType, args["bubbles"], args["cancelable"]);
		}
	}
}

/* Cross-browser method to invoke possible event handler for a synthetic event (see EventTarget.dispatchEvent in the DOM).	*/
DEvent.dispatch = function(target, e, eventType) {
	if (e && typeof eventType == "string" && eventType && target) {
		if (target.dispatchEvent) {
			target.dispatchEvent(e);
		}
		else if (target.fireEvent) {
			eventType = eventType.toLowerCase();
			if (eventType.indexOf('on') != 0) {
				eventType = 'on' + eventType;
			}
			target.fireEvent(eventType, e);
		}
	}
}

/*	You should use this method for creating, initializing and dispatching (firing) the event.
	Example:
	var form = document.getElementById('idOfYourFormTag');
	var args = {bubbles: false}; // the submit event doesn't bubble
	DEvent.initAndDispatch(form, "submit", args); // the form won't be submitted - probably due to security reasons (it will in Opera 10.63 though)
	Another example:
	var button = document.getElementById('idOfYourButton');
	var args = {button: 0}; // 0 indicates left mouse button
	DEvent.initAndDispatch(button, "click", args);
	A third example (only works in FF, not in FF4b7 though, throws error in Opera 10.63):
	var input = document.getElementById('idOfYourInputTag');
	var args = {keyCode: 71, shiftKey: true}; // charCode (if not specified) is automatically set equal to the keyCode for keypress events
	DEvent.initAndDispatch(input, "keypress", args);
	*/
DEvent.initAndDispatch = function(target, eventType, args) {
	var sEventType = DEvent.TYPE_HTML_EVENTS;
	if (eventType.indexOf("on") == 0) {
		eventType = eventType.substring(2);
	}
	if (eventType.indexOf("mouse") == 0 || eventType.indexOf("click") > -1) {
		sEventType = DEvent.TYPE_MOUSE_EVENTS;
	}
	else if (eventType.indexOf("key") == 0) {
		sEventType = DEvent.TYPE_KEY_EVENTS;
	}
	else if (eventType.indexOf("DOM") == 0 || eventType === "submit") {
		sEventType = DEvent.TYPE_UI_EVENTS;
	}
	var se = DEvent.create(sEventType);
	DEvent.init(se, eventType, args);
	DEvent.dispatch(target, se, eventType);
}

DEvent.prototype.toString = function() {
	return "[object " + this.constructor.getName() + "] " + (this.event ? this.event.type : "N/A");
}

DEvent.prototype.stopPropagation = function() {
	DEvent.stopPropagation(this.event);
	return this;
}

DEvent.prototype.preventDefault = function() {
	DEvent.preventDefault(this.event);
	return this;
}

DEvent.prototype.getTarget = function() {
	return g(DEvent.getTarget(this.event));
}

DEvent.prototype.getRelatedTarget = function() {
	return g(DEvent.getRelatedTarget(this.event));
}

DEvent.prototype.getPageX = function() {
	return DEvent.getPageX(this.event);
}

DEvent.prototype.getPageY = function() {
	return DEvent.getPageY(this.event);
}

DEvent.prototype.isAltDown = function() {
	return DEvent.isAltDown(this.event);
}

// The meta key is the APPLE key in MacOS
DEvent.prototype.isMetaDown = function() {
	return DEvent.isMetaDown(this.event);
}

DEvent.prototype.isCtrlDown = function() {
	return DEvent.isCtrlDown(this.event);
}

DEvent.prototype.isShiftDown = function() {
	return DEvent.isShiftDown(this.event);
}

DEvent.prototype.isMouseEvent = function() {
	return DEvent.isMouseEvent(this.event);
}

DEvent.prototype.isTouchEvent = function() {
	return DEvent.isTouchEvent(this.event);
}

DEvent.prototype.isOneTouchEvent = function() {
	return DEvent.isOneTouchEvent(this.event);
}

DEvent.prototype.isOnlyModifier = function(modifier) {
	var e = this.event, modsDown = ["Shift", "Ctrl", "Alt", "Meta"].filter(function(mod) {
		return DEvent["is" + mod + "Down"](e);
	});
	return modsDown.length == 1 && modsDown[0] === modifier;
}

DEvent.prototype.isShiftOnly = function() {
	return this.isOnlyModifier("Shift");
}

DEvent.prototype.isAltOnly = function() {
	return this.isOnlyModifier("Alt");
}

DEvent.prototype.isCtrlOnly = function() {
	return this.isOnlyModifier("Ctrl");
}

DEvent.prototype.isMetaOnly = function() {
	return this.isOnlyModifier("Meta");
}

function DKeyEvent(event) {
	DKeyEvent.superConstructor.apply(this, [event]);
	this.keyCode = DKeyEvent.getKeyCode(event);
}

DKeyEvent.inheritFrom(DEvent);

/*	The value of the which/keyCode property will not necessarily be the same onkeypress as onkeydown and onkeyup!
	In Mozilla the value of keyCode property is saved in the charCode property (and the value of the keyCode
	property is set to 0), if the event	type is keypress.	*/
DKeyEvent.getKeyCode = function(e) {
	return e.charCode || e.keyCode || e.which || 0;
}

/*	PrintScreen can only be caught by the keyup event in Firefox. Cannot be caught in Opera and IE.
	NumLock, CapsLock and ScrollLock cannot be caught by the keypress event.	*/
DKeyEvent.nonPrintableKeys = {
	_8: "backspace", _9: "tab", _13: "return", _16: "shift", _17: "ctrl", _19: "pause", _18: "alt", _20: "capslock",
	_27: "escape", _33: "pageup", _34: "pagedown", _35: "end", _36: "home", _37: "left", _38: "up",
	_39: "right", _40: "down", _44: "printscreen", _45: "insert", _46: "delete", _144: "numlock", _145: "scrolllock",
	_63232: "up", _63233: "down", _63234: "left", _63235: "right", _63272: "delete" // Safari keycodes
}

DKeyEvent.functionKeys = {
	_112: "f1", _113: "f2", _114: "f3", _115: "f4", _116: "f5", _117: "f6", _118: "f7", // collides with the letters from p to v on keypress, but not on keydown and keyup
	_119: "f8", _120: "f9", _121: "f10", _122: "f11", _123: "f12" // collides with the letters from w to z on keypress, but not on keydown and keyup
}

/*	Should be invoked on keydown because the key code collides with lowercase characters for the keypress event.
	But even on keydown the key code collides with lowercase characters in older versions of Safari.	*/
DKeyEvent.isFunctionKey = function(e) {
	var key = DKeyEvent.getKeyCode(e);
	if (DKeyEvent.functionKeys['_' + key]) {
		if (dLib.ua.isSafari) { // TODO: test in Safari 3+
			var ch = String.fromCharCode(key);
			return (ch != ch.toLowerCase());
		}
		return true;
	}
	return false;
}

// if you wanna detect function keys don't use the keypress event
DKeyEvent.isPrintableKey = function(e) {
	var key = DKeyEvent.getKeyCode(e);
	var isNonPrintableKey = !!DKeyEvent.nonPrintableKeys['_' + key];
	if (e.type == 'keypress' || isNonPrintableKey) {
		return !isNonPrintableKey;
	}
	return !DKeyEvent.functionKeys['_' + key];
}

// if you wanna detect function keys don't use the keypress event
DKeyEvent.isNonPrintableKey = function(e) {
	return !DKeyEvent.isPrintableKey(e);
}

DKeyEvent.isCapsLockKey = function(e) {
	return (DKeyEvent.getKeyCode(e) == 20);
}

DKeyEvent.isLeftArrowKey = function(e) {
	var key = DKeyEvent.getKeyCode(e);
	return (key == 37 || key == 63234);
}

DKeyEvent.isRightArrowKey = function(e) {
	var key = DKeyEvent.getKeyCode(e);
	return (key == 39 || key == 63235);
}

DKeyEvent.isUpArrowKey = function(e) {
	var key = DKeyEvent.getKeyCode(e);
	return (key == 38 || key == 63232);
}

DKeyEvent.isDownArrowKey = function(e) {
	var key = DKeyEvent.getKeyCode(e);
	return (key == 40 || key == 63233);
}

DKeyEvent.isArrowKey = function(e) {
	var key = DKeyEvent.getKeyCode(e);
	return ((key >= 37 && key <= 40) || (key >= 63232 && key <= 63235));
}

DKeyEvent.prototype.getKeyCode = function() {
	return DKeyEvent.getKeyCode(this.event);
}

DKeyEvent.prototype.isPrintableKey = function() {
	return DKeyEvent.isPrintableKey(this.event);
}

DKeyEvent.prototype.isCapsLockKey = function() {
	return DKeyEvent.isCapsLockKey(this.event);
}

DKeyEvent.prototype.isNonPrintableKey = function() {
	return DKeyEvent.isNonPrintableKey(this.event);
}

DKeyEvent.prototype.isFunctionKey = function() {
	return DKeyEvent.isFunctionKey(this.event);
}

DKeyEvent.prototype.isLeftArrowKey = function() {
	return DKeyEvent.isLeftArrowKey(this.event);
}

DKeyEvent.prototype.isRightArrowKey = function() {
	return DKeyEvent.isRightArrowKey(this.event);
}

DKeyEvent.prototype.isUpArrowKey = function() {
	return DKeyEvent.isUpArrowKey(this.event);
}

DKeyEvent.prototype.isDownArrowKey = function() {
	return DKeyEvent.isDownArrowKey(this.event);
}

DKeyEvent.prototype.isArrowKey = function() {
	return DKeyEvent.isArrowKey(this.event);
}

function DMouseEvent(event) {
	DMouseEvent.superConstructor.apply(this, [event]);
}

DMouseEvent.inheritFrom(DEvent);

/*	Returns: 1 = left; 2 = middle; 3 = right
	In IE and Safari e.button may be 1 (older versions), when left clicking.
	In Firefox and Opera e.button is 1, when middle-clicking (as expected).
	Note that e.button is 2, when right-clicking in IE.
	Also note that e.button is 4, when middle-clicking in IE. 	*/
DMouseEvent.getButton = function(e) { // TODO: test on Mac
	// the expression (e.button & x) is just shorthand for (e.button && e.button === x)
	var button = e.which || (e.button & 1 ? 1 : (e.button & 2 ? 3 : (e.button & 4 ? 2 : 1))); // default value is 1 in order to mimic the which property
	return button;
}

DMouseEvent.isLeftButtonDown = function(e) {
	return (DMouseEvent.getButton(e) == 1);
}

DMouseEvent.isMiddleButtonDown = function(e) {
	return (DMouseEvent.getButton(e) == 2);
}

DMouseEvent.isRightButtonDown = function(e) {
	return (DMouseEvent.getButton(e) == 3);
}

DMouseEvent.prototype.getButton = function() {
	return DMouseEvent.getButton(this.event);
}

DMouseEvent.prototype.isLeftButtonDown = function() {
	return DMouseEvent.isLeftButtonDown(this.event);
}

DMouseEvent.prototype.isRightButtonDown = function() {
	return DMouseEvent.isRightButtonDown(this.event);
}

DMouseEvent.prototype.isMiddleButtonDown = function() {
	return DMouseEvent.isMiddleButtonDown(this.event);
}

function DNode(node, config) {
	this.node = node;
	this.config = Object.configure(config, this.constructor.defaultConfig);
}

DNode.defaultConfig = {};

DNode.purge = function(node, deep) {
	var arr = node.attributes;
	if (arr) {
		arr.forEach(function(entry) {
			if (typeof node[entry.name] === 'function') {
				node[entry.name] = null;
			}
		});
	}
	arr = (typeof deep != "boolean" || deep) ? node.childNodes : null;
	if (arr) {
		for (var i = 0, l = arr.length; i < l; i++) {
			DNode.purge(node.childNodes[i]);
		}
	}
}

DNode.getOwnerDocument = function(node) {
	if (node) {
		return node.ownerDocument || node.document || node; // if node === document just return node itself
	}
	return null;
}

DNode.getAncestorByTagNames = function(el, tagNames) {
	tagNames = (typeof tagNames == "string") ? tagNames.toLowerCase().split(/\s+/) : tagNames;
	dLib.assert(Array.isArray(tagNames), new TypeError("DNode.getAncestorByTagNames: Unable to convert tagNames to an array!"))
	tagNames = tagNames.map(function(tagName) { return (typeof tagName == "string") ? tagName.toLowerCase() : tagName; });
	if (tagNames) {
		while (el && el.tagName) {
			if (tagNames.contains(el.tagName.toLowerCase())) {
				return el;
			}
			el = el.parentNode;
		}
	}
	return null;
}

DNode.isDescendantOf = function(node, ancestor) {
	var pNode = (node instanceof DNode) ? node.node.parentNode : node.parentNode;
	ancestor = (ancestor instanceof DNode) ? ancestor.node : ancestor;
	while (pNode) {
		if (pNode === ancestor) {
			return true;
		}
		pNode = pNode.parentNode;
	}
	return false;
}

DNode.remove = function(node) {
	node = (node instanceof DNode) ? node.node : node;
	var pNode = node.parentNode;
	if (pNode) {
		return pNode.removeChild(node);
	}
	return null;
}

DNode.insertAfter = function(newNode, node) {
	node = (node instanceof DNode) ? node.node : node;
	newNode = (newNode instanceof DNode) ? newNode.node : newNode;
	var pNode = node.parentNode;
	if (pNode) {
		var nxt = node.nextSibling;
		if (nxt) {
			return pNode.insertBefore(newNode, nxt);
		}
		return pNode.appendChild(newNode);
	}
	return null;
}

// Only works for XML nodes in IE, not supported by Konqueror
DNode.selectNodes = function(xpathExp, node) {
	if (typeof xpathExp == "string") {
		node = node || document.documentElement;
		var doc = node.ownerDocument || node;
		var isXML = (doc.documentElement.tagName.toLowerCase() != "html");
		if (dLib.ua.isIE && isXML) {
			doc.setProperty('SelectionLanguage', 'XPath');
			var ns = '', attrs = doc.documentElement.attributes;
			for (var i = 0, l = attrs.length; i < l; i++) {
				var attr = attrs[i];
				if (attr.nodeName.startsWith("xmlns:")) {
					ns += ' ' + attr.nodeName + '="' + attr.nodeValue + '"';
				}
			}
			if (ns) {
				doc.setProperty('SelectionNamespaces', ns.substring(1));
			} else {
				doc.setProperty('SelectionNamespaces', 'xmlns="http://www.w3.org/XML/1998/namespace"');
			}
			return node.selectNodes(xpathExp);
		}
		if (node.selectNodes) { // Opera 9 has native methods selectNodes and selectSingleNode!
			return node.selectNodes(xpathExp);
		}
		if (typeof XPathResult != "undefined" && typeof doc.createNSResolver != "undefined") { // use document.evaluate and document.createNSResolver and instead of XPathEvaluator (wider support)
			var nsResolver = doc.createNSResolver(doc.documentElement);
			var result = doc.evaluate(xpathExp, node, nsResolver, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
			var nodes = [];
			if (result) {
				var element;
				while ((element = result.iterateNext()) != null) {
					nodes.push(element);
				}
			}
			return nodes;
		}
	}
	return [];
}

// Only works for XML nodes in IE, not supported by Konqueror
DNode.selectSingleNode = function(xpathExp, node) {
	if (typeof xpathExp == "string") {
		node = node || document.documentElement;
		var doc = node.ownerDocument || node;
		var isXML = (doc.documentElement.tagName.toLowerCase() != "html");
		if (dLib.ua.isIE && isXML) {
			doc.setProperty('SelectionLanguage', 'XPath');
			var ns = '';
			for (var i = 0, l = doc.documentElement.attributes.length; i < l; i++) {
				var attr = doc.documentElement.attributes[i];
				if (attr.nodeName.startsWith("xmlns:")) {
					ns += ' ' + attr.nodeName + '="' + attr.nodeValue + '"';
				}
			}
			if (ns) {
				doc.setProperty('SelectionNamespaces', ns.substring(1));
			} else {
				doc.setProperty('SelectionNamespaces', 'xmlns="http://www.w3.org/XML/1998/namespace"');
			}
			return node.selectSingleNode(xpathExp);
		}
		if (node.selectSingleNode) { // Opera 9 has native methods selectNodes and selectSingleNode!
			return node.selectSingleNode(xpathExp);
		}
		if (typeof XPathResult != "undefined" && typeof doc.createNSResolver != "undefined") {
			var nsResolver = doc.createNSResolver(doc.documentElement);
			var result = doc.evaluate(xpathExp, node, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
			if (result) {
				return result.singleNodeValue;
			}
		}
	}
	return null;
}

/*	XMLSerializer.serializeToString(nodeOrTag) is not good enough.
	It uses upper-case letters for HTML tags.
	*/
DNode.serialize = function(node) {
	function isEndTagForbidden() {
		if (isHTML) {
			var tagNames = ["link", "meta", "input", "img"];
			for (var ix = 0, l = tagNames.length; ix < l; ix++) {
				if (lName == tagNames[ix]) {
					return true;
				}
			}
		}
		return false;
	}
	if (dLib.ua.isIE && node.nodeType == 3) { // Cannot add a property to a text node in IE
		return node.nodeValue;
	}
	var isHTML = (typeof node.innerHTML == "string" || (node.nodeType == 9 && !!node.documentElement && node.documentElement.nodeName.toLowerCase() == "html") || (!!node.ownerDocument && !!node.ownerDocument.documentElement && node.ownerDocument.documentElement.nodeName.toLowerCase() == "html"));
	var nName = node.nodeName;
	var lName = nName.toLowerCase();
	var str = '', i, l;
	switch (node.nodeType) {
		case 1: //Node.ELEMENT_NODE
			if (!isHTML && window.XMLSerializer) {
				str += new XMLSerializer().serializeToString(node);
				break;
			}
			str = '<' + (isHTML ? lName : nName); // HTML/XHTML should be in lower case
			// IE6 discards the style attribute in attributes. Node.getAttribute("style") equals HTMLElement.style (an object, not a string)
			for (i = 0, l = node.attributes.length; i < l; i++) {
				var attr = node.attributes[i];
				if (attr.name && attr.value && attr.value != "null" && attr.value.indexOf("function") != 0) { // this is necessary in IE
					// IE6 adds proprietary attributes for HTMLElements, which needs to be filtered out
					if (isHTML && typeof node.outerHTML == "string") {
						var index = node.outerHTML.indexOf('>');
						if (index > -1) {
							var startTag = node.outerHTML.substring(0, index);
							if (startTag.indexOf(attr.name.toLowerCase()) == -1) {
								continue;
							}
						}
					}
					str += ' ' + (isHTML ? attr.name.toLowerCase() : attr.name) + '="' + attr.value + '"';
				}
			}
			var style = isHTML ? node.getAttribute("style") : null;
			if (style && style.cssText) { // IE6 goes here, not Opera, nor Firefox. Note that IE and Opera may convert the CSS property values specified in the style attribute.
				str += ' style="' + style.cssText.toLowerCase() + '"';
			}
			if (isEndTagForbidden()) {
				str += (node.ownerDocument && node.ownerDocument.doctype && node.ownerDocument.doctype.publicId && node.ownerDocument.doctype.publicId.indexOf("XHTML") == -1) ? '>' : ' \/>';
			} else {
				str += '>';
				for (i = 0, l = node.childNodes.length; i < l; i++) {
					str += DNode.serialize(node.childNodes[i]);
				}
				str += '<\/' + (isHTML ? lName : nName) + '>';
			}
			break;
		case 2: //Node.ATTRIBUTE_NODE
			// this case is handled by the element case since the output depends on the parent element node
			break;
		case 3: //Node.TEXT_NODE
			str = node.nodeValue;
			break;
		case 4: //Node.CDATA_SECTION_NODE
			str = '<![CDATA[' + node.nodeValue + ']]>';
			break;
		case 5: //Node.ENTITY_REFERENCE_NODE
			break;
		case 6: //Node.ENTITY_NODE
			break;
		case 7: //Node.PROCESSING_INSTRUCTION_NODE
			// Only IE6 seems to go here, but the nodeName 'xml' is not included in nodeValue. Furthermore this type of node is encountered AFTER the document node!?
			str = '<?xml ' + node.nodeValue + '?>';
			break;
		case 8: //Node.COMMENT_NODE
			if (node.nodeValue.indexOf("CTYPE") == 0) { // IE6 seems to consider <!xx xx> as a HTML comment, where x can be (almost) any character
				str += '<!DO' + node.nodeValue + 'd">';
			} else {
				str = '<!--' + node.nodeValue + '-->';
			}
			break;
		case 9: //Node.DOCUMENT_NODE
			if (window.XMLSerializer && !isHTML) {
				return new XMLSerializer().serializeToString(node);
			}
			if (isHTML && dLib.ua.isOpera && node.doctype) {
				str += '<!DOCTYPE ' + node.doctype.name + ' PUBLIC "' + node.doctype.publicId + '" "' + node.doctype.systemId + '">';
			}
			for (i = 0, l = node.childNodes.length; i < l; i++) {
				str += DNode.serialize(node.childNodes[i]);
			}
			break;
		case 10: //Node.DOCUMENT_TYPE_NODE
			// Opera 9.02 does not support this node type, but it does support the doctype property of the document node, so we handle it there for every browser
			break;
		case 11: //Node.DOCUMENT_FRAGMENT_NODE
			for (i = 0, l = node.childNodes.length; i < l; i++) {
				str += DNode.serialize(node.childNodes[i]);
			}
			break;
		case 12: //Node.NOTATION_NODE
			break;
		default:
			break;
	}
	return str;
}

DNode.prototype.toString = function() {
	var n = this.node;
	return "[object " + this.constructor.getName() + "] " + (n ? (n.getAttribute('id') || n.getAttribute('name') || n.getAttribute('type') || n.nodeName) : "N/A");
}

DNode.prototype.purge = function(deep) {
	DNode.purge(this.node, deep);
}

DNode.prototype.doThis = function(fn) {
	fn.apply(this, [this.node]);
	return this;
}

DNode.prototype.selectNodes = function(xpathExp) {
	return DNode.selectNodes(xpathExp, this.node);
}

DNode.prototype.selectSingleNode = function(xpathExp) {
	return DNode.selectSingleNode(xpathExp, this.node);
}

DNode.prototype.isDescendantOf = function(node) {
	return DNode.isDescendantOf(this.node, node);
}

DNode.prototype.getAncestorByTagNames = function(tagNames) {
	return DNode.getAncestorByTagNames(this.node, tagNames);
}

DNode.prototype.appendChild = function(child) {
	this.node.appendChild(child);
	return this;
}

DNode.prototype.parentElement = function() {
	var pNode = this.node.parentNode;
	return pNode ? g(pNode) : null;
}

DNode.prototype.normalize = function() {
	this.node.normalize();
	return this;
}

DNode.prototype.remove = function() {
	return DNode.remove(this);
}

DNode.prototype.insertAfter = function(node) {
	return DNode.insertAfter(node, this);
}

DNode.prototype.insertBefore = function(newNode) {
	newNode = (newNode instanceof DNode) ? newNode.node : newNode;
	var pNode = this.node.parentNode || this.getOwnerDocument();
	return pNode.insertBefore(newNode, this.node);
}

DNode.prototype.getOwnerDocument = function() {
	return DNode.getOwnerDocument(this.node);
}

/*	XMLSerializer.serializeToString(nodeOrTag) is not good enough.
	It uses upper-case letters for HTML tags.	*/
DNode.prototype.serialize = function() {
	return DNode.serialize(this.node);
}

function DDocument(doc, config) {
	this.document = doc;
	DDocument.superConstructor.apply(this, [this.document, config]);
}

DDocument.defaultConfig = Object.inheritFrom(DNode.defaultConfig);

DDocument.inheritFrom(DNode);

DDocument.prototype.toString = function() {
	return '[object DDocument] ' + document.URL;
}

/*
How it works:
if prefix in tagName:
	find corresponding namespaceURI and	delegate to getElementsByTagNameNS
else:
	return list of all elements with the tagName (default behavior in standard browsers, but not IE6+7 and FF3 (not standard any longer?))	*/
DDocument.getElementsByTagName = function(doc, tagName) {
	var index = tagName.indexOf(":");
	if (index > -1) { // prefix in tagName
		var localTagName = tagName.substring(index + 1);
		var prefix = tagName.substring(0, index);
		if (dLib.ua.isIE) {
			return doc.getElementsByTagName(tagName);
		}
		// get namespaceURI
		var uri = "";
		var attrs = doc.documentElement.attributes;
		for (var i = 0, l = attrs.length; i < l; i++) {
			var attr = attrs[i];
			if (attr.nodeName.endsWith(prefix)) {
				uri = attr.nodeValue;
				break;
			}
		}
		if (uri) {
			return DDocument.getElementsByTagNameNS(doc, uri, localTagName);
		}
	} else { // no prefix in tagName
		var list = doc.getElementsByTagName(tagName); // IE and FF3 returns a empty list (HTMLCollection)
		if (list.length == 0 && doc.documentElement) {
			list = [];
			var attrs = doc.documentElement.attributes, target = "xmlns:";
			if (attrs.length > 0) {
				for (var i = 0, l = attrs.length; i < l; i++) {
					var attr = attrs[i];
					var idx = attr.nodeName.indexOf(target);
					if (idx == 0) {
						var prefix = attr.nodeName.substring(idx + target.length);
						// IE and FF3 returns a non-empty list (HTMLCollection)
						list.addAll(doc.getElementsByTagName(prefix + ":" + tagName));
					}
				}
			}
			else if (doc.documentElement.prefix) {
				list.addAll(doc.getElementsByTagName(doc.documentElement.prefix + ":" + tagName));
			}
		}
		return list;
	}
	return [];
}

/*
How it works:
	- prefix in tagName not allowed
	- standard browsers just calls document.getElementsByTagNameNS with unaltered arguments
	- IE claims to support getElementsByTagNameNS, but it fails and you can't query the method for its existence!
	- this method detects the prefix associated with the given namespaceURI and delegates to getElementsByTagName for IE.	*/
DDocument.getElementsByTagNameNS = function(doc, namespaceURI, localTagName) {
	if (dLib.ua.isIE) {
		if (doc.documentElement) {
			if (namespaceURI == "*") {
				return DDocument.getElementsByTagName(doc, localTagName);
			}
			if (namespaceURI != doc.documentElement.namespaceURI) {
				var prefix = "", attrs = doc.documentElement.attributes;
				for (var i = 0, l = attrs.length; i < l; i++) {
					var attr = attrs[i];
					if (attr.value == namespaceURI) {
						var index = attr.nodeName.indexOf(":");
						prefix = attr.nodeName.substring(index + 1);
						break;
					}
				}
				var sep = (prefix) ? ":" : "";
				return doc.getElementsByTagName(prefix + sep + localTagName);
			}
			var pfx = (localTagName.indexOf(":") == -1) ? doc.documentElement.prefix : "";
			if (pfx) {
				return doc.getElementsByTagName(pfx + ":" + localTagName);
			}
			return doc.getElementsByTagName(localTagName); // can't query getElementsByTagName in IE6
		}
	}
	if (doc.getElementsByTagNameNS) {
		return doc.getElementsByTagNameNS(namespaceURI, localTagName);
	}
	return [];
}

DDocument.getDefaultView = function(doc) {
	return doc.defaultView || doc.parentWindow;
}

/*	The property document.compatMode is 'CSS1Compat' if there is a doctype tag with an url to a dtd.
	It is 'BackCompat' (or 'QuirksMode' in Opera) otherwise. Opera and Mozilla also supports this property.	*/
DDocument.isStrictMode = function(doc) {
	return (typeof doc.compatMode == "string" && doc.compatMode == "CSS1Compat");
}

DDocument.getViewportElement = function(doc) {
	if (DDocument.isStrictMode(doc) && doc.documentElement) {
		return doc.documentElement; // returns the HTML tag
	}
	return doc.body; // returns the BODY tag
}

DDocument.getOffsetWidth = function(doc) {
	return DDocument.getViewportElement(doc).offsetWidth;
}

DDocument.getOffsetHeight = function(doc) {
	return DDocument.getViewportElement(doc).offsetHeight;
}

/*	Sets the domain to the parent domain - any subdomain is removed.
	This means that 'www.company.com' becomes 'company.com'.	*/
DDocument.setParentDomain = function(doc) {
	var win = DDocument.getDefaultView(doc);
	var arr = win.location.hostname.split(".");
	if (arr.length >= 2) { // important to set domain when length is 2, not just > 2 - otherwise access is denied!
		var str = "";
		for (var l = arr.length, i = l - 2; i < l; i++) {
			str += "." + arr[i];
		}
		doc.domain = str.substring(1);
	}
}

DDocument.prototype.getElementsByTagName = function(tagName) {
	return DDocument.getElementsByTagName(this.document, tagName);
}

DDocument.prototype.getElementsByTagNameNS = function(namespaceURI, localTagName) {
	return DDocument.getElementsByTagNameNS(this.document, namespaceURI, localTagName);
}

DDocument.prototype.createElementNS = function(nsPrefix, tagName) {
	if (document.createElementNS) {
		var nsURI = nsPrefix; // TODO: Finish
		return this.document.createElementNS(nsURI, tagName);
	}
	return null;
}

DDocument.prototype.addEventListener = function(eventType, handler, doCapture) {
	return dLib.event.add(this.document, eventType, handler, doCapture);
}

DDocument.prototype.on = function(eventTypes, handler, doCapture) {
	var types = eventTypes.trim().split(/\s+/);
	for (var i = 0, l = types.length; i < l; i++) {
		this.addEventListener(types[i], handler, doCapture);
	}
	return this;
}

DDocument.prototype.removeEventListener = function(eventType, handler, doCapture) {
	dLib.event.remove(this.document, eventType, handler, doCapture);
}

DDocument.prototype.off = function(eventTypes, handler, doCapture) {
	var types = eventTypes.trim().split(/\s+/);
	for (var i = 0, l = types.length; i < l; i++) {
		this.removeEventListener(types[i], handler, doCapture);
	}
	return this;
}

DDocument.prototype.removeOn = DDocument.prototype.off;

DDocument.prototype.isStrictMode = function() {
	return DDocument.isStrictMode(this.document);
}

DDocument.prototype.getViewportElement = function() {
	return DDocument.getViewportElement(this.document);
}

DDocument.prototype.getOffsetWidth = function() {
	return DDocument.getOffsetWidth(this.document);
}

DDocument.prototype.getOffsetHeight = function() {
	return DDocument.getOffsetHeight(this.document);
}

DDocument.prototype.setParentDomain = function() {
	DDcoument.setParentDomain(this.document);
}

DDocument.prototype.query = function(expr) {
	return DElementList.query(expr, this.document);
}

DDocument.prototype.getDefaultView = function() {
	return DDocument.getDefaultView(this.document);
}

DDocument.prototype.addDOMReadyListener = function(listener) {
	return dLib.event.addDOMReady(listener, this.document);
}

DDocument.prototype.removeDOMReadyListener = function(listener) {
	dLib.event.removeDOMReady(listener, this.document);
	return this;
}

function DElement(element, config) {
	this.element = element;
	DElement.superConstructor.apply(this, [this.element, config]);
}

DElement.defaultConfig = Object.configure({
	useIframe: dLib.ua.isIE_6,
	iframeSource: 'javascript:false' // The value 'about:blank' causes a prompt to the user when using HTTPS, but 'javascript:false' does not. NOTE: Do NOT use '//:'! It will cause a violation of the Same Origin Policy!
}, DNode.defaultConfig);

DElement.inheritFrom(DNode);

// Note that cascaded style is NOT the same as computed style! See http://erik.eae.net/archives/2007/07/27/18.54.15/
DElement.getComputedStyle = function(element, pseudo, autoCorrect) {
	// due to bugs in IE9beta's implementation of the computed style - returns '0px' when it should return 'auto' - we check for support for runtime style before computed style
	if (element.currentStyle && window.ActiveXObject) { // IE's cascaded styles object
		return element.currentStyle;
	}
	var view = DElement.getDefaultView(element);
	return (view && view.getComputedStyle) ? view.getComputedStyle(element, pseudo) : null;
}

DElement.getDefaultView = function(element) {
	var doc = DNode.getOwnerDocument(element);
	return doc ? doc.parentWindow || doc.defaultView : null;
}

// works in FF on PC and mobile devices, but only works on PC for Safari, Chrome and Opera
DElement.requestFullScreen = function(element) {
	element = element || document.documentElement;
	var methodNames = ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen', 'webkitEnterFullScreen', 'oRequestFullscreen', 'mozRequestFullScreen'];
	for (var i = 0, l = methodNames.length; i < l; i++) {
		var method = methodNames[i];
		if (typeof element[method] == 'function') {
			element[method].apply(element, []);
			break;
		}
	}
}

DElement.css = function(element, name, value) {
	function set(el, n, v) {
		switch (n) {
			case "opacity":
				DElement.setOpacity(el, v);
				break;
			default:
				el.style[dLib.util.translateCSSProperty(n)] = v;
				break;
		}
	}
	if (name) {
		if (typeof name == "object") {
			for (var p in name) {
				set(element, p, name[p]);
			}
		} else {
			if (value === undefined) {
				var style = DElement.getComputedStyle(element);
				return style ? style[dLib.util.translateCSSProperty(name)] : '';
			}
			set(element, name, value);
		}
	}
}

// Parses a CSS property to an int
DElement.parseCSS = function(element, prop) {
	prop = dLib.util.translateCSSProperty(prop);
	var value = parseInt(element.style[prop], 10);
	if (isNaN(value)) {
		var style = DElement.getComputedStyle(element);
		value = style ? parseInt(style[prop], 10) : value;
	}
	return value;
}

DElement.getXY = function(element) {
	return [DElement.parseCSS(element, "left"), DElement.parseCSS(element, "top")];
}

DElement.text = function(element, text) {
	if (arguments.length == 1) {
		var txt = element.textContent;
		if (typeof txt == "undefined") {
			txt = element.innerText;
		}
		return txt;
	}
	element.normalize();
	if (element.hasChildNodes()) {
		var n = element.firstChild;
		while (n && n.nodeType != 3) {
			n = n.nextSibling;
		}
		n.nodeValue = text;
	} else {
		element.textContent = text;
		element.innerText = text;
	}
}

/*	Works for (X)HTML elements only, not XML elements	*/
DElement.getAttribute = function(element, name) {
	name = name.toLowerCase();
	var attr = element.getAttribute(name);
	if (typeof attr == "object") {
		switch (name) {
			// IE6+7 returns the style object for the name 'style', not the inline CSS text!! But the style object contains a property called 'cssText', which is what we wan't!
			case "style":
				attr = element.style.cssText;
				break;
			default:
				break;
		}
	}
	return attr;
}

/*	Works for (X)HTML elements only, not XML elements	*/
DElement.setAttribute = function(element, name, value) {
	if (!value) {
		DElement.removeAttribute(element, name);
		return;
	}
	if (typeof value == "boolean") { // disabled, selected, checked and readonly may be given boolean values - convert to string
		value = name;
	}
	element.setAttribute(name, value);
	if (dLib.ua.isIE) {
		if (name === "style") {
			element.style.cssText = value;
		}
		if (name in dLib.util.mapHTML) {
			element[dLib.util.mapHTML[name]] = value;
		}
	}
}

/*	Works for (X)HTML elements only, not XML elements	*/
DElement.removeAttribute = function(element, name) {
	element.removeAttribute(name);
	if (dLib.ua.isIE) {
		if (name == "style") {
			element.style.cssText = null;
		}
		else if (name in dLib.util.mapHTML) {
			element[dLib.util.mapHTML[name]] = null; // tabIndex goes here
			element.removeAttribute(dLib.util.mapHTML[name]); // maxLength goes here
		}
	}
}

DElement.attr = function(element, name, value) {
	var obj = name;
	if (obj) {
		if (typeof obj == "object") {
			for (var p in obj) {
				DElement.setAttribute(element, p, obj[p]);
			}
		} else {
			if (arguments.length == 2 || value === undefined) {
				return DElement.getAttribute(element, name);
			}
			DElement.setAttribute(element, name, value);
		}
	}
}

DElement.create = function(tagName, attr, doc) {
	attr = attr || {};
	if (dLib.ua.isIE_7) { // TODO: Fix/test thoroughly (other properties than name that IE7 has issues with?)
		var p = 'name';
		if (p in attr) {
			tagName = '<' + tagName + ' ' + p + '="' + attr[p] + '">';
		}
	}
	var el = (doc || document).createElement(tagName);
	for (var p in attr) {
		DElement.setAttribute(el, p, attr[p]);
	}
	return el;
}

DElement.append = function(el, htm) {
	var pEl = DElement.create(el.tagName);
	pEl.innerHTML = htm;
	for (var i = 0, l = pEl.childNodes.length; i < l; i++) {
		el.appendChild(pEl.childNodes[i]);
	}
}

DElement.before = function(el, htm) {
	var div = DElement.create('div');
	div.innerHTML = htm;
	for (var i = 0, l = div.childNodes.length; i < l; i++) {
		el.parentNode.insertBefore(div.childNodes[i], el);
	}
}

DElement.nextElementSibling = function(element, i) {
	function nextSibling(n) {
		while ((n = n.nextSibling) != null) {
			if (n.nodeType == 1) {
				return n;
			}
		}
		return null;
	}
	element = (element instanceof DElement) ? element.element : element;
	if (typeof i == "number" && i > 1) {
		for (var x = 0; x < i; x++) {
			element = nextSibling(element);
		}
		return element;
	}
	return nextSibling(element);
}

DElement.nextElement = DElement.nextElementSibling;

DElement.previousElementSibling = function(element, i) {
	function prevSibling(n) {
		while ((n = n.previousSibling) != null) {
			if (n.nodeType == 1) {
				return n;
			}
		}
		return null;
	}
	element = (element instanceof DElement) ? element.element : element;
	if (typeof i == "number" && i > 1) {
		for (var x = 0; x < i; x++) {
			element = prevSibling(element);
		}
		return element;
	}
	return prevSibling(element);
}

DElement.prevElement = DElement.previousElementSibling;

DElement.firstElementChild = function(element) {
	element = (element instanceof DElement) ? element.element : element;
	if (typeof element.firstElementChild == 'object') {
		return element.firstElementChild;
	}
	var node = element.firstChild;
	return (node && node.nodeType != 1) ? DElement.nextElementSibling(node) : node;
}

DElement.firstElement = DElement.firstElementChild;

DElement.lastElementChild = function(element) {
	element = (element instanceof DElement) ? element.element : element;
	if (typeof element.lastElementChild == 'object') {
		return element.lastElementChild;
	}
	var node = element.lastChild;
	return (node && node.nodeType != 1) ? DElement.previousElementSibling(node) : node;
}

DElement.lastElement = DElement.lastElementChild;

DElement.swap = function(a, b) {
	var bParent = b.parentNode;
	var c = DElement.create('div');
	bParent.insertBefore(c, b);
	a.parentNode.replaceChild(b, a); // insert b at a's position
	bParent.replaceChild(a, c);
}

DElement.getId = function(el) {
	el = (el instanceof DElement) ? el.element : el;
	var id = el.getAttribute('id'); // important to use getAttribute as el.id can have unwanted side effects - is the case for a FORM element which contains an INPUT element with name 'id'
	if (!id) {
		var t = el.getAttribute('type');
		var n = el.tagName.toLowerCase() + (t ? "_" + t : "");
		id = (n + Math.random() * new Date().getTime()).replace('.', '');
		el.setAttribute('id', id);
	}
	return id;
}

/*	Should not be used if position is relative, since offsetLeft is then not the same as style.left.	*/
DElement.getLeft = function(element, useOffset) {
	if (typeof useOffset != "boolean") {
		useOffset = true;
	}
	return (useOffset && typeof element.offsetLeft == "number") ? element.offsetLeft : DElement.parseCSS(element, "left");
}

/*	Should not be used if position is relative, since offsetTop is then not the same as style.top.	*/
DElement.getTop = function(element, useOffset) {
	if (typeof useOffset != "boolean") {
		useOffset = true;
	}
	return (useOffset && typeof element.offsetTop == "number") ? element.offsetTop : DElement.parseCSS(this.element, "top");
}

/*	The useOffset argument forces use of the offsetWidth. See http://developer.mozilla.org/en/docs/DOM:element.offsetWidth.
	This is useful because some browsers - like Konqueror - subtracts the width of a possible scrollbar in the width property of the computed style object. Must be a bug?! Check Safari!
	This may not be desirable - for instance when resizing in DWindow.js. Furthermore Opera 9.1 is buggy when calculating width from the computed style object.
	It seems that any border widths are added.
	NOTE: In some browsers offsetWidth is undefined or 0, if display is 'none' or the empty string!	*/
DElement.getWidth = function(element, useOffset) {
	var w = (typeof useOffset == "boolean" && useOffset) ? NaN : DElement.parseCSS(element, "width");
	if (isNaN(w)) {
		if (!DElement.isDisplayed(element)) { // TODO: maybe 'reset' again?
			DElement.css(element, {visibility: 'hidden', display: 'block'}); // otherwise offsetWidth/offsetHeight will be 0
		}
		var ow = parseInt(element.offsetWidth, 10);
		if (ow) {
			w = ow;
			[DElement.parseCSS(element, "borderLeftWidth"), DElement.parseCSS(element, "paddingLeft"), DElement.parseCSS(element, "paddingRight"), DElement.parseCSS(element, "borderRightWidth")].forEach(function(v) {
				w -= (isNaN(v) || v < 0) ? 0 : v;
			});
		}
	}
	return w || 0;
}

/*	See DElement.getWidth	*/
DElement.getHeight = function(element, useOffset) {
	var h = (typeof useOffset == "boolean" && useOffset) ? NaN : DElement.parseCSS(element, "height");
	if (isNaN(h)) {
		if (!DElement.isDisplayed(element)) { // TODO: maybe 'reset' again?
			DElement.css(element, {visibility: 'hidden', display: 'block'}); // otherwise offsetWidth/offsetHeight will be 0
		}
		var oh = parseInt(element.offsetHeight, 10);
		if (oh) {
			h = oh;
			[DElement.parseCSS(element, "borderTopWidth"), DElement.parseCSS(element, "paddingTop"), DElement.parseCSS(element, "paddingBottom"), DElement.parseCSS(element, "borderBottomWidth")].forEach(function(v) {
				h -= (isNaN(v) || v < 0) ? 0 : v;
			});
		}
	}
	return h || 0;
}

DElement.hasClass = function(element, className) {
    if (element.classList) {
	    return element.classList.contains(className);
    }
	var classNames = element.className ? element.className.split(/\s+/) : [];
	for (var i = 0, l = classNames.length; i < l; i++) {
		if (className == classNames[i]) {
			return true;
		}
	}
	return false;
}

DElement.addClass = function(element, newClass, insertFirst) {
    if (element.classList) {
        element.classList.add(newClass);
        return;
    }
	var nClass = (typeof newClass == "string") ? newClass.trim() : newClass;
	if (nClass && !DElement.hasClass(element, nClass)) {
		if (element.className) {
			if (insertFirst) {
				element.className = nClass + " " + element.className;
			} else {
				element.className += " " + nClass;
			}
		} else {
			element.className = nClass;
		}
	}
}

DElement.replaceClass = function(element, oldClass, newClass, appendIfNotFound) {
	var oClass = (typeof oldClass == "string") ? oldClass.trim() : oldClass;
	if (!oClass) {
		return;
	}
	var nClass = (typeof newClass == "string") ? newClass.trim() : newClass;
	appendIfNotFound = !!appendIfNotFound;
	var classNames = element.className.split(/\s+/);
	var found = false;
	var cName = "";
	for (var i = 0, l = classNames.length; i < l; i++) {
		var className = classNames[i];
		if (oClass == className) {
			if (nClass) {
				cName += " " + nClass;
			}
			found = true;
		} else {
			cName += " " + className;
		}
	}
	element.className = cName.substring(1);
	if (!element.className) {
		element.removeAttribute("class");
	}
	if (!found && appendIfNotFound) {
		DElement.addClass(element, nClass);
	}
}

DElement.removeClass = function(element, className) {
	DElement.replaceClass(element, className, "");
}

DElement.isDisplayed = function(element) {
	var style = DElement.getComputedStyle(element);
	return style ? (style.display != 'none' && style.display != "") : true; // display may be the empty string in Konqueror 3.5.x and Safari 2
}

DElement.scrollIntoView = function(element) {
	if (typeof element.scrollIntoView != "undefined") {
		element.scrollIntoView();
	}
}

DElement.isMouseOver = function(element, e) {
	e = (e instanceof DEvent) ? e : new DEvent(e);
	var x = e.getPageX(), y = e.getPageY();
	var offset = DElement.getPageOffset(element);
	var w = element.offsetWidth, h = element.offsetHeight;
	return (x >= offset[0] && x <= offset[0] + w && y >= offset[1] && y <= offset[1] + h);
}

DElement.getPageOffset = function(element, adjustForScroll) {
	var x = 0, y = 0;
	if (typeof element.getBoundingClientRect !== 'undefined') {
		var rect = element.getBoundingClientRect();
		x = rect.left;
		y = rect.top;
		if (!adjustForScroll) { // bounding rect is automatically adjusted for scroll so we need to add them again in case we do not wanna adjust for scroll
			var vw = DElement.getDefaultView(element);
			x += getScrollX(vw);
			y += getScrollY(vw);
		}
	} else {
		for (var el = element; el != null; el = el.offsetParent) {
			x += el.offsetLeft || 0;
			y += el.offsetTop || 0;
		}
		if (adjustForScroll) {
			var vw = DElement.getDefaultView(element);
			x -= getScrollX(vw);
			y -= getScrollY(vw);
		}
	}
	return [x, y];
}

DElement.getOpacity = function(el) {
	var style = DElement.getComputedStyle(el);
	if (style) {
		var o = parseFloat(style.opacity);
		if (isNaN(o)) {
			var target = "opacity=";
			var index = style.filter ? style.filter.indexOf(target) : -1;
			o = (index > -1) ? (parseInt(style.filter.substring(index + target.length), 10) || 100) / 100 : 1;
		}
		return o;
	}
	return NaN;
}

/*	It may be necessary to remove the filter property again in IE (6+7+8).
 	This is the case if you use certain fonts (fx calibri) or the element contain buttons.
 	The alpha filter causes the calibri font to be fuzzy and buttons on XP to have a strange border.
 	Remove it by setting the filter property to 'none'.	*/
DElement.setOpacity = function(el, opacity) {
	opacity = parseFloat(opacity);
	if (isNaN(opacity)) {
		return;
	}
	opacity = Math.max(opacity, 0);
	if (opacity > 1) {
		opacity /= 100;
	}
	if (dLib.ua.isIE) {
		// IE has trouble with opacity if it does not have layout - force it by setting the zoom level (see http://www.positioniseverything.net/articles/haslayout.html)
		el.zoom = 1;
		el.style.filter = "alpha(opacity=" + (opacity * 100) + ")";
	}
	el.style.KHTMLOpacity = opacity;
	el.style.MozOpacity = opacity; // Older Mozilla and Firefox
	el.style.opacity = opacity;
}

DElement.animationConfig = { // default animation configuration
	delay: 10,
	duration: 400,
	anim: null, // function which will be executed on each interval in the scope specified by 'scope' (below) and passed the percentage of time passed as the one and only argument
	callback: null, // function which will be executed when the animation is finished in the scope specified by the 'scope' property.
	transition: "sinusoidal",
	scheduleMethod: "Interval"
}

DElement.animate = function(el, config) {
	config = Object.extend({
		from: DElement.getXY(el), // TODO: This is expensive performance wise
		dimension: [DElement.getWidth(el), DElement.getHeight(el)], // TODO: This is expensive performance wise
        scope: el
	}, config);
	var cfg = Object.configure(config, DElement.animationConfig);
	cfg.onSchedule = function(timer) {
		function ease(transition, x) {
			if (transition in dLib.transitions) {
				return dLib.transitions[transition](x);
			}
			return x;
		};
		var c = timer.config;
		var dt = Math.min((new Date().getTime() - timer.startTime) / c.duration, 1);
		var rv = dLib.util.applyHandler(c.anim, c.scope, [ease(c.transition, dt), c]);
		if (!rv) {
			dLib.util.applyHandler(c.callback, c.scope, [el, c]);
		}
		return rv;
	}
	cfg.onTimeup = function(timer) {
		var c = timer.config;
		dLib.util.applyHandler(c.callback, c.scope, [el, c]);
	}
	return new DTimer(cfg).start();
}

/*	No good to use element.getElementsByTagName in IE due to a bug if the element is a OBJECT tag.
	Element.getElementsByTagName returns all tags in the entire document with the specified name!
	Not just those nested inside the OBJECT tag.
	Works for (X)HTML elements only, not XML elements	*/
DElement.getElementsByTagName = function(element, name) {
	if (dLib.ua.isIE && name.toLowerCase() == "param") {
		var elements = [];
		var children = element.childNodes;
		var scriptable = false;
		for (var j = 0, ln = children.length; j < ln; j++) {
			var child = children[j];
			if (child.nodeType == 1 && child.tagName.toLowerCase() == name.toLowerCase()) {
				elements.push(child);
			}
		}
		return elements;
	}
	return element.getElementsByTagName(name);
}

DElement.html = function(element, htm, append, before) {
	if (htm === undefined) {
		return element.innerHTML;
	}
	if (append) {
        if (before) {
            if (typeof element.insertAdjacentHTML != 'undefined') {
                element.insertAdjacentHTML('afterbegin', htm);
            } else {
                element.innerHTML = htm + element.innerHTML;
            }

        } else {
            if (typeof element.insertAdjacentHTML != 'undefined') {
                element.insertAdjacentHTML('beforeend', htm);
            } else {
                element.innerHTML += htm;
            }
        }
	} else {
		element.innerHTML = htm;
	}
}

DElement.show = function(element, display) {
	function resolveDefaultDisplay(tagName) {
		switch (tagName.toLowerCase()) {
			case 'span':
				return 'inline';
			case 'col':
				return 'table-column';
			case 'colgroup':
				return 'table-column-group';
			case 'caption':
				return 'table-caption';
			case 'th':
			case 'td':
				return 'table-cell';
			case 'tr':
				return 'table-row';
			case 'table':
				return 'table';
			case 'tbody':
				return 'table-row-group';
			case 'thead':
				return 'table-header-group';
			case 'tfoot':
				return 'table-footer-group';
			default:
				return 'block';
		}
	}
	var css = { display: display || resolveDefaultDisplay(element.tagName), visibility: 'visible' };
	DElement.css(element, css);
	return css;
}

DElement.hide = function(element, display) {
	var css = { display: display || 'none', visibility: 'hidden' };
	DElement.css(element, css);
	return css;
}

DElement.prototype.query = function(expr) {
	return DElementList.query(expr, this.element);
}

DElement.prototype.text = function() {
	return DElement.text(this.element);
}

DElement.prototype.firstElementChild = function() {
	var el = DElement.firstElementChild(this.element);
	return el ? g(el) : null;
}

DElement.prototype.firstElement = DElement.prototype.firstElementChild;

DElement.prototype.lastElementChild = function() {
	var el = DElement.lastElementChild(this.element);
	return el ? g(el) : null;
}

DElement.prototype.lastElement = DElement.prototype.lastElementChild;

DElement.prototype.nextElementSibling = function() {
	var el = DElement.nextElementSibling(this.element);
	return el ? g(el) : null;
}

DElement.prototype.nextElement = DElement.prototype.nextElementSibling;

DElement.prototype.previousElementSibling = function() {
	var el = DElement.previousElementSibling(this.element);
	return el ? g(el) : null;
}

DElement.prototype.prevElement = DElement.prototype.previousElementSibling;

DElement.prototype.before = function(htm) {
	DElement.before(this.element, htm);
	return this;
}

DElement.prototype.append = function(htm) {
	DElement.append(this.element, htm);
	return this;
}

/*	The argument point must be a two dimensional array of integers.
 * 	Make sure that the position of the element isn't 'static' when using this method!
 * 	If you already adjusted the point for possible scrolling you should specify ignoreScroll as true. */
DElement.prototype.moveTo = function(point, adjustToViewport, ignoreScroll) {
	if (adjustToViewport) {
		var win = this.getDefaultView(), scrollFactor = ignoreScroll ? 0 : 1;
		var x = point[0], winWidth = getViewportWidth(win), scrollX = getScrollX(win), w = this.getWidth(true);
		if (w <= x && x + w - scrollFactor * scrollX > winWidth) {
			x -= x + w - scrollFactor * scrollX - winWidth;
		}
		var y = point[1], winHeight = getViewportHeight(win), scrollY = getScrollY(win), h = this.element.offsetHeight; // enough to check for display once, so refer directly to offsetHeight
		if (h <= y && y + h - scrollFactor * scrollY > winHeight) {
			y -= y + h - scrollFactor * scrollY - winHeight;
		}
		point = [x, y];
	}
	this.css({ left: point[0] + "px", top: point[1] + "px" }).moveIframe(point);
	return this;
}

DElement.prototype.center = function(adjustForScroll) {
	var c = this.calculateCenter(adjustForScroll);
	this.moveTo(c);
	return this;
}

DElement.prototype.calculateCenter = function(adjustForScroll) {
	adjustForScroll = (typeof adjustForScroll == "boolean") ? adjustForScroll : this.getComputedStyle().position == 'absolute';
	var win = this.getDefaultView();
	var x = (getViewportWidth(win) - this.getWidth()) / 2;
	var y = (getViewportHeight(win) - this.getHeight()) / 2;
	if (adjustForScroll) {
		x += getScrollX(win);
		y += getScrollY(win);
	}
	return [Math.round(x), Math.round(y)];
}

DElement.prototype.hide = function(display) {
	var css = DElement.hide(this.element, display);
	if (this.iframe) {
		DElement.css(this.iframe, css);
	}
	return this;
}

DElement.prototype.show = function(display) {
	var css = DElement.show(this.element, display);
	if (this.iframe) {
		DElement.css(this.iframe, css);
	}
	return this;
}

DElement.prototype.addEventListener = function(eventType, handler, doCapture) {
	return dLib.event.add(this.element, eventType, handler, doCapture);
}

DElement.prototype.on = function(eventTypes, handler, doCapture) {
	var types = eventTypes.trim().split(/\s+/);
	for (var i = 0, l = types.length; i < l; i++) {
		this.addEventListener(types[i], handler, doCapture);
	}
	return this;
}

DElement.prototype.removeEventListener = function(eventType, handler, doCapture) {
	dLib.event.remove(this.element, eventType, handler, doCapture);
}

DElement.prototype.off = function(eventTypes, handler, doCapture) {
	var types = eventTypes.trim().split(/\s+/);
	for (var i = 0, l = types.length; i < l; i++) {
		this.removeEventListener(types[i], handler, doCapture);
	}
	return this;
}

DElement.prototype.removeOn = DElement.prototype.off;

DElement.prototype.getDefaultView = function() {
	return DElement.getDefaultView(this.element);
}

DElement.prototype.getComputedStyle = function(pseudo, autoCorrect) {
	return DElement.getComputedStyle(this.element, pseudo, autoCorrect);
}

DElement.prototype.prepareToMove = function(position) {
	var style = this.getComputedStyle(null, false);
	if (!style) {
		return this;
	}
	if (style.position == "static" || style.position == "" || (typeof position == "string" && position)) { // In Safari 3 beta style.position may be the empty string!
		this.css("position", (typeof position == "string") ? position : "relative");
	}
	var x = parseInt(style.left, 10);
	if (isNaN(x)) {
		this.css("left", "0");
		x = 0;
	}
	var y = parseInt(style.top, 10);
	if (isNaN(y)) {
		this.css("top", "0");
		y = 0;
	}
	this.moveOffset = [x, y];
	this.insertIframe();
	return this;
}

/*	This method fixes IE5.5-6 issues when moving a block element over form controls by inserting an iframe before the given HTML element.
	This iframe is given the same dimension as the HTML element and moved/resized along the HTML element.	*/
DElement.prototype.insertIframe = function() {
	if (this.iframe) {
		return this;
	}
	if (!this.config.useIframe || typeof this.config.iframeSource != "string") {
		return this;
	}
	var style = this.getComputedStyle(null, false);
	if (!style) {
		return this;
	}
	var ifr = this.getOwnerDocument().createElement("iframe");
	DElement.css(ifr, "position", "absolute");
	if (dLib.ua.isIE_6) {
		DElement.css(ifr, "filter", "beta(style=0,opacity=0)");
		if (style.position == "fixed") {
			this.css("position", "absolute");
		}
	}
	var f = function(entry) { var v = this.parseCSS(entry); return (isNaN(v) || v < 0) ? 0 : v; };
	var w = ["borderLeftWidth", "paddingLeft", "paddingRight", "borderRightWidth"].map(f, this);
	var h = ["borderTopWidth", "paddingTop", "paddingBottom", "borderBottomWidth"].map(f, this);
	var ow = this.getWidth(true);
	var oh = this.getHeight(true);
	if (ow == 0 && oh == 0 && style.display == "none") {
		var origVisibility = style.visibility;
		this.element.style.visibility = 'hidden';
		this.element.style.display = 'block';
		ow = this.getWidth(true);
		oh = this.getHeight(true);
		this.element.style.visibility = origVisibility;
		this.element.style.display = 'none';
	}
	DElement.css(ifr, {
		left: this.getLeft(true) + "px",
		top: this.getTop(true) + "px",
		width: (w[0] + w[1] + ow + w[2] + w[3]) + "px",
		height: (h[0] + h[1] + oh + h[2] + h[3]) + "px",
		visibility: style.visibility,
		display: style.display,
		opacity: 0, // necessary to allow filtering for PNG images in IE6
		zIndex: style.zIndex
	});
	ifr.setAttribute("id", "iframe_" + (this.element.id || new Date().getTime()));
	ifr.setAttribute("scrolling", "no"); // does not hide scrollbars - necessary if using opacity
	ifr.setAttribute("src", this.config.iframeSource);
	ifr.setAttribute("frameborder", "0");
	ifr.frameBorder = "0"; // setAttribute does not work for frameBorder in IE6
	this.element.parentNode.insertBefore(ifr, this.element);
	this.iframe = ifr;
	return this;
}

DElement.prototype.moveIframe = function(point) {
	if (!this.iframe) {
		return this;
	}
	var style = this.getComputedStyle();
	if (!style) {
		return this;
	}
	var x = point[0], y = point[1];
	if (style.position == "relative") {
		var pt = this.getPageOffset();
		x = pt[0];
		y = pt[1];
	} else {
		var ml = parseInt(style.marginLeft, 10);
		x += isNaN(ml) ? 0 : ml;
		var mt = parseInt(style.marginTop, 10);
		y += isNaN(mt) ? 0 : mt;
	}
	DElement.css(this.iframe, {
		visibility: style.visibility,
		display: style.display,
		zIndex: style.zIndex,
		left: x + "px",
		top: y + "px"
	});
	return this;
}

DElement.prototype.resizeIframe = function(dimension) {
	if (!this.iframe) {
		return this;
	}
	var style = this.getComputedStyle();
	if (!style) {
		return this;
	}
	var f = function(entry) { var v = this.parseCSS(entry); return (isNaN(v) || v < 0) ? 0 : v; };
	var w = ["borderLeftWidth", "paddingLeft", "paddingRight", "borderRightWidth"].map(f, this);
	var h = ["borderTopWidth", "paddingTop", "paddingBottom", "borderBottomWidth"].map(f, this);
	DElement.css(this.iframe, {
		width: (w[0] + w[1] + this.getWidth(true) + w[2] + w[3]) + "px",
		height: (h[0] + h[1] + this.getHeight(true) + h[2] + h[3]) + "px",
		visibility: style.visibility,
		display: style.display
	});
	return this;
}

/*	The argument dimension must be a two dimensional array of integers.	*/
DElement.prototype.resizeTo = function(dimension) {
	this.setWidth(dimension[0]);
	this.setHeight(dimension[1]);
	this.resizeIframe(dimension);
	return this;
}

DElement.prototype.setWidth = function(w) {
	if (w >= 0) { // this check is necessary in IE as invalid values causes an error
		this.css("width", w + "px");
	}
	return this;
}

DElement.prototype.setHeight = function(h) {
	if (h >= 0) {
		this.css("height", h + "px");
	}
	return this;
}

DElement.prototype.html = function(htm, append, before) {
	var rv = DElement.html(this.element, htm, append, before);
	return rv === undefined ? this : rv;
}

DElement.prototype.write = DElement.prototype.html;

DElement.prototype.hasClass = function(className) {
	return DElement.hasClass(this.element, className);
}

DElement.prototype.setClass = function(className) {
	this.element.className = className;
	return this;
}

DElement.prototype.getClass = function() {
	return this.element.className;
}

DElement.prototype.addClass = function(newClass, insertFirst) {
	DElement.addClass(this.element, newClass, insertFirst);
	return this;
}

DElement.prototype.replaceClass = function(oldClass, newClass, appendIfNotFound) {
	DElement.replaceClass(this.element, oldClass, newClass, appendIfNotFound);
	return this;
}

DElement.prototype.removeClass = function(className) {
	this.replaceClass(className, "");
	return this;
}

DElement.prototype.isDisplayed = function() {
	return DElement.isDisplayed(this.element);
}

DElement.prototype.toggle = function() {
	if (this.isDisplayed()) {
		this.hide();
	} else {
		this.show();
	}
	return this;
}

DElement.prototype.css = function(property, value) {
	DElement.css(this.element, property, value);
	return this;
}

DElement.prototype.parseCSS = function(property) {
	return DElement.parseCSS(this.element, property);
}

DElement.prototype.getId = function() {
	return DElement.getId(this.element);
}

DElement.prototype.getXY = function() {
	return DElement.getXY(this.element);
}

DElement.prototype.getLeft = function(useOffset) {
	return DElement.getLeft(this.element, useOffset);
}

DElement.prototype.getTop = function(useOffset) {
	return DElement.getTop(this.element, useOffset);
}

DElement.prototype.getWidth = function(useOffset) {
	return DElement.getWidth(this.element, useOffset);
}

DElement.prototype.getHeight = function(useOffset) {
	return DElement.getHeight(this.element, useOffset);
}

DElement.prototype.scrollIntoView = function() {
	DElement.scrollIntoView(this.element);
	return this;
}

DElement.prototype.isMouseOver = function(e) {
	return DElement.isMouseOver(this.element, e);
}

DElement.prototype.getPageOffset = function(adjustForScroll) {
	return DElement.getPageOffset(this.element, adjustForScroll);
}

DElement.prototype.setOpacity = function(opacity) {
	DElement.setOpacity(this.element, opacity);
	if (this.iframe) {
		DElement.setOpacity(this.iframe, opacity);
	}
	return this;
}

DElement.prototype.getOpacity = function() {
	return DElement.getOpacity(this.element);
}

DElement.prototype.widen = function(dimensions, config) { // TODO: rename this method
	this.prepareToMove();
	var cfg = Object.extend({ scope: this }, config);
	cfg.anim = function(dt, cfg) {
		if ('left' in dimensions || 'top' in dimensions) {
			var x0 = cfg.from[0], y0 = cfg.from[1];
			var x = ('left' in dimensions) ? Math.round(x0 + dt * (dimensions.left - x0)) : x0;
			var y = ('top' in dimensions) ? Math.round(y0 + dt * (dimensions.top - y0)) : y0;
			this.moveTo([x, y]);
		}
		if ('width' in dimensions || 'height' in dimensions) {
			var w0 = cfg.dimension[0], h0 = cfg.dimension[1];
			var w = ('width' in dimensions) ? Math.round(w0 + dt * (dimensions.width - w0)) : w0;
			var h = ('height' in dimensions) ? Math.round(h0 + dt * (dimensions.height - h0)) : h0;
			this.resizeTo([w, h]);
		}
		return dt != 1;
	}
	this.animate(cfg);
	return this;
}

DElement.prototype.slideTo = function(pos, config) {
	return this.widen({ left: pos[0], top: pos[1] }, config);
}

DElement.prototype.circle = function(config) {
	var cfg = Object.extend({ r: 100 }, config);
	cfg.rx = cfg.r;
	cfg.ry = cfg.r;
	return this.ellipse(cfg);
}

DElement.prototype.ellipse = function(config) {
	this.prepareToMove();
	var cfg = Object.extend({ scope: this, rx: 200, ry: 100 , angle: 0, clockWise: !false }, config);
	cfg.anim = function(dt, cfg) {
		var dir = cfg.clockWise ? 1 : -1;
		this.moveTo([Math.round((cfg.from[0] - (cfg.clockWise ? 1 : 0) * Math.cos(cfg.angle) * cfg.rx) + cfg.rx * Math.cos(cfg.angle + 2 * Math.PI * dt)), Math.round((cfg.from[1] - (cfg.clockWise ? 1 : 0) * Math.sin(cfg.angle) * cfg.ry) + dir * cfg.ry * Math.sin(cfg.angle + 2 * Math.PI * dt))]); // need to multiply with -1 as y values increases downwards and not upwards as in a coordinate system
		return dt != 1;
	}
	this.animate(cfg);
	return this;
}

DElement.prototype.pulsate = function(config) {
	var cfg = Object.extend({ scope: this, transition: "sinusoidal" }, config);
	cfg.anim = function(dt, conf) {
		function transform(x, pulses) {
			return dLib.transitions.sinusoidal(1 - dLib.transitions.pulse(x, pulses));
		};
		dt = Math.min(Math.max(transform(dt, conf.pulses), 0), 1);
		var rv = (dt > 0 && dt < 1);
		this.setOpacity(rv ? dt : 1);
		return rv;
	}
	this.animate(cfg);
	return this;
}

DElement.prototype.jump = function(config) {
	this.prepareToMove();
	var cfg = Object.extend({ scope: this }, config);
	cfg.anim = function(dt, cfg) {
		this.css('top', Math.round(8 * Math.sin(-4 * Math.PI * dt)) + 'px');
		return dt < 1;
	}
	this.animate(cfg);
	return this;
}

DElement.prototype.shake = function(config) {
	this.prepareToMove();
	var cfg = Object.extend({ scope: this, transition: "cubic" }, config);
	cfg.anim = function(dt, cfg) {
		this.moveTo([Math.round(5 * (Math.cos(Math.PI * (dt - 1)) - 1)) + cfg.from[0], Math.round(5 * Math.sin(8 * Math.PI * (dt - 1))) + cfg.from[1]]);
		return dt < 1;
	}
	this.animate(cfg);
	return this;
}

DElement.prototype.rumble = function(config) {
	this.prepareToMove();
	var cfg = Object.extend({ scope: this, transition: "cubic" }, config);
	cfg.anim = function(dt, cfg) {
		this.moveTo([Math.round(5 * Math.cos(8 * Math.PI * (dt - 0.5)) - 5) + cfg.from[0], Math.round(5 * Math.sin(8 * Math.PI * (dt - 0.25))) + cfg.from[1]]);
		return dt < 1;
	}
	this.animate(cfg);
	return this;
}

DElement.prototype.animate = function(cfg) {
	if (!this.dTimer || !this.dTimer.isRunning()) {
		this.dTimer = DElement.animate(this.element, cfg);
	}
	return this;
}

DElement.prototype.fadeOut = function(config) {
	var cfg = Object.extend({ scope: this, transition: "reverse", from: NaN, to: 0, show: false, hide: true, display: 'none' }, config);
	cfg.anim = function(dt, cfg) {
		this.setOpacity(Math.max(dt, 0));
		if (dt <= 0 && cfg.hide) { // auto hide when finished fading out - if we don't SELECT elements will still be active for the user (in IE6 even visible)
			this.hide(cfg.display);
		}
		return (dt > cfg.to);
	}
	if (cfg.show) {
		this.show();
	}
	if (this.getOpacity() > cfg.to) {
		if (!isNaN(cfg.from)) {
			this.setOpacity(cfg.from);
		}
		this.animate(cfg);
	}
	return this;
}

DElement.prototype.fadeIn = function(config) {
	var cfg = Object.extend({ scope: this, transition: 'linear', from: 0, to: 1, show: true, display: 'block' }, config);
	cfg.anim = function(dt, cfg) {
		this.setOpacity(Math.min(dt, 1));
		return (dt < cfg.to);
	}
	if (cfg.show) {
		this.show(cfg.display);
	}
	this.setOpacity(cfg.from);
	if (this.getOpacity() < cfg.to) {
		if (!isNaN(cfg.from)) {
			this.setOpacity(cfg.from);
		}
		this.animate(cfg);
	}
	return this;
}

DElement.prototype.attr = function(name, value) {
    var rv = DElement.attr(this.element, name, value);
	return rv != null ? rv : this;
}

DElement.prototype.requestFullScreen = function() {
	return DElement.requestFullScreen(this.element);
}

/*	Works for (X)HTML elements only, not XML elements	*/
DElement.prototype.getAttribute = function(name) {
	return DElement.getAttribute(this.element, name);
}

/*	Works for (X)HTML elements only, not XML elements	*/
DElement.prototype.setAttribute = function(name, value) {
	DElement.setAttribute(this.element, name, value);
	return this;
}

/*	Works for (X)HTML elements only, not XML elements	*/
DElement.prototype.removeAttribute = function(name) {
	DElement.removeAttribute(this.element, name);
	return this;
}

DElement.prototype.getElementsByTagName = function(name) {
	return DElement.getElementsByTagName(this.element, name);
}

function DElementList(queryOrElements, context) {
	this.elements = (typeof queryOrElements == "string") ? DElementList.query(queryOrElements, context) : queryOrElements;
}

DElementList.defaultConfig = {};

/*	Does not contain duplicates! Ignores :visited due to security reasons.
	The order of the returned list reflects the elements order in the DOM structure.	*/
DElementList.query = function(query, context) {
	if (context instanceof DElement) {
		context = context.element;
	}
	context = context || document;
	if (window.Sizzle) {
		return Sizzle(query, context);
	}
	if (context.querySelectorAll) {
		return context.querySelectorAll(query, context);
	}
	return [];
}

DElementList.forEach = function(htmlCol, fn, scope, asDElement) {
	dLib.assertType(fn, "function", "DElementList.forEach needs a function as the second argument!");
	if (htmlCol && htmlCol.length) {
		for (var i = 0, l = htmlCol.length; i < l; i++) {
			var el = htmlCol[i];
			if (false === fn.apply(scope || el, [(asDElement ? g(el) : el), i, htmlCol])) {
				break;
			}
		}
	}
}

DElementList.map = function(htmlCol, fn, scope, asDElement) {
	dLib.assertType(fn, "function", "DElementList.map needs a function as the second argument!");
	var len = htmlCol.length, result = new Array(len);
	if (len) {
		for (var i = 0; i < len; i++) {
			if (i in htmlCol) {
				var el = htmlCol[i];
				result[i] = fn.apply(scope || el, [(asDElement ? g(el) : el), i, htmlCol]);
			}
		}
	}
	return result;
}

DElementList.every = function(htmlCol, fn, scope, asDElement) {
	dLib.assertType(fn, "function", "DElementList.every needs a function as the second argument!");
	if (htmlCol && htmlCol.length) {
		for (var i = 0, l = htmlCol.length; i < l; i++) {
			var el = htmlCol[i];
			if (!fn.apply(scope || el, [(asDElement ? g(el) : el), i, htmlCol])) {
				return false;
			}
		}
	}
	return true;
}

DElementList.filter = function(htmlCol, fn, scope, asDElement) {
	dLib.assertType(fn, "function", "DElementList.filter needs a function as the second argument!");
	var result = [];
	if (htmlCol && htmlCol.length) {
		for (var i = 0, l = htmlCol.length; i < l; i++) {
			var el = htmlCol[i];
			if (fn.apply(scope || el, [(asDElement ? g(el) : el), i, htmlCol])) {
				result.push(el);
			}
		}
	}
	return result;
}

DElementList.swapElements = function(nodeList, i, j) {
	var n1 = nodeList.item(i);
	var n2 = nodeList.item(j);
	dLib.assert(n1 != null, "Invalid index!");
	dLib.assert(n2 != null, "Invalid index!");
	dLib.assert(n1.parentNode === n2.parentNode, "Nodes must have same parent to be swapped!");
	var n = document.createElement(n2.nodeName);
	var pNode = n1.parentNode;
	pNode.insertBefore(n, n1);
	pNode.insertBefore(n1, n2);
	pNode.replaceChild(n2, n);
}

DElementList.prototype.swapElements = function(i, j) {
	DElementList.swapElements(this.elements, i, j);
	return this;
}

DElementList.prototype.item = function(index, asDElement) {
	if (index < 0 || index >= this.size()) {
		return null;
	}
	return asDElement ? g(this.elements[index]) : this.elements[index];
}

DElementList.prototype.size = function() {
	return this.elements.length;
}

DElementList.prototype.asArray = function() {
	return [].addAll(this.elements);
}

DElementList.prototype.forEach = function(iterator, asDElement) {
	DElementList.forEach(this.elements, iterator, null, asDElement);
	return this;
}

DElementList.prototype.map = function(iterator, asDElement) {
	return DElementList.map(this.elements, iterator, null, asDElement);
}

DElementList.prototype.every = function(iterator, asDElement) {
	DElementList.every(this.elements, iterator, null, asDElement);
	return this;
}

DElementList.prototype.filter = function(iterator, asDElement) {
	this.elements = DElementList.filter(this.elements, iterator, null, asDElement);
	return this;
}

DElementList.prototype.css = function(name, value) {
	var result = value === undefined ? [] : null;
	for (var i = 0, l = this.elements.length; i < l; i++) {
		var rv = DElement.css(this.elements[i], name, value);
		if (result) {
			result.push(rv);
		}
	}
	return result || this;
}

DElementList.prototype.addClass = function(newClass, insertFirst) {
	for (var i = 0, l = this.elements.length; i < l; i++) {
		DElement.addClass(this.elements[i], newClass, insertFirst);
	}
	return this;
}

DElementList.prototype.html = function(htm, append, before) {
	for (var i = 0, l = this.elements.length; i < l; i++) {
		DElement.html(this.elements[i], htm, append, before);
	}
	return this;
}

DElementList.prototype.show = function(display) {
	for (var i = 0, l = this.elements.length; i < l; i++) {
		DElement.show(this.elements[i], display);
	}
	return this;
}

DElementList.prototype.hide = function(display) {
	for (var i = 0, l = this.elements.length; i < l; i++) {
		DElement.hide(this.elements[i], display);
	}
	return this;
}

DElementList.prototype.on = function(eventTypes, handler, doCapture) {
	if (handler) {
		var types = eventTypes.trim().split(/\s+/);
		for (var i = 0, l = types.length; i < l; i++) {
			this.forEach(function(entry) {
				dLib.event.add(entry, types[i], handler, doCapture);
			});
		}
	}
	return this;
}

DElementList.prototype.off = function(eventTypes, handler, doCapture) {
	if (handler) {
		var types = eventTypes.trim().split(/\s+/);
		for (var i = 0, l = types.length; i < l; i++) {
			this.forEach(function(entry) {
				dLib.event.remove(entry, types[i], handler, doCapture);
			});
		}
	}
	return this;
}

DElementList.prototype.removeOn = DElementList.prototype.off;

DElementList.prototype.attr = function(name, value) {
	var values;
    if (name) {
		this.forEach(function(entry) {
			var rv = DElement.attr(entry, name, value);
            if (rv !== undefined) {
                if (!values) {
                    values = [];
                }
                values.push(rv);
            }
		});
	}
	return values || this;
}

DElementList.prototype.toString = function() {
	return "[object DElementList] " + this.elements.length;
}

function addEvent(eventType, handler, doCapture) {
	return dLib.event.add(window, eventType, handler, doCapture);
}

function removeEvent(eventType, handler, doCapture) {
	dLib.event.remove(window, eventType, handler, doCapture);
}

function addDOMReadyListener(handler) {
	return g(document).addDOMReadyListener(handler);
}

function removeDOMReadyListener(handler) {
	g(document).removeDOMReadyListener(handler);
}

// window.innerWidth includes the width of the scrollbar in Firefox, Safari 3 and Opera, but not in Safari 2 and earlier and Konqueror
function getViewportWidth(win) {
	win = win || window;
	if (win.document.body) {
		return DDocument.getViewportElement(win.document).clientWidth; // does not include the width of the scrollbar, not even in Firefox or Opera
	}
	return 0;
}

// window.innerHeight includes the width of the scrollbar in Firefox and Opera, but not in Safari and Konqueror
function getViewportHeight(win) {
	win = win || window;
	if (win.document.body) {
		return DDocument.getViewportElement(win.document).clientHeight;
	}
	return 0;
}

/*	Note that in certain browsers - IE6+7, Chrome, Safari - the scrollLeft/scrollTop properties are 0 until the onscroll event has occurred.
	Be aware that the onscroll event is automatically fired once after onload (reload) if the page was scrolled down before the reload! Not just when the user scrolls the page!	*/
function getScrollX(win) {
	win = win || window;
	var x = 0;
	if (typeof win.scrollX == "number") { // W3C
		x = win.scrollX;
	}
	else if (typeof win.pageXOffset == "number") { // Netscape 4
		x = win.pageXOffset;
	} else {
		x = DDocument.getViewportElement(win.document).scrollLeft;
	}
	return x;
}

function getScrollY(win) {
	win = win || window;
	var y = 0;
	if (typeof win.scrollY == "number") { // W3C
		y = win.scrollY;
	}
	else if (typeof win.pageYOffset == "number") { // Netscape 4
		y = win.pageYOffset;
	} else {
		y = DDocument.getViewportElement(win.document).scrollTop;
	}
	return y;
}

// Note: Opera supports URL.createObjectURL, but not URL.revokeObjectURL!
function getBlobURL(blob) {
	if (window.URL && window.URL.createObjectURL && window.URL.revokeObjectURL) {
		return window.URL.createObjectURL(blob);
	}
	if (window.webkitURL) {
		return window.webkitURL.createObjectURL(blob);
	}
	if (window.createObjectURL) {
		return window.createObjectURL(blob);
	}
	return null;
}

function revokeBlobURL(url) {
	dLib.assert(!!url, new TypeError('The \'url\' argument cannot be null!'));
	if (window.URL && window.URL.revokeObjectURL) {
		window.URL.revokeObjectURL(url);
	}
	else if (window.webkitURL && window.webkitURL.revokeObjectURL) {
		window.webkitURL.revokeObjectURL(url);
	}
	else if (window.revokeObjectURL) {
		window.revokeObjectURL(url);
	}
}

function DTimer(config) {
	this.config = Object.configure(config, DTimer.defaultConfig);
	this.listeners = []; // array of listener objects which will be notified between each delay
	this.method = function() {
		var m = this.config.scheduleMethod;
		dLib.assert(typeof window["set" + m] !== "undefined", "DLib.js: Invalid schedule method: 'set" + m + "'!");
		return m;
	}.apply(this, []);
	this.timerId = NaN;
	this.startTime = NaN;
	this.endTime = NaN;
	this.runningTime = 0; // measured in milliseconds
	this.isExecuting = false;
}

DTimer.defaultConfig = {
	delay: 10, // measured in milliseconds
	initialDelay: NaN, // measured in milliseconds
	duration: NaN, // measured in milliseconds - NaN or Number.POSITIVE_INFINITY means that the timer will keep running until you manually stop it!
	scheduleMethod: "Interval", // must be either 'Interval' or 'Timeout'
	scope: null, // scope in which the pseudo handlers below will be executed. If null, they'll be executed in the scope of the DTimer instance.
	onTimeup: null, // function invoked when duration ms has passed. Will be executed in the scope of scope or the DTimer instance.
	onSchedule: null // function invoked when (initial) delay has passed. Returning false stops the timer (without calling timeout and without notifying listeners)! Will be executed in the scope of scope or the DTimer instance.
}

DTimer.prototype.toString = function() {
	var cfg = this.config;
	return "[object DTimer]: duration: " + cfg.duration + " delay: " + cfg.delay + " initial delay: " + cfg.initialDelay + " running time: " + this.runningTime + " timerId: " + this.timerId;
}

DTimer.prototype.addListener = function(listener) {
	this.listeners.push(listener);
	return this;
}

DTimer.prototype.start = function() {
	if (!this.isRunning()) {
		this.startTime = new Date().getTime();
		this.endTime = NaN;
		this.runningTime = 0;
		// since we allow these 3 properties in the config object to be changed while running, we create corresponding instance variables for use by schedule and run
		this.delay = this.config.delay;
		this.initialDelay = this.config.initialDelay;
		this.duration = this.config.duration;
		this.schedule(this.initialDelay);
	}
	return this;
}

DTimer.prototype.stop = function() {
	if (!isNaN(this.timerId)) {
		this.endTime = new Date().getTime();
		window["clear" + this.method](this.timerId);
		this.timerId = NaN;
	}
	return this;
}

DTimer.prototype.isRunning = function() {
	return !isNaN(this.timerId);
}

DTimer.prototype.run = function() {
	if (!this.isExecuting) {
		try {
			this.isExecuting = true;
			if (this.runningTime > this.duration) {
				this.stop();
				this.timeup();
			} else {
				if (this.keepRunning()) {
					this.schedule(this.delay);
				} else {
					this.stop();
				}
			}
		}
		finally {
			this.isExecuting = false;
		}
	}
	return this;
}

DTimer.prototype.schedule = function(delay) {
	delay = parseInt(delay || this.delay, 10);
	if (delay > 0) {
		this.runningTime += delay;
		if (this.method === "Interval") {
			if (this.runningTime === delay) {
				this.timerId = setInterval(this.run.bind(this), delay);
			}
			else if (this.runningTime === this.initialDelay + delay) {
				clearInterval(this.timerId);
				this.timerId = setInterval(this.run.bind(this), delay);
			}
		} else {
			this.timerId = setTimeout(this.run.bind(this), delay);
		}
	}
	return this;
}

DTimer.prototype.notifyListeners = function() {
	for (var i = 0, l = this.listeners.length; i < l; i++) {
		dLib.util.applyHandler(this.listeners[i], this.config.scope || this, [this]);
	}
	return this;
}

DTimer.prototype.keepRunning = function() {
	return this.fireHandler("onSchedule");
}

DTimer.prototype.fireHandler = dLib.util.fireHandler;

DTimer.prototype.timeup = function() {
	this.fireHandler("onTimeup");
	this.notifyListeners();
	return this;
};

var g = dLib.get, q = dLib.query, domReady = addDOMReadyListener; // TODO: maybe use a queue and only one registered DOMContentLoaded listener

Object.extend(dLib.util, {
	// not enough to specify æ(229), ø(230) and å(248): 192-214 + 216-246 + 248-260 /[\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u0104]/
	specialLettersPattern: "[\\u" + Number.toHexString(192, 4) + "-\\u" + Number.toHexString(214, 4) + "\\u" + Number.toHexString(216, 4) + "-\\u" + Number.toHexString(246, 4) + "\\u" + Number.toHexString(248, 4) + "-\\u" + Number.toHexString(260, 4) + "]"
});

(function() {
	if (window.addEventListener) {
		// modern browsers do not support the unload event anyway, except for IE 9 and 10
		return;
	}
	if (dLib.ua.isIE_6) {
		try { // fix IE background image flicker (credit: www.mister-pixel.com)
			document.execCommand("BackgroundImageCache", false, true);
		}
		catch (err) {
		}
	}
	addEvent("unload", function(e) {
		if (dLib.ua.isIE_7 && dLib.ieSettings.doPurge) {
			DNode.purge(document.body);
		}
		dLib.event.listeners.forEach(function(entry) {
			if (entry.eventType !== "unload") {
				dLib.event.remove(entry.target, entry.eventType, entry.handler, entry.doCapture);
				entry.origHandler = null;
				entry.handler = null;
				entry = null;
			}
		});
	});
})();