// TODO: check this out: http://developer.mozilla.org/En/DragDrop/Drag_and_Drop - and this: http://developer.yahoo.com/ypatterns/parent.php?pattern=dragdrop
if (typeof dLib == "undefined") {
	throw new Error("DMousable.js: You must load DLib.js!");
}

function DMousable(dElement, captureDElements, config) {
	this.dElement = dElement; // wrapped element
	this.captureDElements = captureDElements; // wrapped element(s) to capture
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.initialized = false;
}

DMousable.stackOrder = 10000; // used in other files/applications - you should not use a z-index in your CSS higher than this value!

DMousable.defaultConfig = {
	scope: null,
	onInit: null,
	cursor: null,
//	startEvent: 'pointerdown mousedown touchstart',
//	moveEvent: 'pointermove mousemove touchmove',
//	resolveEndEvent(): 'pointerup mouseup touchend',
	dElementConfig: {
		useIframe: dLib.ua.isIE_6
	}
}

DMousable.prototype.init = function() {
	if (!this.initialized) {
		var cfg = this.config;
		this.dElement = g(this.dElement, cfg.dElementConfig);
		this.captureDElements = this.captureDElements ? g(this.captureDElements) : [this.dElement];
		if (!Array.isArray(this.captureDElements) || this.captureDElements.length == 0) {
			this.captureDElements = [this.captureDElements];
		}
		dLib.assert(this.captureDElements.every(function(entry) { return (entry instanceof DElement); }), "DMousable.js: Each entry must be an DElement instance!");
		this.style = this.dElement.getComputedStyle();
		this.zIndex = parseInt(this.style.zIndex, 10) || 0;
		this.bindEvents();
		this.initialized = true;
		this.fireHandler("onInit", []);
	}
	return this;
}

DMousable.prototype.fireHandler = dLib.util.fireHandler;

DMousable.prototype.bindEvents = function() {
	var f = this.captureHandler = this.getCaptureListener();
	if (typeof f == "function") {
		var cfg = this.config;
		for (var i = 0, l = this.captureDElements.length; i < l; i++) {
			var captureDElement = this.captureDElements[i].on(this.resolveStartEvent(), f);
			if (cfg.cursor) {
				captureDElement.css("cursor", cfg.cursor);
			}
		}
	}
	return this;
}

DMousable.prototype.resolveStartEvent = function() {
	var et = 'mousedown touchstart';
    if (window.PointerEvent || navigator.MSPointerEnabled || navigator.msPointerEnabled) {
		et = 'MSPointerDown';
	}
	else if (navigator.pointerEnabled) {
		et = 'pointerdown';
	}
	return et;
}

DMousable.prototype.resolveMoveEvent = function(eventType) {
    return eventType.replace(/down|start|up|end/, 'move').replace(/Down|Up/, 'Move');
}

DMousable.prototype.resolveEndEvent = function(eventType) {
    return eventType.replace('down', 'up').replace('start', 'end').replace('Down', 'Up');
}

DMousable.prototype.getCaptureElement = function(e) { // e must be instanceof DEvent
	var capture = e.target;
	while (capture) {
		if (this.captureDElements.some(function(entry) { return (entry.element == capture); })) { // to compare by reference (===) won't work in IE6
			return capture;
		}
		capture = capture.parentNode;
	}
	return null;
}

// override in subclass
DMousable.prototype.getCaptureListener = function() {
	return null;
}

DMousable.prototype.toString = function() {
	return "[object " + this.constructor.getName() + "] " + ((this.dElement && this.dElement.element) ? this.dElement.element.id : this.dElement);
}

function DDragable(dElement, captureElements, config) {
	DDragable.superConstructor.apply(this, [dElement, captureElements, config]);
	this.dragEventOffset = null; //[0, 0];
	this.dragOffset = null; //[0, 0];
	this.dropables = null;//[];
}

DDragable.inheritFrom(DMousable);

DDragable.instances = [];

// TODO: scroll option (when dragging to the edge of the browser window, scroll it accordingly - see Scriptaculous)
DDragable.defaultConfig = Object.configure({
	position: 'relative',
	dragClass: "dragging", // added class name when dragged
	constraint: "", // "horizontal" for only horizontal dragging and "vertical" for only vertical dragging TODO: object instead?
	revertStackOrder: true, // if true the original stack order is applied to the element when finished dragging
	clone: false, // should the dragable element be a (deep) clone of the original element TODO: finish
	cursor: 'move',
	onDrop: function(e, dropable, dragable) { // will be invoked if a dropable has been registered and dragging is released over any dropable. Will be executed in the scope of the scope property and passed the mouseup event object and the dropable instance
		dragable.onDrop.call(dragable, e, dropable);
	},
	onFallback: function(e, dragable) { // will be invoked if a dropable has been registered and dragging is released outside any dropable. Will be executed in the scope of the scope property and passed the mouseup event object
		dragable.onFallback.call(dragable, e);
	},
	onBeforeDragStart: null,
	onAfterDragStart: null,
	onBeforeDrag: null,
	onAfterDrag: null,
	onBeforeDragEnd: null,
	onAfterDragEnd: null
}, DMousable.defaultConfig);

DDragable.newInstance = function(element, captureElements, config) {
	var instance = new DDragable(element, captureElements, config);
	DDragable.instances.push(instance);
	return instance;
}

DDragable.get = function(dragableElement) {
	for (var i = 0, l = DDragable.instances.length; i < l; i++) {
		var dragable = DDragable.instances[i];
		if (dragable.dElement.element === dragableElement.element) {
			return dragable;
		}
	}
	return null;
}

DDragable.initAll = function() {
	for (var i = 0, l = DDragable.instances.length; i < l; i++) {
		DDragable.instances[i].init();
	}
}

DDragable.prototype.onDrop = function(e, dropable) {
	this.dElement.fadeOut({ callback: function() { this.hide(); } });
}

DDragable.prototype.onFallback = function(e) {
	this.dElement.slideTo(this.origPos, { transition: "spring" });
}

DDragable.prototype.getCaptureListener = function() {
	return this.dragStart.bindAsEventListener(this);
}

DDragable.prototype.fixConstraint = function() {
	var cfg = this.config, constraint = {};
	if (typeof cfg.constraint === 'string') {
		if (cfg.constraint === 'vertical') {
			constraint.x = { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
		}
		if (cfg.constraint === 'horizontal') {
			constraint.y = { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
		}
	}
	return constraint;
}

DDragable.prototype.init = function() {
	if (!this.initialized) {
		this.config.constraint = this.fixConstraint();
		DDragable.applySuper("init", this, []);
		this.dElement.prepareToMove(this.config.position);
		this.origPos = [parseInt(this.style.left, 10), parseInt(this.style.top, 10)];
	}
	return this;
}

DDragable.prototype.destroy = function() {
    if (this.initialized) {
        // TODO: finish
        this.initialized = false;
    }
}

DDragable.prototype.addDropable = function(dropable) {
	if (dropable instanceof DDropable) {
		if (!this.dropables) {
			this.dropables = [];
		}
		this.dropables.push(dropable);
	}
	return this;
}

DDragable.prototype.dragStart = function(e) {
	// if dragTarget evaluates to true it means that dragEnd wasn't called (the user could have dragged outside the browser window and released the mouse there)
	if (this.dragTarget || (e.isMouseEvent() && !e.isLeftButtonDown())) { // TODO: How to do this with pointer event?
		return;
	}
	if (this.fireHandler("onBeforeDragStart", [e])) {
		var tagName = e.target.tagName;
		if (typeof tagName == "string" && ['input', 'select', 'option', 'textarea', 'button'].contains(tagName.toLowerCase())) {
			return; // necessary in IE to keep default cursor and it fixes a Firefox issue
		}
		e.preventDefault().stopPropagation(); // important to prevent default here, prevents possible native dragstart and mousedown event from firing, but in webkit browsers and IE 10 dragstart and mousedown cannot coexists!!
		var cfg = this.config;
		this.dElement.addClass(cfg.dragClass).css('z-index', DMousable.stackOrder++);
		// start catching pointer coordinates
		this.dragEventOffset = [e.getPageX(), e.getPageY()];
		this.dragOffset = [this.dragEventOffset[0] - parseInt(this.style.left, 10), this.dragEventOffset[1] - parseInt(this.style.top, 10)];
		this.doHandler = this.drag.bindAsEventListener(this);
		this.releaseHandler = this.dragEnd.bindAsEventListener(this);
		this.dragTarget = g(this.dElement.getOwnerDocument()).on(this.resolveMoveEvent(e.type), this.doHandler, true).on(this.resolveEndEvent(e.type), this.releaseHandler, true);
	}
	this.fireHandler("onAfterDragStart", [e]);
}

DDragable.prototype.drag = function(e) {
    // move layer by keeping properties constant
    var x = e.getPageX() - this.dragOffset[0], y = e.getPageY() - this.dragOffset[1];
	if (this.fireHandler("onBeforeDrag", [e, x, y])) {
		e.preventDefault().stopPropagation();
		var cfg = this.config, xCfg = cfg.constraint.x, yCfg = cfg.constraint.y;
		if (xCfg && !(x >= xCfg.min && x <= xCfg.max)) {
			x = NaN;
		}
		if (yCfg && !(y >= yCfg.min && y <= yCfg.max)) {
			y = NaN;
		}
		this.dElement.moveTo([x, y]);
	}
	this.fireHandler("onAfterDrag", [e, x, y]);
}

DDragable.prototype.dragEnd = function(e) {
	if (this.fireHandler("onBeforeDragEnd", [e])) {
		// should not stop event propagation here, may ruin drop-down selection etc (is the case in Firefox).
		var cfg = this.config;
		this.dragTarget.off(this.resolveMoveEvent(e.type), this.doHandler, true).off(this.resolveEndEvent(e.type), this.releaseHandler, true);
		this.dElement.removeClass(cfg.dragClass);
		if (cfg.revertStackOrder && this.zIndex) {
			this.dElement.css("zIndex", this.zIndex);
		}
		// nullify references - we won't allow another drag if not reset
		this.doHandler = null;
		this.releaseHandler = null;
		this.dragTarget = null;
		this.drop(e);
	}
	this.fireHandler("onAfterDragEnd", [e]);
}

DDragable.prototype.drop = function(e) {
	var fire = false;
	if (this.dropables) {
		for (var i = 0, l = this.dropables.length; i < l; i++) {
			var dropable = this.dropables[i];
			if (dropable.dElement.isMouseOver(e)) {
				dropable.drop(e, this);
				fire = false;
				break;
			}
			fire = true;
		}
	}
	if (fire) {
		this.fireHandler("onFallback", [e]);
	}
}

function DDropable(dropElement, dragableElements, config) {
	DDropable.superConstructor.apply(this, [dropElement, dragableElements, config]);
}

DDropable.inheritFrom(DMousable);

DDropable.instances = [];

DDropable.defaultConfig = Object.configure({
	onDrop: null
}, DMousable.defaultConfig);

DDropable.newInstance = function(dropElement, dragableElements, config) {
	var instance = new DDropable(dropElement, dragableElements, config);
	DDropable.instances.push(instance);
	return instance;
}

DDropable.initAll = function() {
	for (var i = 0, l = DDropable.instances.length; i < l; i++) {
		DDropable.instances[i].init();
	}
}

DDropable.prototype.init = function() {
	if (!this.initialized) {
		DDropable.applySuper("init", this, []);
		for (var j = 0, n = this.captureDElements.length; j < n; j++) {
			var dragable = DDragable.get(this.captureDElements[j]);
			if (dragable) {
				dragable.addDropable(this);
			}
		}
	}
	return this;
}

// pointerup/mouseup/touchend event
DDropable.prototype.drop = function(e, dragable) {
	if (dragable.config.onDrop) {
		dragable.fireHandler("onDrop", [e, this]);
	}
	this.fireHandler("onDrop", [e, dragable]);
}

function DResizable(element, captureElements, config) {
	DResizable.superConstructor.apply(this, [element, captureElements, config]);
	this.resizeOffset = [0, 0];
	this.resizeDimension = [0, 0];
}

DResizable.inheritFrom(DMousable);

DResizable.instances = [];

DResizable.defaultConfig = Object.configure({
	resizeClass: "resizing", // added class name when resized
	cursor: "se-resize",
	constraint: "", // "horizontal" for only horizontal resizing and "vertical" for only vertical resizing
	revertStackOrder: true // if true the original stack order (if > 0) is applied to the element when finished dragging
}, DMousable.defaultConfig);

DResizable.newInstance = function(element, captureElements, config) {
	var instance = new DResizable(element, captureElements, config);
	DResizable.instances.push(instance);
	return instance;
}

DResizable.initAll = function() {
	for (var i = 0, l = DResizable.instances.length; i < l; i++) {
		DResizable.instances[i].init();
	}
}

DResizable.prototype.init = function() {
	if (!this.initialized) {
		DResizable.applySuper("init", this, []);
	}
}

DResizable.prototype.getCaptureListener = function() {
	return this.captureResize.bindAsEventListener(this);
}

DResizable.prototype.captureResize = function(e) {
	if (e.isMouseEvent() && !e.isLeftButtonDown()) {
		return;
	}
	if (this.fireHandler("onBeforeCaptureResize", [e])) {
		e.stopPropagation().preventDefault(); // important to prevent default!!
		var cfg = this.config;
		this.dElement.addClass(cfg.resizeClass);
		// start catching mouse coordinates
		this.resizeOffset = [e.getPageX(), e.getPageY()];
		this.resizeDimension = [this.dElement.getWidth(), this.dElement.getHeight()];
		this.doHandler = this.resize.bindAsEventListener(this);
		this.releaseHandler = this.releaseResize.bindAsEventListener(this);
		this.resizeTarget = g(this.dElement.getOwnerDocument()).on(this.resolveMoveEvent(e.type), this.doHandler, true).on(this.resolveEndEvent(e.type), this.releaseHandler, true);
	}
	this.fireHandler("onAfterCaptureResize", [e]);
}

DResizable.prototype.resize = function(e) {
	if (this.fireHandler("onBeforeResize", [e])) {
		e.stopPropagation().preventDefault(); // important to prevent default!!
		var d = [e.getPageX(), e.getPageY()].minus(this.resizeOffset).plus(this.resizeDimension);
		this.dElement.resizeTo(d);
	}
	this.fireHandler("onAfterResize", [e]);
}

DResizable.prototype.releaseResize = function(e) {
	if (this.fireHandler("onBeforeReleaseResize", [e])) {
		var cfg = this.config;
		this.resizeTarget.off(this.resolveMoveEvent(e.type), this.doHandler, true).off(this.resolveEndEvent(e.type), this.releaseHandler, true);
		this.dElement.removeClass(cfg.resizeClass);
		if (cfg.revertStackOrder && this.zIndex) {
			this.dElement.css("zIndex", this.zIndex);
		}
	}
	this.fireHandler("onAfterReleaseResize", [e]);
}

function DHoverable(hoverElement, captureElements, config) {
	DHoverable.superConstructor.apply(this, [hoverElement, captureElements || [null], config]);
	this.timerId = NaN;
}

DHoverable.inheritFrom(DMousable);

DHoverable.instances = [];

DHoverable.defaultConfig = Object.configure({
	position: 'absolute',
	useMouseOffset: true,
//	startEvent: 'mouseover',
//	endEvent: 'mouseout',
	offsetElement: null, // if not specified the mouseover element will be used
	corner: [0, 1], // only has effect if useMouseOffset is false - [x, y]: meaningful values for x are: -1 (right align), -0.5 (center), 0 (left align), 1 (left align on right side);  meaningful values for y are: -1 (bottom down), 1 (top up)
	offset: [0, 3], // adjustment in pixels for coordinates
	adjustToViewport: true, // adjust for possible scroll
	delay: 750, // delay before the hoverable element is hidden again
	onBeforeHover: null, // custom listener which is passed the wrapped event object - return false to exit the hover function, true otherwise
	onAfterHover: null, // custom listener which is passed the wrapped event object
	onBeforeReleaseHover: null, // custom listener which is passed the wrapped event object - return false to exit the hover function, true otherwise
	onAfterReleaseHover: null // custom listener which is passed the wrapped event object
}, DMousable.defaultConfig);

DHoverable.newInstance = function(hoverElement, captureElements, config) {
	var instance = new DHoverable(hoverElement, captureElements, config);
	DHoverable.instances.push(instance);
	return instance;
}

DHoverable.initAll = function() {
	for (var i = 0, l = DHoverable.instances.length; i < l; i++) {
		DHoverable.instances[i].init();
	}
}

DHoverable.prototype.init = function() {
	if (!this.initialized) {
		DHoverable.applySuper("init", this, []);
		this.dElement.prepareToMove(this.config.position);
	}
	return this;
}

DHoverable.prototype.resolveStartEvent = function() {
    return 'mouseover';
}

DHoverable.prototype.resolveEndEvent = function() {
    return 'mouseout';
}

DHoverable.prototype.bindEvents = function() {
	var fnOver = this.hover.bindAsEventListener(this);
	var fnOut = this.releaseHover.bindAsEventListener(this);
	var cfg = this.config;
	for (var i = 0, l = this.captureDElements.length; i < l; i++) {
		this.captureDElements[i].on(this.resolveStartEvent(), fnOver).on(this.resolveEndEvent(), fnOut);
	}
	this.dElement.on(this.resolveStartEvent(), this.cancelTimeout.bind(this)).on(this.resolveEndEvent(), fnOut);
	return this;
}

DHoverable.prototype.addCaptureElement = function(element) {
	var dElement = (element instanceof DElement) ? element : g(element);
	this.captureDElements.push(dElement);
	var fnOver = this.hover.bindAsEventListener(this);
	var fnOut = this.releaseHover.bindAsEventListener(this);
	dElement.on(this.resolveStartEvent(), fnOver).on(this.resolveEndEvent(), fnOut);
	return this;
}

DHoverable.prototype.hover = function(e) {
    if (!(e instanceof DEvent)) {
        e = g(e);
    }
	if (this.fireHandler("onBeforeHover", [e])) {
		e.preventDefault().stopPropagation();
		this.cancelTimeout();
		this.dElement.css("zIndex", DMousable.stackOrder++);
		this.captureElement = this.getCaptureElement(e);
		var pos = this.calcHoverPosition(e, this.config.offsetElement || this.captureElement);
		this.dElement.moveTo(pos, this.config.adjustToViewport).show();
	}
	this.fireHandler("onAfterHover", [e]);
    return this;
}

DHoverable.prototype.calcHoverPosition = function(e, offsetElement) {
	function indicator(expr) {
		return expr ? 1 : 0;
	}
	var target = offsetElement || e.target;
	this.dElement.css("display", "block"); // display must be block for offsets on element to be > 0
	var cfg = this.config;
	var offset = cfg.useMouseOffset ? [e.getPageX(), e.getPageY()] : DElement.getPageOffset(target);
	var x = offset[0];
	if (!cfg.useMouseOffset) {
		var c0 = cfg.corner[0];
		x += Math.abs(c0) * target.offsetWidth + indicator(c0 < 0) * c0 * this.dElement.element.offsetWidth;
	}
	x += cfg.offset[0];
	var y = offset[1];
	if (!cfg.useMouseOffset) {
		var c1 = cfg.corner[1];
		y += c1 * (indicator(c1 < 0) * this.dElement.element.offsetHeight + indicator(c1 >= 0) * target.offsetHeight);
	}
	y += cfg.offset[1];
	return [x, y];
}

DHoverable.prototype.releaseHover = function(e) {
	if (this.fireHandler("onBeforeReleaseHover", [e])) {
		if (isNaN(this.config.delay)) {
			this.hide(e);
		}
		else if (isNaN(this.timerId)) {
			var win = this.dElement.getDefaultView();
			if (!win || typeof win.setTimeout != "function") { // In Safari 2.0.4 the abstract view is not the same object as the window object
				win = window;
			}
			this.timerId = win.setTimeout(this.hide.bind(this), this.config.delay);
		}
	}
	this.fireHandler("onAfterReleaseHover", [e]);
    return this;
}

DHoverable.prototype.hide = function() {
	this.dElement.hide().moveTo([0, 0]);
    return this;
}

DHoverable.prototype.cancelTimeout = function() {
	if (isNaN(this.timerId)) {
		return this;
	}
	var win = this.dElement.getDefaultView();
	if (typeof win.setTimeout != "function") { // In Safari 2.0.4 the abstract view is not the same object as the window object
		win = window;
	}
	win.clearTimeout(this.timerId);
	this.timerId = NaN;
    return this;
}

function DZoomable(zoomableElement, config) {
	DZoomable.superConstructor.apply(this, [null, zoomableElement, config]);
	this.x = NaN;
	this.y = NaN;
	this.initialized = false;
}

DZoomable.defaultConfig = Object.configure({
	zoomClass: "DZoomable",
	zoom2D: true,
	adjustment: dLib.ua.isIE ? 2 : 0, // this adjustment seems to be necessary in IE (6+7) - don't know why. Be careful when changing. TODO
	doStopEventPropagation: true, // be careful when setting this to false!
	useBodyOffset: true, // calculate distance from document.body (true) or from parent tag (false). Is especially relevant for Internet Explorer and Safari. Depends on your HTML and CSS. In general it should be true for IE and Safari.
	borderWidth: NaN, // see the init method for explanation
	cursor: 'auto',
	zoomCursor: 'crosshair',
	onBeforeCaptureZoom: null,
	onAfterCaptureZoom: null,
	onBeforeZoom: null,
	onAfterZoom: null,
	onBeforeReleaseZoom: null,
	onAfterReleaseZoom: null // must be a function - is automatically executed in the scope of the zoomable instance unless already bound to another object and is always passed the mouseup event
}, DMousable.defaultConfig);

DZoomable.instances = [];

DZoomable.inheritFrom(DMousable);

DZoomable.newInstance = function(zoomableElement, config) {
	var instance = new DZoomable(zoomableElement, config);
	DZoomable.instances.push(instance);
	return instance;
}

DZoomable.initAll = function() {
	for (var i = 0, l = DZoomable.instances.length; i < l; i++) {
		DZoomable.instances[i].init();
	}
}

DZoomable.prototype.init = function() {
	if (!this.initialized) {
		var dElement = g(DElement.create("div", {
		    id: "divZoom" + new Date().getTime(),
		    'class': this.config.zoomClass
        }));
		// important not to set display to 'none', since this "ruins" (wrong values) the computed style object in Safari 2 and 3
		dElement.css({position: "absolute", visibility: "hidden"});
		document.body.appendChild(dElement.element);
		if (dLib.ua.isIE_6) { // IE6 cannot handle an empty DIV tag - won't set height under approximately 10px
			dElement.appendChild(document.createElement("span"));
		}
		this.dElement = dElement;
		DZoomable.applySuper("init", this, []);
		var arr = ["borderLeftWidth", "borderRightWidth", "borderTopWidth", "borderBottomWidth"].map(function(entry) { var v = this.parseCSS(entry); return isNaN(v) ? 0 : v; }, this.dElement);
		this.dx = arr[0] + arr[1];
		this.dy = arr[2] + arr[3];
	}
}

DZoomable.prototype.getCaptureListener = function() {
	return this.captureZoom.bindAsEventListener(this);
}

DZoomable.prototype.captureZoom = function(e) {
	if (e.isMouseEvent() && !e.isLeftButtonDown()) {
		return;
	}
	if (this.fireHandler("onBeforeCaptureZoom", [e])) {
		this.zoomTarget = g(this.getCaptureElement(e)).css("cursor", this.config.zoomCursor);
		e.preventDefault().stopPropagation();
		this.x = e.getPageX();
		this.y = e.getPageY();
		this.dElement.moveTo([this.x, this.y]).resizeTo([0, 0]);
		this.adjustHeight();
		this.dElement.css("zIndex", DMousable.stackOrder++).show();
		this.doHandler = this.zoom.bindAsEventListener(this);
		this.releaseHandler = this.releaseZoom.bindAsEventListener(this);
		this.moveTarget = g(this.dElement.getOwnerDocument()).on(this.resolveMoveEvent(e.type), this.doHandler, true).on(this.resolveEndEvent(e.type), this.releaseHandler, true);
	}
	this.fireHandler("onAfterCaptureZoom", [e]);
}

DZoomable.prototype.adjustHeight = function() {
	if (!this.config.zoom2D) {
		var dTarget = (this.zoomTarget.element === document && document.body) ? g(document.body) : this.zoomTarget;
		this.dElement.css("top", (this.config.useBodyOffset ? dTarget.getPageOffset()[1] : dTarget.element.offsetTop) + "px").setHeight(dTarget.element.offsetHeight - this.dy);
	}
}

DZoomable.prototype.zoom = function(e) {
	if (this.fireHandler("onBeforeZoom", [e])) {
		e.preventDefault().stopPropagation();
		var x = e.getPageX();
		var cfg = this.config, dTarget = this.zoomTarget, el = dTarget.element;
		var leftLimit = cfg.useBodyOffset ? dTarget.getPageOffset()[0] : el.offsetLeft;
		leftLimit += cfg.adjustment;
		var rightLimit = leftLimit + el.offsetWidth - 1;
		if (x >= leftLimit && x <= rightLimit) {
			if (x > this.x) {
				this.dElement.css("left", this.x + "px").setWidth(Math.max(x - this.x - this.dx + 1 - cfg.adjustment, 0));
			} else {
				this.dElement.css("left", (x - cfg.adjustment) + "px").setWidth(Math.max(this.x - x - this.dx / 2, 0));
			}
		}
		if (cfg.zoom2D) {
			var y = e.getPageY();
			var topLimit = cfg.useBodyOffset ? dTarget.getPageOffset()[1] : el.offsetTop;
			topLimit += cfg.adjustment;
			var bottomLimit = topLimit + el.offsetHeight - 1;
			if (y >= topLimit && y <= bottomLimit) {
				if (y > this.y) {
					this.dElement.css("top", this.y + "px").setHeight(Math.max(y - this.y - this.dy + 1 - cfg.adjustment, 0));
				} else {
					this.dElement.css("top", (y - cfg.adjustment) + "px").setHeight(Math.max(this.y - y - this.dy / 2, 0));
				}
			}
		}
	}
	this.fireHandler("onAfterZoom", [e]);
}

DZoomable.prototype.releaseZoom = function(e) {
	if (this.fireHandler("onBeforeReleaseZoom", [e])) {
		this.dElement.hide().moveTo([0, 0]);
		this.x = NaN;
		this.y = NaN;
		this.zoomTarget.css("cursor", this.config.cursor);
		this.moveTarget.off(this.resolveMoveEvent(e.type), this.doHandler, true).off(this.resolveEndEvent(e.type), this.releaseHandler, true);
	}
	this.fireHandler("onAfterReleaseZoom", [e]);
}

// save handler for possible removal later
DMousable.onDOMReadyListener = addDOMReadyListener(function() {
	DDragable.initAll();
	DDropable.initAll();
	DResizable.initAll();
	DHoverable.initAll();
	DZoomable.initAll();
});