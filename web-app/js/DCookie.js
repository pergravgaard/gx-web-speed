if (typeof dLib == "undefined") {
	throw new Error("DCookie.js: You must load DLib.js!");
}

/*	When you create an instance of the DCookie class, you do not automatically create a cookie on the web page.
	To do that you must call the save method or the saveSingleValue method.
	In the configuration object you can specify the expiration, the path and the domain.
	The expiration can be set a date or by a number of seconds. See DCookie.defaultConfig.
	The path and the domain concerns the visibility/readability of the cookie.
	Please note that the configuration object is only needed if you wan't to set a cookie! Not if you only wan't to read one.
	Be careful with the path property and restful URL's in Internet Explorer.
	Let's say that you're on the page http://www.yourdomain.com/contextPath/list.
	Then Internet Explorer (6 + 7 + 8 + 9 beta) will only set the cookie header, so you can read it on the server.
	But it won't appear in document.cookie and is therefore not readable via JavaScript.
	NOTE:
	Setting
	document.cookie = "test; path=<some-path>";
	does not generate a cookie with the name 'test' and no value, but a	cookie with no name (the empty string) and the value 'test'.*/

function DCookie(name, config, win) {
	this.name = "anonymousDCookie"; // it is strongly discouraged to use the empty string for the name! Opera does not create a cookie with the empty string as the name.
	var cfg = this.config = Object.configure(config, this.constructor.defaultConfig);
	if (typeof name == "string") {
		var found = /[;=]/g.exec(name);
		dLib.assert(!found, 'DCookie.js: You cannot create an instance of the DCookie class with the character \'' + (found ? found[0] : '') + '\' in the name!');
		this.name = name;
	}
	// the win property gives you the possibility to create and read cookies in another window/frame.
	this.win = (win && win.document) ? win : window;
	this.expiryDate = Date.isDate(cfg.expiryDate) ? cfg.expiryDate : null;
	this.maxAge = NaN;
	if (this.expiryDate) {
		var ms = this.expiryDate.getTime() - new Date().getTime();
		if (ms > 0) {
			this.maxAge = parseInt(ms / 1000, 10);
		}
	} else {
		var maxAge = parseInt(cfg.maxAge, 10);
		this.maxAge = (maxAge <= 0) ? NaN : maxAge;
	}
	this.setPath(cfg.path || DCookie.getDefaultPath(this.win), this.win);
	this.setDomain(cfg.domain || DCookie.getDefaultDomain(this.win), this.win);
	this.secure = !!cfg.secure;
}

DCookie.defaultConfig = {
	expiryDate: null, // must be a date or use maxAge instead
	maxAge: NaN, // measured in seconds
	path: "", /* By default the cookie is only accessible to pages in the same directory as the page that created it and any subdirectories of that directory. This means that the path by default is the pathname of the location object except for a possible filename. */
	domain: "", /* By default the domain is the hostname property of the location object. The browser automatically prevents you from setting the domain to a domain that is not a parent domain of the hostname property. */
	secure: false, /* If secure the cookie is only visible if the page is visited using a secure protocol like https. Note that you can always create a secure cookie even though the page is not using a secure connection!	*/
	del1: "$&$",
	del2: "$:$",
	del3: "$#$",
	preSyl: "$DCookie$"
}

DCookie.removeAll = function(config, win) {
	var cfg = Object.configure(config, DCookie.defaultConfig);
	function isExcluded(name) {
		if (Array.isArray(cfg.excludes) && typeof name == "string" && name) {
			return cfg.excludes.contains(name);
		}
		return false;
	}
	win = win || window;
	var cookies = win.document.cookie.split(/;[\s]{0,}/);
	for (var i = 0, l = cookies.length; i < l; i++) {
		var arr = cookies[i].split("=");
		if (arr.length == 1) {
			arr.unshift(""); // remove cookies with no name
		}
		if (arr.length > 1 && !isExcluded(arr[0])) {
			// no need for setting secure - if this connection is secure the cookie will be removed (secure or not)
			new DCookie(arr[0], cfg, win).remove();
		}
	}
}

// returns null if a cookie with the specified name doesn't exist
DCookie.readCookie = function(name, win) {
	dLib.assert(typeof name === "string" && name, "DCookie.js: The static method 'readCookie' needs a non-empty string (the name of the cookie) as the first argument!");
	win = win || window;
	if (!win.document.cookie) {
		return null;
	}
	// most browsers automatically puts a space after the semicolon
	var value, cookieArray = win.document.cookie.split(/;[\s]{0,}/);
	for (var i = cookieArray.length - 1; i >= 0; --i) { // must be traversed backwards - the latest cookie will be the last (two cookies can have the same name, but not the same visibility)
		var arr = cookieArray[i].split("=");
		// some forget to encode the value and just uses the equal sign (=) in the value :-/
		if (arr.length > 1 && arr[0] == name) {
			value = "";
			for (var j = 1, l = arr.length; j < l; j++) {
				var sep = (j > 1) ? "=" : "";
				value += sep + arr[j];
			}
			break;
		}
	}
	if (value) {
		return decodeURIComponent(value);
	}
	return null;
}

/*	The default path is the pathname of the location object of the window
	object for the cookie except for a possible filename. */
DCookie.getDefaultPath = function(win) {
	win = win || window;
	var defaultPath = win.location.pathname;
	/* remove possible trailing slash or possible filename	*/
	var dotIndex = defaultPath.lastIndexOf(".");
	// if there is a dot assume the last dot is part of a filename in the pathname
	if (dotIndex > -1) {
		defaultPath = defaultPath.substring(0, dotIndex);
		var slashIndex = defaultPath.lastIndexOf("/");
		if (slashIndex > -1 && slashIndex < dotIndex) {
			defaultPath = defaultPath.substring(0, slashIndex + 1);
		}
	}
	return defaultPath;
}

/*	Method to ensure a visible path for the cookie.
	The default path is the pathname of the location object of the window
	object for the cookie except for the last slash and the possible filename. */
DCookie.isVisiblePath = function(path, win) {
	/*	Setting the path to the empty string makes no sense. Then no pages on your web server is
	 *	associated with your cookie. Make sure you don't make the cookie inaccessible to the page
	 *	- path must be contained in the beginning of defaultPath.	 */
	if (typeof path == "string" && path) {
		var defaultPath = DCookie.getDefaultPath(win || window);
		return (defaultPath.toLowerCase().indexOf(path.toLowerCase()) == 0);
	}
	return false;
}

DCookie.getDefaultDomain = function(win) {
	return (win || window).document.domain; // the default value of document.domain is location.hostname
}

/*	Method to ensure a valid domain for the cookie.
	The domain must be contained in the end of location.hostname.
	If the hostname property does not contain at least two dots the domain cannot be changed.
	Furthermore	the new domain must contain at least one dot. */
DCookie.isValidDomain = function(domain, win) {
	domain = (domain.indexOf('.') == 0) ? domain.substring(1) : domain; // if the default domain is google.com and a value of is .google.com is specified it is allowed by all browsers
	return (DCookie.getDefaultDomain(win || window).indexOf(domain) > -1);
}

DCookie.prototype.toString = function() {
	var s = "[object DCookie] " + this.name;
	s += "\npath: " + this.path;
	s += "\ndomain: " + this.domain;
	s += "\nexpires: " + (!!this.expiryDate ? this.expiryDate.toString() : "at end of session");
	s += "\nsecure: " + this.secure;
	return s;
}

// populate the parameters from possible existing cookie
DCookie.prototype.read = function() {
    var value = this.getValue();
    if (value) {
        var valuesArray = value.split(this.config.del1);
        for (var i = 0, l = valuesArray.length; i < l; i++) {
            var arr = valuesArray[i].split(this.config.del2);
            if (arr.length == 2) {
                this.setParameter(arr[0], arr[1]);
            }
        }
    }
    return this;
}

DCookie.prototype.save = function(preserveOtherParameters) {
	preserveOtherParameters = (typeof preserveOtherParameters != "boolean") ? true : preserveOtherParameters;
	var cookieValue = "";
	if (preserveOtherParameters) {
		var value = this.getValue();
		if (value) {
			var valuesArray = value.split(this.config.del1);
			for (var i = 0, l = valuesArray.length; i < l; i++) {
				var arr = valuesArray[i].split(this.config.del2);
				if (arr.length == 2) {
					if (typeof this[this.config.preSyl + arr[0]] == "undefined") {
						cookieValue += arr[0] + this.config.del2 + arr[1];
					}
				}
			}
		}
	}
	for (var p in this)	{
		if (p.indexOf(this.config.preSyl) == 0 && typeof this[p] == "string") {
			if (cookieValue) {
				cookieValue += this.config.del1;
			}
			cookieValue += p.substring(this.config.preSyl.length) + this.config.del2 + this[p];
		}
	}
	cookieValue = this.name + "=" + encodeURIComponent(cookieValue) + this.getCookieSettings();
	this.win.document.cookie = cookieValue;
	return this;
}

// The value is not saved in the DCookie instance and does not remove existing parameters!
DCookie.prototype.saveSingleValue = function(cookieValue, doEncode) {
	doEncode = (typeof doEncode != "boolean") ? true : doEncode;
	this.win.document.cookie = this.name + "=" + (doEncode ? encodeURIComponent(cookieValue) : cookieValue) + this.getCookieSettings();
	return this;
}

DCookie.prototype.getCookieSettings = function() {
	var settings = "";
	if (this.expiryDate) {
		settings += "; expires=" + this.expiryDate.toUTCString();
	}
	if (!isNaN(this.maxAge)) {
		settings += "; max-age=" + this.maxAge;
	}
	if (this.path) {
		settings += "; path=" + this.path;
	}
	/*	If the domain does not contain a dot, Firefox and IE won't save the cookie.
		But they will display the domain without the dot when viewing the cookie in the browser.
		In Firefox domain must not equal location.hostname.	*/
	if (this.domain && this.domain.indexOf(".") > -1 && this.domain != this.win.location.hostname) {
		settings += "; domain=" + this.domain;
	}
	if (this.secure) {
		settings += "; secure";
	}
	return settings;
}

/*	For a given document cookies must have the same name, the same path and the same domain to be considered the same.
 *	It is not enough that they have the same name. IE seems to ignore the path when the expiry date is in the past.
 *	Note that this method cannot be named 'delete' (even though a better name than 'remove') because
 *	'delete' is a reserved identifier.
 *	Also note that you can only remove a cookie if you know the path and domain with which it was created!
 *	Furthermore if the cookie is secure you can only remove it if the current connection is secure.
 *	But you can remove an unsecure cookie using a secure connection!
 *	Be aware that neither the path, the domain nor the secure property can be read in the cookie in any way!
 */
DCookie.prototype.remove = function() {
	var maxAge = this.maxAge;
	var expiryDate = this.expiryDate;
	this.expiryDate = new Date().addYear(-1);
	this.maxAge = 0;
	this.save(false);
	this.expiryDate = expiryDate;
	this.maxAge = maxAge;
	return this;
}

DCookie.prototype.getValue = function() {
	return DCookie.readCookie(this.name, this.win);
}

DCookie.prototype.getParameterNames = function() {
    var pNames = [];
    for (var p in this) {
        if (p.indexOf(this.config.preSyl) == 0) {
            pNames.push(p.replace(this.config.preSyl, ''));
        }
    }
    return pNames;
}

DCookie.prototype.getParameterMap = function() {
    var params = {};
    for (var p in this) {
        if (p.indexOf(this.config.preSyl) == 0) {
            var n = p.replace(this.config.preSyl, '');
            params[n] = this.getParameter(n);
        }
    }
    return params;
}

DCookie.prototype.getParameter = function(name) {
	if (typeof name == "string" && name) {
		var value = this.getValue();
		if (value) {
			var valuesArray = value.split(this.config.del1);
			for (var i = 0, l = valuesArray.length; i < l; i++) {
				var arr = valuesArray[i].split(this.config.del2);
				if (arr.length == 2) {
					if (arr[0] == name) {
						return decodeURIComponent(arr[1]);
					}
				}
			}
		}
	}
	return null;
}

/* Returns a parameter as an array, if the parameter was saved as an array. */
DCookie.prototype.getParameterValues = function(name) {
	var arrayString = this.getParameter(name);
	if (arrayString) {
		// if the delimiter is not found in the string, split just returns an array with one entry; the value of the string.
		return arrayString.split(this.config.del3);
	}
	return null;
}

DCookie.prototype.removeParameter = function(name) {
	return this.setParameter(name, null);
}

/*	Method for assigning a name/value pair to the cookie.
	Note that the cookie instance must be saved before the parameter is
	actually written to the cookie in the web page. Setting a parameter to null
	removes it.	*/
DCookie.prototype.setParameter = function(name, value) {
	if (typeof value != "string" && (value != null || typeof value == "undefined")) {
		value = "" + value;
	}
	// if the parameter already exists it is overwritten
	this[this.config.preSyl + name] = (value != null) ? encodeURIComponent(value) : value;
	return this;
}

/* Method for saving an array as a parameter.	*/
DCookie.prototype.setParameterValues = function(name, valueArray) {
	if (Array.isArray(valueArray)) {
		this.setParameter(name, valueArray.join(this.config.del3));
	}
	return this;
}

DCookie.prototype.setExpiryDate = function(expiryDate) {
	if (Date.isDate(expiryDate)) {
		this.expiryDate = expiryDate.clone();
		var ms = this.expiryDate.getTime() - new Date().getTime();
		this.maxAge = parseInt(ms / 1000, 10);
	}
	return this;
}

/*	Note that it is possible to set a cookie that is invisible to the current page/location! DCookie.isVisiblePath is called to prevent this!	*/
DCookie.prototype.setPath = function(path) {
	dLib.assert(DCookie.isVisiblePath(path, this.win), "DCookie.js: The path '" + path + "' is invisible for this location!");
	this.path = path;
	return this;
}

/*	Note that you can only set the domain to a parent domain of the current location!
	If you wish to validate your value use DCookie.validateDomain.	*/
DCookie.prototype.setDomain = function(domain) {
	dLib.assert(DCookie.isValidDomain(domain, this.win), "DCookie.js: The domain '" + domain + "' is invalid for this location!");
	this.domain = domain;
	return this;
}

/*	If the current location is not secure the cookie will be invisible to this page/location,
	when secure is set to true.
	If secure is not specified, the cookie is visible to any type of connection.	*/
DCookie.prototype.setSecure = function(secure) {
	if (typeof secure == "boolean") {
		this.secure = secure;
	}
	return this;
}