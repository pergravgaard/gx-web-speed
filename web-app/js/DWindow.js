// TODO: test remote use
if (typeof dLib == "undefined") {
	throw new Error('DWindow.js: You must load the file DLib.js in order to create a dynamic window!');
}

function DWindow(dElement, config) {
	this.dElement = dElement;
	this.dHeader = null;
	this.dContent = null;
	this.dFooter = null;
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.index = 0;
	this.minimized = false;
	this.modalized = !!this.config.modal;
	this.position = (this.modalized && !dLib.ua.isIE_6) ? 'fixed' : 'absolute';
	this.dDragable = null; // will be a DDragable instance if dragableConfig in config is a DDragable configuration object (just an object)
	this.initialized = false;
}

DWindow.defaultConfig = {
	modal: false, // If true a background layer (element) is positioned behind the dynamic window element to prevent the user from clicking on anything, but the window element. Only one window element can be shown in modal mode at a time! If modal, position will be fixed!
	dragable: false, // if true the DMousable.js file must be loaded too! If true the header element - if any - will act as a handle for dragging. You can add other elements by giving them the className property (defaults to 'DWindow') suffixed with 'Drag'
	resizable: false, // if true the DMousable.js file must be loaded too! If true the footer element - if any - will act as a handle for resizing. You can add other elements by giving them the className property (defaults to 'DWindow') suffixed with 'Resize'
	dragableConfig: null,
	resizableConfig: null,
	hideFooterOnMinimize: false,
	onInit: null,
	onBeforeShow: null,
	onAfterShow: null,
	onBeforeHide: null,
	onAfterHide: null,
	onBeforeMaximize: null,
	onAfterMaximize: null,
	onBeforeMinimize: null,
	onAfterMinimize: null,
	onBeforeClose: null,
	onAfterClose: null,
	className: "DWindow",
	dElementConfig: {
		useIframe: dLib.ua.isIE_6
	},
	modalCSS: {
		opacity: .75,
		backgroundColor: "#000"
	}
}

DWindow.instances = [];
DWindow.modalIndex = -1; // if an instance is shown in modal mode, no other instance can be shown!

DWindow.newInstance = function(dElement, config) {
	var instance = new DWindow(dElement, config);
	instance.index = DWindow.instances.length;
	DWindow.instances.push(instance);
	return instance;
}

DWindow.initAll = function() {
	for (var i = 0, l = DWindow.instances.length; i < l; i++) {
		DWindow.instances[i].init();
	}
}

DWindow.prototype.toString = function() {
	return "[object " + this.constructor.getName() + "] " + ((this.dElement && this.dElement.element) ? this.dElement.element.id : this.dElement);
}

DWindow.prototype.init = function() {
	if (this.initialized) {
		return this;
	}
	var cfg = this.config;
	this.dElement = g(this.dElement, cfg.dElementConfig).addClass(cfg.className).css('position', this.position);
	var win = this.dElement.getDefaultView();
	var id = DElement.getId(this.dElement);
	this.dHeader = g(id + "Header", null, win);
	var drags = [], resizes = [];
	if (this.dHeader) {
		this.dHeader.addClass(cfg.className + "Header");
		if (cfg.dragable) {
			drags.push(this.dHeader);
		}
	}
	this.dContent = (g(id + "Content", null, win) || this.dElement).addClass(cfg.className + "Content");
	this.dFooter = g(id + "Footer", null, win);
	if (this.dFooter) {
		this.dFooter.addClass(cfg.className + "Footer");
		if (cfg.resizable) {
			resizes.push(this.dFooter);
		}
	}
	this.initElements("Close").initElements("Maximize").initElements("Minimize").findElements("Drag", drags).findElements("Resize", resizes);
	if (drags.length) {
		dLib.assert(typeof DDragable === "function", "DWindow.js: The file DMousable.js must be loaded for the DWindow instance to be dragable!");
		var config = Object.extendAll({}, cfg.dragableConfig, { scope: this, position: this.position });
		this.dDragable = new DDragable(this.dElement, drags, config).init();
	}
	if (resizes.length) {
		dLib.assert(typeof DResizable === "function", "DWindow.js: The file DMousable.js must be loaded for the DWindow instance to be resizable!");
		var config = Object.extendAll({}, cfg.resizableConfig, { scope: this, onAfterCaptureResize: this.onAfterCaptureResize });
		this.dResizable = new DResizable(this.dContent, resizes, config).init();
	}
	if (this.modalized) {
		this.modalize();
	}
	this.initialized = true;
	this.fireHandler("onInit");
	return this;
}

DWindow.prototype.initElements = function(suffixClass, dEl) {
	dEl = dEl || this.dElement;
	q("." + this.config.className + suffixClass, dEl.element).forEach(function(dEl) {
		dEl.on("mousedown", this["on" + suffixClass].bindAsEventListener(this));
		if ((suffixClass == "Maximize" && !this.minimized) || (suffixClass == "Minimize" && this.minimized)) {
			dEl.hide();
		}
	}.bind(this), true);
	return this;
}

DWindow.prototype.findElements = function(suffixClass, arr, dEl) {
	dEl = dEl || this.dElement;
	q("." + this.config.className + suffixClass, dEl.element).forEach(function(el) {
		arr.push(el);
	});
	return this;
}

DWindow.prototype.onMinimize = function(e) {
	e.preventDefault().stopPropagation();
	if (this.minimized || !e.isLeftButtonDown()) {
		return this;
	}
	return this.fireMinimize(e);
}

DWindow.prototype.fireMinimize = function(e) {
	if (this.fireHandler("onBeforeMinimize", [e])) {
		this.minimize();
	}
	this.fireHandler("onAfterMinimize", [e]);
	return this;
}

DWindow.prototype.minimize = function() {
	if (!this.minimized) {
		this.prevCSS = { height: this.dContent.getHeight(false) + "px" };
		['borderTopWidth', 'borderBottomWidth', 'paddingTop', 'paddingBottom'].forEach(function(n) {
			this.prevCSS[n] = (parseInt(this.dContent.parseCSS(n), 10) || 0) + "px";
		}, this);
		this.dContent.css({ height: 0, paddingTop: 0, paddingBottom: 0, borderTopWidth: 0, borderBottomWidth: 0 });
		var cfg = this.config;
		if (this.dFooter && this.config.hideFooterOnMinimize) {
			this.dFooter.hide();
		}
		this.toggleMinMax();
		this.minimized = true;
	}
	return this;
}

DWindow.prototype.toggleMinMax = function() {
	var cName = this.config.className;
	q("." + cName + "Minimize, ." + cName + "Maximize", this.dElement.element).forEach(function(dEl) {
		if (dEl.isDisplayed()) {
			dEl.hide();
		} else {
			dEl.show();
		}
	}, true);
	return this;
}

DWindow.prototype.onMaximize = function(e) {
	e.preventDefault().stopPropagation();
	if (!this.minimized || !e.isLeftButtonDown()) {
		return this;
	}
	return this.fireMaximize(e);
}

DWindow.prototype.fireMaximize = function(e) {
	if (this.fireHandler("onBeforeMaximize", [e])) {
		this.maximize();
	}
	this.fireHandler("onAfterMaximize", [e]);
	return this;
}

DWindow.prototype.maximize = function() {
	if (this.minimized) {
		this.dContent.css(this.prevCSS);
		if (this.dFooter) {
			this.dFooter.show();
		}
		this.toggleMinMax();
		this.minimized = false;
	}
	return this;
}

DWindow.prototype.onClose = function(e) {
	e.preventDefault().stopPropagation();
	if (!e.isLeftButtonDown()) {
		return this;
	}
	return this.fireClose(e);
}

DWindow.prototype.fireClose = function(e) {
	if (this.fireHandler("onBeforeClose", [e])) {
		this.close();
	}
	this.fireHandler("onAfterClose", [e]);
	return this;
}

DWindow.prototype.close = function() {
	if (this.modalized) {
		DWindow.modalIndex = -1;
		this.modalBackground.hide();
	}
	this.dElement.hide();
	return this;
}

DWindow.prototype.modalize = function() {
	var dEl = this.modalBackground;
	var z = (typeof DMousable == "function") ? DMousable.stackOrder : parseInt(this.dElement.getComputedStyle().zIndex, 10); // if DMousable is present let it handle the stacking order
	if (!z) {
		z = 10000;
	}
	if (dEl) { // only adjust z-index
		dEl.css("zIndex", z);
		if (dEl.iframe) {
			DElement.css(dEl.iframe, "zIndex", "" + z);
		}
	} else {
		var div = DElement.create("div", { id: "divModal" + this.dElement.getId() });
		this.dElement.insertBefore(div);
		this.modalBackground = dEl = g(div, this.config.dElementConfig, this.dElement.getDefaultView());
		var css = Object.extendAll({}, this.config.modalCSS, {
			position: this.position,
			left: 0,
			top: 0,
			display: "none",
			zIndex: z - 1, // if dragable the z-index will be overridden!
			width: "100%",
			height: (function(doc) {
				var el = g(doc).getViewportElement();
				return dLib.ua.isIE_6 ? Math.max(el.clientHeight, el.scrollHeight) + "px" : "100%";
			})(this.dElement.getOwnerDocument())
		});
		dEl.css(css);
		dEl.prepareToMove(this.position);
		if (dEl.iframe) {
			css.opacity = 0;
			delete css.display;
			DElement.css(dEl.iframe, css);
		}
	}
	this.dElement.css("zIndex", z);
	this.modalized = true;
	return this;
}

DWindow.prototype.fireHandler = dLib.util.fireHandler;

DWindow.prototype.css = function(name, value) {
	this.dElement.css(name, value);
	return this;
}

// center on screen
DWindow.prototype.center = function(adjustForScroll) {
	this.dElement.center(adjustForScroll);
	return this;
}

DWindow.prototype.getLeft = function(useOffset) {
	return this.dElement.getLeft(useOffset);
}

DWindow.prototype.getTop = function(useOffset) {
	return this.dElement.getTop(useOffset);
}

DWindow.prototype.getWidth = function(useOffset) {
	return this.dElement.getWidth(useOffset);
}

DWindow.prototype.getHeight = function(useOffset) {
	return this.dElement.getHeight(useOffset);
}

DWindow.prototype.moveTo = function(pos, adjustToViewport, ignoreScroll) {
	this.dElement.moveTo(pos, adjustToViewport, ignoreScroll);
	return this;
}

DWindow.prototype.show = function() {
	if (DWindow.modalIndex > -1) {
		return this;
	}
	if (this.fireHandler("onBeforeShow")) {
		if (this.modalized) {
			DWindow.modalIndex = this.index;
			this.modalBackground.show();
		}
		this.dElement.show();
	}
	this.fireHandler("onAfterShow");
	return this;
}

DWindow.prototype.hide = function() {
	if (this.fireHandler("onBeforeHide")) {
		if (this.modalized) {
			DWindow.modalIndex = -1;
			this.modalBackground.hide();
		}
		this.dElement.hide();
	}
	this.fireHandler("onAfterHide");
	return this;
}

DWindow.prototype.onAfterCaptureResize = function(e, dResize) {
	if (this.minimized) {
		this.dContent.css(this.prevCSS);
		this.minimized = false;
	}
	this.fireHandler("onAfterCaptureResize", [e, dResize], this.config.resizableConfig);
}

DWindow.prototype.write = function(htm, append) {
	if (this.dContent) {
		this.dContent.write(htm, append);
	}
	return this;
}

DWindow.prototype.writeHeader = function(htm, append) {
	if (this.dHeader) {
		this.dHeader.write(htm, append);
	}
	return this;
}

DWindow.prototype.writeFooter = function(htm, append) {
	if (this.dFooter) {
		this.dFooter.write(htm, append);
	}
	return this;
}

// Some predefined animations
DWindow.prototype.dropFromCeiling = function() {
	this.show();
	var c = this.dElement.calculateCenter();
	var pos = [c[0], -this.getHeight()];
	this.moveTo(pos);
	var thisObj = this;
	setTimeout(function() {
		thisObj.dElement.slideTo(c, {transition: 'spring', duration: 750});
	}, 150);
}

DWindow.onDOMReadyListener = domReady(DWindow.initAll);