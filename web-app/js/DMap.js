if (typeof dLib == "undefined") {
    throw new Error("DMap.js: You must load DLib.js!");
}
/*
 Geolocation with the Opera web browser
 What is geolocation? Why is it useful?

 Geolocation is the process of determining your location on Earth. Although the concept of geolocation is often connected with GPS, there is more than one way to determine your location when you are on the Internet. For example, your Internet address (IP address) can be used to determine roughly where you are, even without the more advanced methods of geolocation.

 Suppose that you want a more precise determination of your location than that provided by your IP address. For example, a website may want to know your location in order to provide you with a local map, or to identify a nearby restaurant or hotel. The Opera web browser (Opera) can tell the website approximately where you are, with the help of Google Location Services (GLS). Opera will always ask for your permission, and your privacy will always be respected.
 How do I turn it on?

 The first time you go to a website that requests geolocation information, Google Location Services' terms and conditions are presented. If you agree to them, the service is activated.

 After that, every time a website requests geolocation information, Opera tells you, and gives you a choice: to send your location data, or not to send it.

 If you at first reject Google Location Services' terms and conditions, but later change your mind, go to Settings > Preferences > Advanced > Network, and check "Allow websites to request my physical location".
 How do I turn it off?

 You can reject Google Location Services' terms and conditions. Alternatively, go to Settings > Preferences > Advanced > Network, and uncheck "Allow websites to request my physical location".
 How does geolocation work? How well does it work?

 It depends on the device, and its way of connecting to the Internet.

 If the device is a desktop computer, without any wireless connections, the IP address is used to determine the device's location, and the measurement is rather crude.

 To determine the location of a laptop or other wireless device, Opera may in addition send the following data from nearby Wi-Fi access points:
 MAC address (uniquely identifies the hardware)
 signal strength (tells how far away it is)

 A database of known Wi-Fi access points, together with measured signal strength, makes it possible to give rather precise location information. The success of this method depends largely on the concentration of known access points.

 If the device is connected to a mobile telephone network, location data may include cell IDS of the cell towers closest to you, and their signal strength. If the device is GPS-enabled, the location may be obtained via GPS.

 Any or all of the above methods may be used to determine the device's location, if the device has sufficient connectivity. In what follows, we refer to this data as the "location data".
 How do I know that a webpage is using location data?

 When you first go to a webpage that uses location data, Opera tells you, and you decide whether or not to send the data. Thereafter, a pin appears in the address field connected with that page. Clicking on the pin opens a site-specific preferences dialog where you can change the geolocation setting to one of three values: "Yes", "No", or "Ask me". The default is "Ask me".
 How is my privacy protected?

 Every time a website requests your location data, Opera tells you, and asks your permission to send it.

 With your permission, Opera passes the location data to Google Location Services, and sends an estimated latitude and longitude to the website. Opera does not save location data, nor are any cookies generated. Every time your location is requested, Opera redetermines the location data.

 The data passed to Google includes location data, plus a random client identifier (opera:config#Geolocation|AccessToken) assigned by Google, that expires after 2 weeks. The client identifier is used to distinguish requests, not to identify you. The data passed to Google is governed by Google's own Privacy Policy.

 The location information sent to the website is governed by the website's privacy policy. It is the responsibility of the website to dispose of this information in a way that is consistent with the W3C's Geolocation API Specification.

 Opera Software's Privacy Statement
 */
function DMap(id, config) {
    this.id = id;
	this.map = null;
    this.config = Object.configure(config, this.constructor.defaultConfig);
	this.prevPosition = null;
    this.latestPosition = null;
	this.isUserActive = false;
    this.initialized = false;
}

DMap.defaultConfig = {
    scope: null,
    onInit: null,
	locationAccuracyThreshold: 500, // measured in meters
	setViewOnInit: true,
    center: [51.51121, -0.11982],
    zoom: 7
}

DMap.instances = [];

DMap.initAll = function() {
    for (var i = 0, l = DMap.instances.length; i < l; i++) {
        DMap.instances[i].init();
    }
}

DMap.newInstance = function(id, config) {
    var instance = new DMap(id, config);
    DMap.instances.push(instance);
    return instance;
}

DMap.getInstance = function(id, instances) {
	instances = instances || DMap.instances;
	for (var i = 0, l = instances.length; i < l; i++) {
		var instance = instances[i];
		if (instance.id === id) {
			return instance;
		}
	}
	return null;
}

DMap.prototype.fireHandler = dLib.util.fireHandler;

DMap.prototype.toast = function(msgKey, arr) {
	return dLib.util.formatMessage(this.messages[msgKey], arr);
}

DMap.prototype.toString = function() {
    return "[object " + this.constructor.getName() + "] " + this.id;
}

DMap.prototype.init = function() {
    if (!this.initialized) {
        this.initMap();
        this.initialized = true;
        this.fireHandler("onInit", []);
    }
    return this;
}

// Only adds tiles, controls and events, we do not set the view here
DMap.prototype.initMap = function() {
    this.map = new L.Map(this.id);
    this.addTiles().addControls().addEvents();
	var cfg = this.config;
	if (cfg.setViewOnInit && cfg.center && cfg.zoom) {
		this.map.setView(cfg.center, cfg.zoom);
	}
    return this;
}

// calls setView with possible center and possible zoom level - is called on location found
DMap.prototype.updateMap = function(center, zoom) {
	this.setView(center, zoom);
    return this;
}

DMap.prototype.setView = function(center, zoom, forceReset) {
    if (!this.isUserActive) {
		center = center || this.config.center;
	    if (center instanceof Array) {
	        center = new L.LatLng(center[0], center[1]);
	    }
		this.map.setView(center, zoom || this.config.zoom, !!forceReset); // triggers moveend event
	    //this.map.panTo(center).setZoom(zoom || this.config.zoom);
	}
    return this;
}

DMap.prototype.addEvents = function() {
    return this;
}

DMap.prototype.addTiles = function() {
    var cloudmadeUrl = 'http://{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png',
        subDomains = ['otile1', 'otile2', 'otile3', 'otile4'],
        //cloudmadeAttrib = 'Data, imagery and map information provided by <a href="http://open.mapquest.co.uk" target="_blank">MapQuest</a>, <a href="http://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> and contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/" target="_blank">CC-BY-SA</a>';
        cloudmadeAttrib = 'Map data provided by <a href="http://open.mapquest.co.uk" target="_blank">MapQuest</a>, <a href="http://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> and contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/" target="_blank">CC-BY-SA</a>';
    new L.TileLayer(cloudmadeUrl, { maxZoom: 15, attribution: cloudmadeAttrib, subdomains: subDomains }).addTo(this.map);
//L.tileLayer('http://{s}.tile.cloudmade.com/API-key/997/256/{z}/{x}/{y}.png', {
//    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
//    maxZoom: 18
//}).addTo(this.map);
    return this;
}

DMap.prototype.addControls = function() {
	// not necessary to add any controls
	new L.Control.Scale().addTo(this.map);
    return this;
}

DMap.prototype.log = function(msg) {
	if (window.console && window.console.log) {
		window.console.log(msg);
	}
	return this;
}

DMap.prototype.showMessage = function(msg, showProgress, autoHideDelay) {
//	if (screen.width <= 480) {
//		return this;
//	}
	var dEl = g('divMessages');
	var append = false;
	if (showProgress) {
		dEl.addClass('progress');
	} else {
		dEl.removeClass('progress');
	}
	dEl.html('<div class="message">' + msg + '</div>', append, true).fadeIn({ to: .5, display: 'inline-block' });
	return this;
}

DMap.prototype.clearMessages = function() {
	var dEl = g('divMessages');
	dEl.removeClass('progress').hide().html('');
	return this;
}

DMap.prototype.stopWatching = function() {
	if (!isNaN(this.watchId)) {
		this.locationErrorCounter = -1;
		navigator.geolocation.clearWatch(this.watchId);
		this.watchId = NaN;
	}
	return this;
}

DMap.prototype.watchPosition = function(config) {
	if (isNaN(this.watchId)) {
	    if (navigator.geolocation) {
		    if (!this.watchConfig || config) {
			    this.watchConfig = Object.extend({
		            enableHighAccuracy: true, // true means 'prefer GPS', default is false
		            timeout: 10000, // default is Infinity
		            maximumAge: 0 // default is 0 (never cache)
		        }, config);
		    }
	    	this.showMessage(this.toast('location.detecting'), true);
	        this.watchId = navigator.geolocation.watchPosition(this.onLocationFound.bind(this), this.onLocationError.bind(this), this.watchConfig);
	    } else {
	        this.showMessage(this.toast('geolocation.none'));
	    }
	}
    return this;
}

DMap.prototype.rewatchPosition = function(config) {
	this.stopWatching();
	return this.watchPosition(config);
}

DMap.prototype.resolveZoomOnLocationFound = function() {
	// TODO: Should depend on screen size and DPI/PPI
	var sw = Math.max(screen.width, screen.height);
	if (sw <= 480) {
		return 13;
	}
	return 14;
}

DMap.prototype.onLocationFound = function(pos) {
    var point = pos.coords, cfg = this.config;
	if (isNaN(cfg.locationAccuracyThreshold) || point.accuracy <= cfg.locationAccuracyThreshold) {
		var resolveNumber = function(no) {
			if (typeof no != 'number' || isNaN(no)) {
				return '';
			}
			return no;
		}
		this.locationErrorCounter = -1;
		this.prevPosition = this.latestPosition || null;
	    this.latestPosition = {
	        latitude: point.latitude,
	        longitude: point.longitude,
	        accuracy: point.accuracy,
	        heading: resolveNumber(point.heading),
	        speed: resolveNumber(point.speed),
	        altitude: resolveNumber(point.altitude),
	        altitudeAccuracy: resolveNumber(point.altitudeAccuracy),
	        timestamp: new Date(pos.timestamp).toJSON()
	    }
        this.updateMap([point.latitude, point.longitude], this.resolveZoomOnLocationFound());
	} else {
		this.handleLocationError(this.toast('location.accuracyThresholdExceeded', point.accuracy), true);
	}
}

DMap.prototype.onLocationError = function(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            this.showMessage(this.toast('location.permission_denied'));
            break;
        case error.POSITION_UNAVAILABLE:
            this.handleLocationError(this.toast('location.position_unavailable'));
	        break;
        case error.TIMEOUT:
            this.handleLocationError(this.toast('location.timeout'));
            break;
        case error.UNKNOWN_ERROR:
        default:
            this.handleLocationError(this.toast('location.unknown_error'));
            break;
    }
}

DMap.prototype.handleLocationError = function(msg) {
	if (typeof this.locationErrorCounter != 'number') {
		this.locationErrorCounter = -1;
	}
	this.locationErrorCounter++;
	if (this.locationErrorCounter < 3) {
		this.log(msg);
	    this.showMessage(msg);
		// don't rewatch here as this break error counting logic
	    //this.rewatchPosition();
	} else {
		this.stopWatching();
		this.showMessage(this.toast('location.givingUp'));
	}
	return this;
}

DMap.prototype.setUserActive = function() {
	this.isUserActive = true;
    return this;
}

DMap.prototype.setUserInActive = function() {
    this.isUserActive = false;
    if (this.latestPosition) {
        this.map.setView([this.latestPosition.latitude, this.latestPosition.longitude], this.resolveZoomOnLocationFound());
    }
    return this;
}

// save handler for possible removal later
DMap.onDOMReadyListener = addDOMReadyListener(function() {
    DMap.initAll();
});