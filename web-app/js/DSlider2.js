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
	this.stepSize = 0;
    this.vertical = false;
	this.value = NaN;
    this.isActive = false;
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.initialized = false;
}

DSlider.instances = [];

DSlider.defaultConfig = {
    rotation: NaN, // TODO: If specified and not 0 this should override vertical/horizontal settings
    cls: 'slider',
	handleClass: 'slider-handle',
	rangeClass: 'slider-range',
	verticalClass: 'slider-vertical', // if this class is present on the slider element it will treated as vertical
	tooltipClass: 'slider-tooltip',
	serverLevelClass: 'slider-server-level',
	slideOffset: 0, // amount of pixels that should be deducted from the visual sliding - depends on your styling
	minOffset: 0, // measured in pixels
	// Direction: ltr means left-to-right for horizontal orientation and bottom-to-top for vertical orientation, rtl means right-to-left for horizontal and top-to-bottom for vertical.
	// Will be overruled by possible HTML dir attribute
    dir: 'ltr',
    hideToolTip: true, // hide tooltip when not dragging
	cursor: 'pointer',
	position: 'absolute',
	stepSize: 0, // 0 or NaN means continuous sliding
	startValue: 0, // must be between 0 and 100
	min: NaN,
	max: NaN,
	translator: null, // function(value, slider) {}, // is executed in context of the slider instance and passed the value of the slider (a value between 0 and 100)
	onInit: null, //function(slider) {},
	onStart: null, //function(e, dragable) {},
	onSlide: null, //function(e, x, y, dragable) {}
	onStop: null, //function(e, dragable) {}
	dElementConfig: null
};

DSlider.newInstance = function(element, config) {
	var instance = new DSlider(element, config);
	DSlider.instances.push(instance);
	return instance;
}

DSlider.initAll = function() {
	for (var i = 0, l = DSlider.instances.length; i < l; i++) {
		DSlider.instances[i].init();
	}
}

DSlider.get = function(elementOrId) {
	for (var i = 0, l = DSlider.instances.length; i < l; i++) {
		var dSlider = DSlider.instances[i];
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
	return "[object " + this.constructor.getName() + "] " + (this.dElement && this.dElement.element ? this.dElement.element.id : this.dElement);
}

DSlider.prototype.init = function() {
	if (!this.initialized) {
		var cfg = this.config;
		this.dElement = g(this.dElement, cfg.dElementConfig);
		this.dElement.addClass(cfg.cls).on('mousemove mouseup touchmove touchend', function(e) {
			e.preventDefault().stopPropagation(); // stopping propagation ruins it for IE8
		}).on('mousedown touchstart', this.onClick.bindAsEventListener(this));
		this.vertical = this.dElement.hasClass(cfg.verticalClass);
		this.minOffset = this.resolveMinOffset();
		this.maxOffset = this.resolveMaxOffset();
		this.stepSize = Math.max(parseInt(cfg.stepSize, 10) || this.stepSize, 0);
        this.rotation = parseFloat(cfg.rotation) || 0; // must be between -45 and 45 degrees
        if (this.rotation) {
            var css = {
                mozTransform: 'rotate(' + this.rotation + 'deg)',
                webkitTransform: 'rotate(' + this.rotation + 'deg)',
                oTransform: 'rotate(' + this.rotation + 'deg)',
                msTransform: 'rotate(' + this.rotation + 'deg)',
                transform: 'rotate(' + this.rotation + 'deg)'
            }
            this.dElement.css(css);
        }
		this.render();
		var id = this.dElement.getId();
		this.dRange = g(id + '-range');
		this.dHandle = g(id + '-handle');
		var dragConfig = {
			cursor: cfg.cursor,
			scope: this,
			position: cfg.position,
			onAfterDragStart: this.onStart,
			onBeforeDrag: this.onDrag, // return false since we'll move the dragable ourselves
			onAfterDragEnd: this.onStop
		}
		this.dDragable = new DDragable(this.dHandle.element, null, dragConfig).init();
		this.dTooltip = cfg.tooltipClass ? q('.' + cfg.tooltipClass, this.dElement.element).item(0, true).prepareToMove() : null; // make position relative
		this.dServerLevel = cfg.serverLevelClass ? q('.' + cfg.serverLevelClass, this.dElement.element).item(0, true) : null;
		this.dir = (this.dElement.attr('dir') || cfg.dir).toLowerCase();
		this.setValue(Math.min(Math.max(parseInt(cfg.startValue, 10) || 0, 0), 100), true);
		this.initialized = true;
		this.fireHandler("onInit", []);
	}
	return this;
}

DSlider.prototype.getTranslator = function() {
    if (!this.translator) {
        var cfg = this.config;
        var translator = null;
        if (Object.isObject(cfg.translator) && typeof cfg.translator.parse === 'function' && typeof cfg.translator.format === 'function') {
            translator = cfg.translator;
        }
        else if (!isNaN(cfg.min) && !isNaN(cfg.max)) {
            translator = this.getLinearTranslator(cfg.min, cfg.max);
        }
        this.translator = translator;
    }
    return this.translator;
}

DSlider.prototype.getLinearTranslator = function(min, max) {
	if (!this.linearTranslator) {
		this.linearTranslator = {
			parse: function(value /* between min and max */) { // x = 100 * (y - min) / (max - min)
				return Math.round(100 * (value - min) / (max - min));
			},
			format: function(value /* between 0 and 100 */) {
				return '' + Math.round(min + value * (max - min) / 100); // y = f(x) = min + x * (max - min) / 100
			}
		}
	}
	return this.linearTranslator;
}

DSlider.prototype.setValue = function(value, setServerLevel) {
	this.value = this.parseValue(value);
	// setting top property when vertical which means no correction for minOffset
	var xy = this.calculatePixelValue();
	this.move(xy);
	if (setServerLevel) {
		this.displayServerLevel(xy);
	}
	if (!this.config.hideToolTip) {
		this.dTooltip.show();
	}
	return this;
}

DSlider.prototype.parseValue = function(value) {
    value = this.calculateValue(value);
    if (this.getTranslator()) {
        return this.getTranslator().parse.call(this, value, this);
    }
	return value;
}

DSlider.prototype.render = function() {
	var id = this.dElement.getId();
	var cfg = this.config;
	var htm = '<div id="' + id + '-server-level" class="' + cfg.serverLevelClass + '"></div>';
	htm += '<div id="' + id + '-tooltip" class="' + cfg.tooltipClass + '"></div>';
	htm += '<div id="' + id + '-range" class="' + cfg.rangeClass + '"></div>';
	htm += '<div id="' + id + '-handle" class="' + cfg.handleClass + '"></div>';
	this.dElement.html(htm);
	return this;
}

DSlider.prototype.resolveMaxOffset = function() {
	if (!this.maxOffset) { // max may be calculated when element was hidden causing offsets to be 0.
		var max = this.vertical ? this.dElement.element.offsetHeight : this.dElement.element.offsetWidth;
		if (!max) {
			var p = this.vertical ? 'height' : 'width';
			max = this.dElement.parseCSS(p);
		}
		this.maxOffset = max - this.config.slideOffset;
	}
	return this.maxOffset;
}

DSlider.prototype.resolveMinOffset = function() {
	return this.config.minOffset || 0;
}

DSlider.prototype.resolvePixelValue = function(x, y) {
	if (this.vertical) {
        if (this.rotation) {
            var rad = this.rotation * Math.PI / 180;
            var cy = this.getPixelRange() / 2;
            var dy = y - cy;
            var z = Math.sqrt(Math.pow(dy, 2) * (1 + Math.pow(Math.tan(rad), 2)));
            if (dy < 0) {
                z = -z;
            }
            // TODO: Fix
            //out(y+' - ' + (cy+z));
            y = cy + z;
        }
		return Math.max(Math.min(this.getPixelRange(), y), 0);
	}
    if (this.rotation) {
        var rad = -1 * this.rotation * Math.PI / 180;
        var cx = this.getPixelRange() / 2;
        var dx = x - cx;
        var z = Math.sqrt(Math.pow(dx, 2) * (1 + Math.pow(Math.tan(rad), 2)));
        if (dx < 0) {
            z = -z;
        }
        x = cx + z;
    }
	return Math.max(Math.min(this.resolveMaxOffset(), x), this.resolveMinOffset());
}

DSlider.prototype.getPixelRange = function() {
	return this.resolveMaxOffset() - this.resolveMinOffset();
}

DSlider.prototype.showTooltip = function() {
	this.dTooltip.css({ display: 'inline-block', opacity: 1, visibility: 'visible' });
	return this;
}

DSlider.prototype.formatValue = function() {
    if (this.getTranslator()) {
        return this.getTranslator().format.call(this, this.value, this);
    }
	return '' + Math.round(this.value);
}

DSlider.prototype.displayServerLevel = function(v) {
	if (this.dServerLevel) {
		this.dServerLevel.css(this.vertical ? 'top' : 'width', (v + this.config.slideOffset / 2) + 'px');
		this.fireHandler("onDisplayServerLevel", [v]);
	}
	return this;
}

DSlider.prototype.isRTL = function() {
	return this.dir == 'rtl';
}

DSlider.prototype.isLTR = function() {
	return !this.isRTL();
}

DSlider.prototype.getValueFromPixelValue = function(pixelValue) {
	var v = this.vertical ? 100 - 100 * pixelValue / this.getPixelRange() : 100 * (pixelValue - this.resolveMinOffset()) / this.getPixelRange();
	return this.calculateValue(v);
}

// if right-to-left reverse value - internal value is always between 0 and 100
DSlider.prototype.calculateValue = function(v) {
	if (this.isRTL()) {
		v = 100 - v;
	}
	return v;
}

DSlider.prototype.onClick = function(e) {
	var offset = DElement.getPageOffset(this.dElement.element);
	return this.slide(e, e.getPageX() - offset[0] - Math.round(this.dHandle.element.offsetWidth / 2), e.getPageY() - offset[1] - Math.round(this.dHandle.element.offsetHeight / 2), this.dDragable).showTooltip();
}

DSlider.prototype.slide = function(e, x, y, dragable) {
	e.preventDefault().stopPropagation();
	var v = this.resolvePixelValue(x, y);
	// set value before moving - otherwise tooltip will be out of sync
	this.value = this.getValueFromPixelValue(v);
	this.move(v);
	this.fireHandler("onSlide", [e, v, dragable]);
	return this;
}

DSlider.prototype.calculatePixelValue = function() {
	return ((this.vertical && this.isLTR()) || (!this.vertical && this.isRTL())) ? (100 - this.value) * this.getPixelRange() / 100 : this.value * this.getPixelRange() / 100 + this.resolveMinOffset();
}

DSlider.prototype.onStop = function(e, dragable) {
	if (this.stepSize) {
        var v = parseFloat(this.getTranslator().format.call(this, this.value, this));
        this.setValue(v);
	}
    if (this.config.hideToolTip) {
	    this.dTooltip.fadeOut();
    }
	this.fireHandler("onStop", [e, dragable]);
    this.isActive = false;
	return this;
}

DSlider.prototype.move = function(v) {
	var cssProp = 'left';
	if (this.vertical) {
		cssProp = 'top';
		this.dRange.css('top', (v + this.config.slideOffset / 2) + 'px');
	} else {
		if (this.isRTL()) {
			this.dRange.css('width', (this.getPixelRange() - v + this.config.slideOffset / 2) + 'px');
		} else {
			this.dRange.css('width', (v + this.config.slideOffset / 2) + 'px');
		}
	}
	var cssValue = v + 'px';
	this.dDragable.dElement.css(cssProp, cssValue);
	if (this.dTooltip) {
		this.dTooltip.html(this.formatValue()).css(cssProp, cssValue);
	}
	return this;
}

DSlider.prototype.onStart = function(e, dragable) {
    this.isActive = true;
	this.showTooltip();
	this.fireHandler("onStart", [e, dragable]);
	return this;
}

DSlider.prototype.onDrag = function(e, x, y, dragable) {
    this.slide(e, x, y, dragable);
    return false;
}

DSlider.onDOMReadyListener = addDOMReadyListener(function() {
	DSlider.initAll();
});