// TODO:
// - Fix TODO's
// - rotation jumps when you start sliding the second time FIXED
// - snap does not work when rotated? FIXED
// - make work in IE10+ - is really a fix for DMousable.js FIXED
// - should it be possible to specify min and max offset for the range? DONE
// - click event should be mousedown or touchstart or pointerdown FIXED
// - server url in config DONE
// - Should default stepSize be 1? FIXED
// - use clip and not width/height to adjust level DONE
// - dir does not work FIXED
// - fill from center - DONE

if (typeof DMousable !== "function") {
	throw new Error("DSlider.js: You must load DMousable.js!");
}

function DSlider(dElement, config) {
	this.dElement = dElement;
	this.dRange = null;
	this.dHandle = null;
	this.dDragable = null;
	this.dTooltip = null;
	this.dServerLevel = null;
	this.key = '';
	this.stepSize = 0;
	this.centered = false;
	this.vertical = false;
	this.value = NaN; // will always be between 0 and 100
	this.active = false;
	this.httpRequest = null;
	this.dQueue = null;
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.initialized = false;
}

DSlider.instances = {};
DSlider.counter = 0;

DSlider.defaultConfig = {
	width: NaN, // if specified as a positive integer this will be the width of the slider
	height: NaN, // if specified as a positive integer this will be the height of the slider
	handleWidth: NaN, // if specified as a positive integer this will be the width of the slider handle
	handleHeight: NaN, // if specified as a positive integer this will be the height of the slider handle
	minOffset: 0,
	maxOffset: 0,
	moveToClick: true,
	useHandle: true,
	rotation: NaN,
	vertical: false,
	center: false,
	handle: '',
	foreground: '',
	background: '',
	cls: 'slider',
	handleClass: 'slider-handle',
	rangeClass: 'slider-range',
	verticalClass: 'slider-vertical', // if this class is present on the slider element it will treated as vertical
	tooltipClass: 'slider-tooltip',
	serverLevelClass: 'slider-server-level', // only has effect if serverUrl is non-empty string
	serverUrl: '',
	ajaxConfig: { // only has effect if serverUrl is non-empty string
		method: 'post',
		buildSendMap: function(map) { // override this to customize what get's send to the server - the passed map contains url-encoded properties pixelValue and formattedValue
			map['level'] = map.formattedValue;
			return map;
		}
	},
	queueConfig: {
		limit: 1,
		replaceLastIfLimitExceeded: true
	},
	adjustServerLevel: true,
	// Direction: ltr means left-to-right for horizontal orientation and bottom-to-top for vertical orientation, rtl means right-to-left for horizontal and top-to-bottom for vertical.
	// Is be overruled by possible HTML dir attribute
	dir: 'ltr',
	hideToolTip: true, // hide tooltip when not dragging
	stepSize: 1, // a value greater than 0 means that the handle will snap to nearest value dividable by this value when handle is released - sliding is always continuous
	startValue: 0, // must be between 0 and 100 or min and max
	min: NaN,
	max: NaN,
	translator: null, // function(value, slider) {} or object with parse and format methods - is executed in context of the slider instance and passed the value of the slider (a value between 0 and 100)
	onBeforeDisplayServerLevel: null, // function(v, slider) {}
	onAfterDisplayServerLevel: null, // function(v, slider) {}
	onBeforeSnap: null, // function(e, slider) {}
	onAfterSnap: null, // function(e, slider) {}
	onBeforeInit: null, // function(slider) {},
	onAfterInit: null, // function(slider) {},
	onBeforeClick: null, // function(e,slider) {},
	onAfterClick: null, // function(e, slider) {},
	onBeforeStart: null, // function(e, dragable, slider) {},
	onAfterStart: null, // function(e, dragable, slider) {},
	onBeforeSlide: null, // function(e, x, y, v, dragable, slider) {}
	onAfterSlide: null, // function(e, x, y, v, dragable, slider) {}
	onBeforeStop: null, // function(e, dragable, slider) {}
	onAfterStop: null // function(e, dragable, slider) {}
};

DSlider.newInstance = function(element, config) {
	var instance = new DSlider(element, config);
	instance.key = 'dSlider' + DSlider.counter++;
	DSlider.instances[instance.key] = instance;
	return instance;
}

DSlider.initAll = function() {
	for (var key in DSlider.instances) {
		DSlider.instances[key].init();
	}
}

DSlider.destroyAll = function() {
	for (var k in DSlider.instances) {
		DSlider.instances[k].destroy();
	}
}

DSlider.get = function(elementOrId) {
	for (var key in DSlider.instances) {
		var dSlider = DSlider.instances[key];
		if (typeof elementOrId == 'string') {
			if (dSlider.dElement.getId() === elementOrId) {
				return dSlider;
			}
		}
		else if (elementOrId instanceof Element) {
			if (dSlider.dElement.element === elementOrId) {
				return dSlider;
			}
		}
	}
	return null;
}

DSlider.prototype.fireHandler = dLib.util.fireHandler;

DSlider.prototype.toString = function() {
	return "[object " + this.constructor.getName() + "] " + this.key;
}

DSlider.prototype.init = function() {
	if (!this.initialized) {
		if (this.fireHandler("onBeforeInit", arguments)) {
			var cfg = this.config;
			this.dElement = g(this.dElement).addClass(cfg.cls);
			this.vertical = Boolean.parse(cfg.vertical) || this.dElement.hasClass(cfg.verticalClass);
			this.centered = Boolean.parse(cfg.center);
			this.dir = (this.dElement.attr('dir') || cfg.dir).toLowerCase();
			this.maxOffset = parseInt(this.config.maxOffset, 10) || 0;
			this.minOffset = parseInt(this.config.minOffset, 10) || 0;
			this.setBackgroundImage(cfg.background);
			this.setDimension(parseInt(cfg['width'], 10), parseInt(cfg['height'], 10));
			this.stepSize = Math.max(parseFloat(cfg.stepSize) || this.stepSize, 0); // TODO: should there be a max limit?
			this.render();
			this.dRange = q('.' + cfg.rangeClass, this.dElement.element).item(0, true);
			this.setForegroundImage(cfg.foreground);
			var dragConfig = {
				cursor: '',
				scope: this,
				position: true,
				onBeforeDragStart: this.start,
				onAfterDragStart: this.afterStart,
				onBeforeDrag: this.drag,
				onAfterDragEnd: this.stop
			}
			this.dDragable = Boolean.parse(cfg.useHandle) ? new DDragable(q('.' + cfg.handleClass, this.dElement.element).item(0), null, dragConfig).init() : null;
			this.dHandle = this.dDragable ? this.dDragable.dElement : null;
			this.dTooltip = cfg.tooltipClass ? q('.' + cfg.tooltipClass, this.dElement.element).item(0, true).prepareToMove() : null; // make position relative
			this.dServerLevel = cfg.serverUrl ? q('.' + cfg.serverLevelClass, this.dElement.element).item(0, true) : null;
			if (this.dServerLevel) {
				var ajaxConfig = cfg.ajaxConfig;
				ajaxConfig.url = cfg.serverUrl;
				ajaxConfig.scope = this;
				if (!('onCompleteOk' in ajaxConfig)) {
					ajaxConfig.onCompleteOk = this.onCompleteOk;
				}
				this.httpRequest = new HttpRequest(ajaxConfig);
				this.httpRequest.prevMap = {
					formattedValue: NaN,
					pixelValue: NaN
				};
				this.dQueue = new DQueue(this.key, cfg.queueConfig);
			}
			if (Object.implements(cfg.translator, { parse: dLib.noop, format: dLib.noop })) {
				this.translator = cfg.translator;
			} else {
				this.translator = this.getLinearTranslator(Number.isNumber(cfg.min) ? cfg.min : 0, Number.isNumber(cfg.max) ? cfg.max : 100);
			}
			this.rotation = parseFloat(cfg.rotation) || 0; // must be between -45 and 45 degrees
			if (this.rotation) {
				// ensure rotation is between -45 and 45
				this.rotation = Math.abs(this.rotation) > 45 ? this.rotation % 45 : this.rotation;
				this.dElement.rotate(this.rotation); // should only rotate parent container, not the containers for server level, tooltip, handle and range
				this.setRotationOffsets();
			}
			this.setValue(this.parseValue(cfg.startValue), true);
			if (this.dHandle) {
				if (this.dDragable.isPointerEnabled()) {
					this.dElement.css({
						'content-zooming': 'none',
						'touch-action': 'none'
					}, true);
				}
				this.setHandleImage(cfg.handle);
				['handleWidth', 'handleHeight'].forEach(function (p, i) {
					var v = parseInt(cfg[p], 10);
					if (!isNaN(v)) {
						if (i == 0) {
							this.setHandleDimension(v, NaN);
						} else {
							this.setHandleDimension(NaN, v);
						}
					}
				}.bind(this));
			}
			// add event listeners
			if (Boolean.parse(cfg.moveToClick)) {
				this.onClickListener = this.click.bindAsEventListener(this);
				// In Chrome 38 on Android 4.4.4 the click event return wrong coordinates, so use touchstart instead
				this.dElement.on('mousedown touchstart', this.onClickListener); // TODO: add support for pointer event model
			}
			this.initialized = true;
		}
		this.fireHandler("onAfterInit", arguments);
	}
	return this;
}

DSlider.prototype.destroy = function() {
	if (this.initialized) {
		if (this.fireHandler("onBeforeDestroy", arguments)) {
			if (this.key) {
				// Do NOT decrement counter!
				delete DSlider.instances[this.key];
			}
			if (this.onClickListener) {
				this.dElement.off('mousedown touchstart', this.onClickListener);
			}
			if (this.dDragable) {
				this.dDragable.destroy();
				this.dDragable = null;
			}
			if (this.httpRequest) {
				this.httpRequest = null;
			}
			if (this.dQueue) {
				this.dQueue = null;
			}
			if (this.dHandle) {
				this.dHandle.remove();
				this.dHandle = null;
			}
			if (this.dTooltip) {
				this.dTooltip.remove();
				this.dTooltip = null;
			}
			if (this.dRange) {
				this.dRange.remove();
				this.dRange = null;
			}
			if (this.dServerLevel) {
				this.dServerLevel.remove();
				this.dServerLevel = null;
			}
			if (this.config.minOffset || this.config.maxOffset) {
				q('.slider-wrapper', this.dElement.element).remove();
			}
			this.dElement.attr('data-slider-key', '').attr('style', '').removeClass(this.config.cls).removeClass(this.config.verticalClass).removeClass('active');
			this.dElement = null;
			this.initialized = false;
		}
		this.fireHandler("onAfterDestroy", arguments);
	}
}

DSlider.prototype.resolveBackgroundCss = function(url) {
	return {
		background: 'url(' + url + ') center center no-repeat',
		border: 'none'
	}
}

DSlider.prototype.setBackgroundImage = function(url) {
	if (typeof url == 'string' && url && this.dElement) {
		this.dElement.css(this.resolveBackgroundCss(url));
	}
	return this;
}

DSlider.prototype.setForegroundImage = function(url) {
	if (typeof url == 'string' && url) {
		if (this.dServerLevel) {
			this.dServerLevel.css(this.resolveBackgroundCss(url));
		}
		else if (this.dRange) {
			this.dRange.css(this.resolveBackgroundCss(url));
		}
	}
	return this;
}

DSlider.prototype.setHandleImage = function(url) {
	if (typeof url == 'string' && url && this.dHandle) {
		this.dHandle.css(this.resolveBackgroundCss(url));
	}
	return this;
}

DSlider.prototype.setDimension = function(w, h) {
	if (this.dElement) {
		var css = {};
		if (!isNaN(w)) {
			css[this.vertical ? 'height' : 'width'] = w + 'px';
		}
		if (!isNaN(h)) {
			css[this.vertical ? 'width' : 'height'] = h + 'px';
		}
		this.dElement.css(css);
	}
	return this;
}

DSlider.prototype.setHandleDimension = function(w, h) {
	if (this.dHandle) {
		var css = {};
		if (!isNaN(w)) {
			if (this.vertical) {
				css['marginLeft'] = 0;
				css['marginTop'] = -1 * Math.ceil(w / 2) + 'px'; // the top property is used to move the handle, so we adjust margin top instead
				css['height'] =  w + 'px';
			} else {
				css['right'] = 'auto';
				css['width'] =  w + 'px';
				css['marginLeft'] = -1 * Math.ceil(w / 2) + 'px'; // the left property is used to move the handle, so we adjust margin left instead
			}
		}
		if (!isNaN(h)) {
			if (this.vertical) {
				css['right'] = 'auto';
				css['width'] =  h + 'px';
				css['marginLeft'] = -1 * Math.ceil((h - this.dRange.element.offsetWidth) / 2) + 'px';
			} else {
				css['height'] =  h + 'px';
				css['marginTop'] = -1 * Math.ceil((h - this.dRange.element.offsetHeight) / 2) + 'px';
				css['bottom'] = 'auto';
			}
		}
		this.dHandle.css(css);
	}
	return this;
}

DSlider.prototype.getLinearTranslator = function(min, max) {
	if (!this.linearTranslator) {
		this.linearTranslator = {
			parse: function(value /* between min and max */, dSlider) { // x = 100 * (y - min) / (max - min)
				return Math.max(Math.min(100 * (value - min) / (max - min), 100), 0); // ensure returned value is >= 0 and <= 100
			},
			format: function(value /* between 0 and 100 */, dSlider) {
				var v = min + value * (max - min) / 100; // y = f(x) = min + x * (max - min) / 100
				//v = Math.min(Math.max(v, min), max); // this is necessary since the value get adjusted if rotation != 0 and therefore might become lower than min or higher than max
				if (dSlider.stepSize > 0) {
					v -= v % dSlider.stepSize;
				}
				return '' + v;
			}
		}
	}
	return this.linearTranslator;
}

DSlider.prototype.setValue = function(value, setServerLevel) {
	this.value = value;
	var xy = this.getPixelValueFromValue();
	this.move(xy);
	if (setServerLevel) { // is only the case on init
		this.displayServerLevel(xy);
	}
	if (this.dTooltip && !this.config.hideToolTip) {
		this.dTooltip.show();
	}
	return this;
}

DSlider.prototype.render = function() {
	if (this.fireHandler("onBeforeRender", arguments)) {
		var id = this.dElement.getId();
		var cfg = this.config;
		if (this.vertical) {
			this.dElement.addClass(cfg.verticalClass);
		}
		var htm = cfg.serverUrl ? '<div class="' + cfg.serverLevelClass + '"></div>' : '';
		htm += '<div class="' + cfg.rangeClass + '"></div>';
		htm += '<div class="' + cfg.tooltipClass + '"></div>';
		if (Boolean.parse(cfg.useHandle)) {
			htm += '<div class="' + cfg.handleClass + '"></div>';
		}
		this.dElement.append(htm).attr('data-slider-key', this.key);
	}
	this.fireHandler("onAfterRender", arguments);
	return this;
}

DSlider.prototype.getPixelRange = function(ignoreOffsets) {
	if (isNaN(this.pixelRange)) { // max may be calculated when element was hidden causing offsets to be 0.
		this.pixelRange = this.vertical ? this.dRange.element.offsetHeight : this.dRange.element.offsetWidth;
		if (!this.pixelRange) {
			var p = this.vertical ? 'height' : 'width';
			this.pixelRange = this.dElement.parseCSS(p);
		}
	}
	return !!ignoreOffsets ? this.pixelRange : this.pixelRange - this.maxOffset - this.minOffset;
}

DSlider.prototype.resolvePixelValue = function(e, x, y, dragable) {
	var rtl = this.isRTL();
	var revert = (rtl && !this.vertical) || (this.vertical && !rtl);
	var max = this.getPixelRange(true) - (revert ? this.minOffset : this.maxOffset);
	var min = revert ? this.maxOffset : this.minOffset;
	var xy = this.vertical ? y : x;
    if (this.rotation) {
		xy = this.getRotatedDistance(e);
    }
	return Math.max(Math.min(max, xy), min);
}

DSlider.prototype.setRotationOffsets = function() {
	var style = this.dElement.getComputedStyle();
	var lbw = parseInt(style.borderLeftWidth, 10);
	var tbw = parseInt(style.borderTopWidth, 10);
	var rbw = parseInt(style.borderRightWidth, 10);
	var bbw = parseInt(style.borderBottomWidth, 10);
	var l = this.dElement.element.offsetLeft + lbw;
	var t = this.dElement.element.offsetTop + tbw;
	var pr = this.getPixelRange(true);
	var r = 0.5 * pr;
	var angle = this.rotation;
	var toRadianFactor = Math.PI / 180;
	var v = angle * toRadianFactor, x3, y3;
	if (this.vertical) {
		var w = this.dElement.element.offsetWidth - lbw - rbw;
		var x0 = l + 0.5 * w, y0 = t + r; // center of bar (origin for rotation)
		var y1 = y0 - r;
		var dy = r * (1 - Math.cos(v));
		var x2 = x0, y2 = y1 + dy;
		var dx = r * Math.sin(v);
		x3 = x2 + dx, y3 = y2; // left end of rotated bar
	} else {
		var h = this.dElement.element.offsetHeight - tbw - bbw;
		var x0 = l + r, y0 = t + 0.5 * h; // center of bar (origin for rotation)
		var x1 = x0 - r;
		var dx = r * (1 - Math.cos(v));
		var x2 = l + dx, y2 = y0;
		var dy = r * Math.sin(v);
		x3 = x2, y3 = y2 - dy; // left end of rotated bar
	}
	this.rotationOffset = [x3, y3];
	return this;
}

DSlider.prototype.getRotatedDistance = function(e) {
	var ex = e.getPageX(), ey = e.getPageY();
	// find the point on the line from left end of bar to center of bar where pointer event point is orthogonal
	var x3 = this.rotationOffset[0], y3 = this.rotationOffset[1];
	var angle = this.rotation;
	var toRadianFactor = Math.PI / 180;
	var v = angle * toRadianFactor;
	var orthoAngle = 90 - Math.abs(angle);
	if (this.vertical) {
		var x4 = x3 - (y3 - ey) * Math.tan(-v);
		var b = (x4 - ex);
		var c = b * Math.sin(-v);
		var h = c * Math.sin(toRadianFactor * orthoAngle);
		var b2 = h / Math.tan(-v);
		if (ey - h < y3) {
			return 0;
		}
		return Math.sqrt(Math.pow((ex + b2 - x3), 2) + Math.pow((ey - h - y3), 2));
	}
	var y4 = y3 - (ex - x3) * Math.tan(-v);
	var b = (y4 - ey);
	var c = b * Math.sin(-v);
	var h = c * Math.sin(toRadianFactor * orthoAngle);
	var b2 = h / Math.tan(-v);
	if (ex + h < x3) { // prevent negative values (drags outside slider to cause a slide)
		return 0;
	}
	return Math.sqrt(Math.pow((ex + h - x3), 2) + Math.pow((ey + b2 - y3), 2));
}

DSlider.prototype.showTooltip = function() {
	if (this.dTooltip) {
		this.dTooltip.css({ display: 'inline-block', opacity: 1, visibility: 'visible' });
	}
	return this;
}

DSlider.prototype.parseValue = function(value) {
	return this.translator.parse.call(this, value, this);
}

DSlider.prototype.formatValue = function() {
	return this.translator.format.call(this, this.value, this);
}

DSlider.prototype.displayServerLevel = function(pixelValue) {
	if (this.dServerLevel) {
		if (this.fireHandler("onBeforeDisplayServerLevel", arguments)) {
			this.dServerLevel.css('clip', this.resolveClipValue(pixelValue));
		}
		this.fireHandler("onAfterDisplayServerLevel", arguments);
	}
	return this;
}

DSlider.prototype.isRTL = function() {
	return this.dir == 'rtl';
}

DSlider.prototype.isLTR = function() {
	return !this.isRTL();
}

// is executed in the scope of this DSlider instance
DSlider.prototype.onCompleteOk = function(e, httpRequest) {
	var nextValue = this.dQueue.get();
	if (nextValue) {
		if (this.config.adjustServerLevel) {
			this.displayServerLevel(httpRequest.prevMap.pixelValue);
		}
		this.send(nextValue);
	} else {
		if (this.config.adjustServerLevel) {
			this.displayServerLevel(this.getPixelValueFromValue());
		}
	}
}

DSlider.prototype.prepareToSend = function(pixelValue) {
	if (this.httpRequest) {
		var formattedValue = this.formatValue();
		if (this.httpRequest.prevMap.formattedValue != formattedValue) {
			var o = { pixelValue: pixelValue, formattedValue: formattedValue };
			this.httpRequest.prevMap = o;
			if (this.httpRequest.opened || this.httpRequest.sent) {
				this.dQueue.add(o);
			} else {
				this.send(o);
			}
		}
	}
	return this;
}

DSlider.prototype.send = function(o) {
	if (this.httpRequest) {
		if (this.httpRequest.config.method == 'get') {
			this.httpRequest.config.data = this.httpRequest.config.buildSendMap.call(this, o);
			this.httpRequest.open().send();
		} else {
			this.httpRequest.open().send(this.httpRequest.config.buildSendMap.call(this, o));
		}
	}
	return this;
}

DSlider.prototype.release = function() {
	if (this.active) {
        this.dDragable.dragEnd(); // causes stop to be called
    }
	return this;
}

DSlider.prototype.lock = function() {
	this.locked = true;
	this.dElement.addClass('locked');
	return this.release();
}

DSlider.prototype.unlock = function() {
	this.locked = false;
	this.dElement.removeClass('locked');
	return this;
}

DSlider.prototype.slide = function(e, x, y, dragable) {
	var v = this.resolvePixelValue(e, x, y, dragable);
	// On Android 4.0.3 the stock browser may fire mousemove with coordinates 0 even though mousemove shouldn't be supported on such a device!
	// Take advantage of the fact that this stock browser supports a very early implementation of the WebSocket interface where the CLOSED constant equals 2 (in newer versions it equals 3)
	var isOlderBuggyAndroidStockBrowser = e.type == 'mousemove' && v == 0 && 'ontouchmove' in window && window.WebSocket && window.WebSocket.CLOSED == 2;
	if (isOlderBuggyAndroidStockBrowser) {
		return this;
	}
	var args = [e, x, y, v, dragable];
	if (this.fireHandler("onBeforeSlide", args)) {
		e.preventDefault().stopPropagation();
		// set value before moving - otherwise tooltip will be out of sync
		this.value = this.getValueFromPixelValue(v);
		this.move(v).prepareToSend(v);
	}
	this.fireHandler("onAfterSlide", args);
	return this;
}

// clip: rect(top, right, bottom, left)
DSlider.prototype.resolveClipValue = function(pixelValue) {
	var rtl = this.isRTL();
	if (this.vertical) {
		if (this.centered) {
			var y0 = this.getPixelRange(true) / 2;
			var bottom = y0;
			var top = pixelValue;
			if ((rtl && this.value > 50) || (!rtl && this.value <= 50)) {
				bottom = pixelValue;
				top = y0;
			}
			return 'rect(' + top + 'px, auto, ' + bottom + 'px, auto)';
		}
		if (rtl) {
			return 'rect(auto, auto, ' + pixelValue + 'px, auto)';
		}
		return 'rect(' + pixelValue + 'px, auto, auto, auto)';
	}
	if (this.centered) {
		var x0 = this.getPixelRange(true) / 2;
		var right = pixelValue;
		var left = x0;
		if ((rtl && this.value > 50) || (!rtl && this.value <= 50)) {
			right = x0;
			left = pixelValue;
		}
		return 'rect(auto, ' + right + 'px, auto, ' + left + 'px)';
	}
	if (rtl) {
		return 'rect(auto, auto, auto, ' + pixelValue + 'px)';
	}
	return 'rect(auto, ' + pixelValue + 'px, auto, auto)';
}

DSlider.prototype.move = function(pixelValue) {
	this.dRange.css('clip', this.resolveClipValue(pixelValue));
	var cssProp = this.vertical ? 'top' : 'left';
	var cssValue = pixelValue + 'px';
	if (this.dHandle) {
		this.dHandle.css(cssProp, cssValue);
	}
	if (this.dTooltip) {
		this.dTooltip.html(this.formatValue()).css(cssProp, cssValue);
	}
	return this;
}

DSlider.prototype.getPixelValueFromValue = function() {
	if (this.vertical) {
		if (this.isRTL()) {
			return this.minOffset + this.value * this.getPixelRange() / 100;
		}
		return this.maxOffset + (100 - this.value) * this.getPixelRange() / 100;
	}
	if (this.isRTL()) {
		return this.maxOffset + (100 - this.value) * this.getPixelRange() / 100;
	}
	return this.minOffset + this.value * this.getPixelRange() / 100;
}

DSlider.prototype.getValueFromPixelValue = function(pixelValue) {
	if (this.vertical) {
		if (this.isRTL()) {
			return 100 * (pixelValue - this.minOffset) / this.getPixelRange();
		}
		return 100 - 100 * (pixelValue - this.maxOffset) / this.getPixelRange();
	}
	if (this.isRTL()) {
		return 100 -100 * (pixelValue - this.maxOffset) / this.getPixelRange();
	}
	return 100 * (pixelValue - this.minOffset) / this.getPixelRange();
}

DSlider.prototype.snap = function(e) {
	if (this.fireHandler("onBeforeSnap", arguments)) {
		if (this.stepSize > 0) {
			var v = this.parseValue(parseFloat(this.formatValue()));
			if (v != this.value) {
				this.setValue(v, this.config.adjustServerLevel);
			}
		}
	}
	this.fireHandler("onAfterSnap", arguments);
	return this;
}

DSlider.prototype.start = function(e, dragable) {
	if (this.locked) {
		return false;
	}
	if (this.fireHandler("onBeforeStart", arguments)) {
		this.active = true;
		this.dElement.addClass('active');
		this.showTooltip();
		return true;
	}
	return false;
}

DSlider.prototype.afterStart = function() {
	this.fireHandler("onAfterStart", arguments);
	return this;
}

/* return false to prevent DMousable from dragging for us - assigned as onBeforeDrag listener */
DSlider.prototype.drag = function(e, x, y, dragable) {
	if (!this.locked) {
		this.slide(e, x, y, dragable);
	}
	return false;
}

DSlider.prototype.click = function(e) {
	if (this.locked || (this.dHandle && e.target === this.dHandle.element) || (e instanceof DMouseEvent && !e.isLeftButtonDown())) {
		return this;
	}
	if (this.fireHandler("onBeforeClick", arguments)) {
		var offset = DElement.getPageOffset(this.dElement.element);
		var x = e.getPageX() - offset[0];
		var y = e.getPageY() - offset[1];
		this.slide(e, x, y, this.dDragable);
	}
	this.fireHandler("onAfterClick", arguments);
	return this;
}

DSlider.prototype.stop = function(e, dragable) {
	if (this.fireHandler("onBeforeStop", arguments)) {
		this.snap(e);
		if (this.dTooltip && this.config.hideToolTip) {
			this.dTooltip.fadeOut();
		}
		this.active = false;
		this.dElement.removeClass('active');
	}
	this.fireHandler("onAfterStop", arguments);
	return this;
}

DSlider.onDOMReadyListener = addDOMReadyListener(function() {
	DSlider.initAll();
});