var dBrowser = {

	jsVersion: "1.0",

	cookieEnabled: (typeof navigator.cookieEnabled == "boolean") ? navigator.cookieEnabled : false,

	isCookieEnabled: function() {
		if (document.cookie) {
			return true;
		}
		var secure = (location.protocol.indexOf('https') > -1);
		document.cookie = "TestCookie=dummy" + (secure) ? "; secure" : "";
		if (document.cookie) {
			document.cookie = "TestCookie=dummy; expires=Fri, 02-Jan-1970 00:00:00 GMT" + (secure) ? "; secure" : "";
			return true;
		}
		return false;
	},

	// returns the IP address
	getHostAddress: function() {
		try {
			return java.net.InetAddress.getLocalHost().getHostAddress();
		}
		catch (ex) {
			//	It is possible in IE to detect the IP address.
			//	See http://www.devarticles.com/c/a/JavaScript/Advanced-JavaScript-with-Internet-Explorer-Retrieving-Networking-Configuration-Information/
			//	Unfortunately both IE 6, 7 and 8 prompts the user for permission to run the ActiveX object.
			return "";
		}
	},

	getHostName: function() {
		try {
			return java.net.InetAddress.getLocalHost().getHostName();
		}
		catch (ex) {
			return "";
		}
	}
};

(function() {
	var version, htm = '';
	for (var i = 10; i <= 25; i++) {
		version = "" + i;
		version = version.charAt(0) + "." + version.charAt(1);
		// seems like Opera 8.51 ignores the language attribute - fx it reads the 2.0 assignment
		document.writeln('<script language="JavaScript' + version + '">dBrowser.jsVersion = "' + version + '";<\/script>'); // necessary to write immediately in NS4
		// this is the right way according to the standards, but is not supported by older browsers and IE6/7
		htm += '<script type="text/javascript;version=' + version + '">dBrowser.jsVersion = "' + version + '";<\/script>\r\n';
	}
	// must write this AFTER the loop in Opera
	document.writeln(htm);
	var ua = dBrowser;
	ua.cookieEnabled = ua.cookieEnabled || ua.isCookieEnabled();
	var agent = navigator.userAgent.toLowerCase();
	// navigator.platform was introduced in JavaScript 1.2
	var platform = (typeof navigator.platform == "string") ? navigator.platform.toLowerCase() : agent;
	var vendor = (typeof navigator.vendor == "string") ? navigator.vendor.toLowerCase() : "";
	ua.isChrome = (function() {
        return agent.indexOf(' crios/') > -1
            || agent.indexOf(' chrome/') > -1
            || agent.indexOf(' chromium/') > -1
            || (agent.indexOf(' android ') > -1 && agent.indexOf(' applewebkit/') > -1 && agent.indexOf(' safari/') > -1);
    })();
    ua.isNativeChrome = (function() {
        return ua.isChrome && agent.indexOf(' android ') > -1 && agent.indexOf(' version/') > -1;
        // 4.2.2 Chrome: Mozilla/5.0 (Linux; Android 4.2.2; GT-I9505 Build/JDQ39) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.94 Mobile Safari/537.36
        // 4.2.2 Native: Mozilla/5.0 (Linux; Android 4.2.2; en-gb; SAMSUNG GT-I9505 Build/JDQ39) AppleWebKit/535.19 (KHTML, like Gecko) Version/1.0 Chrome/18.0.1025.308 Mobile Safari/535.19
        // 2.3.4 Native: Mozilla/5.0 (Linux; U; Android 2.3.4; en-gb; SonyEricssonST17i Build/4.0.2.A.0.84) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1
    })();
    // TODO: The following like properties are not correct on tablets/ipads!!
	ua.isLikeSafari = (vendor.indexOf("apple") > -1 && !ua.isChrome); // vendor contains 'apple' in Shiira and Chrome too
	ua.isLikeSafari3 = ua.isLikeSafari && !!window.Entity; // Entity is supported in Shiira too
	ua.isLikeSafari4 = ua.isLikeSafari3 && !!window.CanvasRenderingContext2D; // CanvasRenderingContext2D is supported in Shiira too
	ua.isLikeSafari_2 = ua.isLikeSafari && !ua.isLikeSafari3; // is less than or equal to a Safari2 like browser
	ua.isLikeSafari_3 = ua.isLikeSafari3 && !ua.isLikeSafari4; // is less than or equal to a Safari3 like browser
	//ua.isSafari = ua.isLikeSafari && !!window.showModalDialog; // Shiira and OmniWeb does not support showModalDialog
    ua.isSafari = (function() {
        return agent.indexOf(' android ') == -1 && agent.indexOf(' safari/') > -1 && !ua.isChrome;
    })();
	ua.isSafari3 = ua.isLikeSafari3 && !!window.showModalDialog;
	ua.isSafari4 = ua.isLikeSafari4 && !!window.showModalDialog;
	ua.isShiira = ua.isLikeSafari && !window.showModalDialog; // Shiira does not support showModalDialog
	ua.isOpera = !!window.opera;
	ua.isOpera9 = ua.isOpera && typeof XPathResult != "undefined";
	ua.isOpera95 = ua.isOpera9 && typeof navigator.onLine == "boolean";
	ua.isOpera_8 = ua.isOpera && !ua.isOpera9;
	ua.isOpera_9 = ua.isOpera && !ua.isOpera95;
	ua.isIE = !!window.ActiveXObject && !!window.showModalDialog && !!document.all && !ua.isOpera;
	/*@cc_on
		ua.isIE = true;
	@*/
	ua.isIE5 = ua.isIE && !!window.attachEvent; // is IE5 or higher
	ua.isIE55 = ua.isIE && !!window.createPopup; // is IE5.5 or higher
	ua.isIE6 = ua.isIE && !!document.compatMode; // is IE6 or higher
	// In IE7 native XMLHttpRequest support may be disabled causing window.XMLHttpRequest to be undefined and Conditional Comments written with document.write won't work!
	ua.isIE7 = ua.isIE && !!document.documentElement && typeof document.documentElement.style.maxHeight != "undefined"; // is IE7 or higher
	ua.isIE8 = ua.isIE && !!window.XDomainRequest; // is IE8 or higher (cannot this be disabled in IE8)
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
	ua.isIOS = (platform.indexOf('ipad') > -1 || platform.indexOf('iphone') > -1);
	ua.isApple = ua.isMac || ua.isIOS;
	ua.isAndroid = (platform.indexOf('linux arm') > -1);
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
	ua.isSVGSupported = (function() {
		try {
			return !!document.createElementNS && !!document.createElementNS('http://www.w3.org/2000/svg', "svg").createSVGRect; // Modernizr
			//return document.implementation && document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1");
		}
		catch (err) {
			alert('caught error');
		}
		return false;
	})();
	ua.isCanvasSupported = !!window.HTMLCanvasElement;
	ua.isCanvas2DSupported = !!window.CanvasRenderingContext2D;
	ua.isWebGLSupported = (function() {
		if (window.WebGLRenderingContext) {
			var c = document.createElement("canvas");
            return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
		}
		return false;
	})();
})();