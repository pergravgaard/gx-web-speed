//function distp(point1, point2) {
//	return dist(point1[0], point1[1], point2[0], point2[1]);
//}
//function dist(x1, y1, x2, y2) {
//	return Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
//}
function createSquare(x, y, color) {
	return;
	var div = DElement.create('div', {
		style: 'position:absolute;width:4px;height:4px;opacity:.7;background-color:'+color+';left:' + (x-2) + 'px;top:'+(y-2)+'px;z-index:500000;'
	});
	document.body.appendChild(div);
}

DSlider.prototype.setRotationOffsets1 = function() {
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
		var x0 = l + 0.5 * w, y0 = t + r;
		createSquare(x0, y0, 'red'); // center of bar (origin for rotation)
		var y1 = y0 - r;
		createSquare(x0, y1, 'red'); // top end of bar
		createSquare(x0, y1 + pr, 'red'); // right end of bar
		var dy = r * (1 - Math.cos(v));
		var x2 = x0, y2 = y1 + dy;
		createSquare(x2, y2, 'yellow');
		var dx = r * Math.sin(v);
		x3 = x2 + dx, y3 = y2;
		createSquare(x3, y3, 'black'); // left end of rotated bar
	} else {
		var h = this.dElement.element.offsetHeight - tbw - bbw;
		var x0 = l + r, y0 = t + 0.5 * h;
		createSquare(x0, y0, 'red'); // center of bar (origin for rotation)
		var x1 = x0 - r;
		createSquare(x1, y0, 'red'); // left end of bar
		createSquare(x1 + pr, y0, 'red'); // right end of bar
		var dx = r * (1 - Math.cos(v));
		var x2 = l + dx, y2 = y0;
		createSquare(x2, y2, 'yellow');
		var dy = r * Math.sin(v);
		x3 = x2, y3 = y2 - dy;
		createSquare(x3, y3, 'black'); // left end of rotated bar
	}
	this.rotationOffset = [x3, y3];
	return this;
}

//DSlider.prototype.test = function(e) {
//	var l = this.dElement.element.offsetLeft + this.minOffset;
//	var t = this.dElement.element.offsetTop - 1; // subtract borders
//	var r = 0.5 * this.getPixelRange();
//	var h = this.dElement.element.offsetHeight;
//	var x0 = l + r, y0 = t + 0.5 * h;
//	createSquare(x0, y0, 'red'); // center of bar (origin for rotation)
//	var x1 = x0 - r, y1 = y0;
//	createSquare(x1, y1, 'red'); // left end of bar
//
//	//createSquare(x1 + this.getPixelRange() - this.maxOffset, y1, 'red'); // right end of bar
//	var angle = -35; // in degrees
//	var toRadianFactor = Math.PI / 180;
//	var v = angle * toRadianFactor;
//	var dx = r * (1 - Math.cos(v));
//	var x2 = l + dx, y2 = y1;
//	createSquare(x2, y2, 'green');
//	var dy = r * Math.sin(Math.abs(v));
//	var x3 = x2, y3 = y2 + dy;
//	createSquare(x3, y3, 'black'); // left end of rotated bar
//	//createSquare(x1 + this.getPixelRange() - this.maxOffset - dx, y2 - dy, 'black'); // right end of rotated bar
//	var ex = e.getPageX(), ey = e.getPageY();
//	createSquare(ex, ey, 'blue'); // pointer event
//	// find the point on the line from left end of bar to center of bar where pointer event point is orthogonal
//
//	createSquare(ex, y3, 'lime');
//	var y4 = y3 - (ex - x3) * Math.tan(Math.abs(v));
//	createSquare(ex, y4, '#999'); // point on line right below event point
//	var orthoAngle = 90 - Math.abs(angle);
//	var b = (y4 - ey);
//	var c = b * Math.sin(Math.abs(v));
//	var h = c * Math.sin(toRadianFactor * orthoAngle);
//	var b2 = h / Math.tan(Math.abs(v));
//	createSquare(ex + h, ey + b2, 'lime');
//}

DSlider.prototype.getRotatedDistance1 = function(e) {
	var ex = e.getPageX(), ey = e.getPageY();
	createSquare(ex, ey, 'blue'); // pointer event
	// find the point on the line from left end of bar to center of bar where pointer event point is orthogonal
	var x3 = this.rotationOffset[0], y3 = this.rotationOffset[1];
	var angle = this.rotation;
	var toRadianFactor = Math.PI / 180;
	var v = angle * toRadianFactor;
	var orthoAngle = 90 - Math.abs(angle);
	if (this.vertical) {
		createSquare(x3, ey, 'yellow');
		var x4 = x3 - (y3 - ey) * Math.tan(-v);
		createSquare(x4, ey, '#555'); // point on line right below/above event point
		var b = (x4 - ex);
		var c = b * Math.sin(-v);
		var h = c * Math.sin(toRadianFactor * orthoAngle);
		var b2 = h / Math.tan(-v);
		createSquare(ex + b2, ey - h, 'lime');
		if (ey - h < y3) {
			return 0;
		}
		return Math.sqrt(Math.pow((ex + b2 - x3), 2) + Math.pow((ey - h - y3), 2));
	}
	createSquare(ex, y3, 'yellow');
	var y4 = y3 - (ex - x3) * Math.tan(-v);
	createSquare(ex, y4, '#555'); // point on line right below/above event point
	var b = (y4 - ey);
	var c = b * Math.sin(-v);
	var h = c * Math.sin(toRadianFactor * orthoAngle);
	var b2 = h / Math.tan(-v);
	createSquare(ex + h, ey + b2, 'lime');
	if (ex + h < x3) { // prevent negative values (drags outside slider to cause a slide)
		return 0;
	}
	return Math.sqrt(Math.pow((ex + h - x3), 2) + Math.pow((ey + b2 - y3), 2));
}

DSlider.prototype.resolvePixelValue1 = function(e, x, y, dragable) {
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

DSlider.prototype.init1 = function() {
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
				cursor: cfg.cursor,
				scope: this,
				position: true,
				onAfterDragStart: this.start,
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
				this.dQueue = new DQueue(this.key, cfg.queueConfig);
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
//				if (this.dDragable.isPointerEnabled()) {
//					this.dElement.css({
//						'content-zooming': 'none',
//						'touch-action': 'none'
//					}, true);
//				}
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

DSlider.prototype.render1 = function() {
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

DSlider.prototype.getPixelRange1 = function(ignoreOffsets) {
	if (isNaN(this.pixelRange)) { // max may be calculated when element was hidden causing offsets to be 0.
        this.pixelRange = this.vertical ? this.dRange.element.offsetHeight : this.dRange.element.offsetWidth;
		if (!this.pixelRange) {
			var p = this.vertical ? 'height' : 'width';
            this.pixelRange = this.dElement.parseCSS(p);
		}
	}
	return !!ignoreOffsets ? this.pixelRange : this.pixelRange - this.maxOffset - this.minOffset;
}

DSlider.prototype.resolvePixelValue1 = function(e, x, y, dragable) {
	var rtl = this.isRTL();
	var revert = (rtl && !this.vertical) || (this.vertical && !rtl);
    var max = this.getPixelRange(true) - (revert ? this.minOffset : this.maxOffset);
	var min = revert ? this.maxOffset : this.minOffset;
    var xy = this.vertical ? y : x;
//    if (/*e.type.endsWith('move') &&*/ this.rotation) {
//    }
	return Math.max(Math.min(max, xy), min);
}

DSlider.prototype.getLinearTranslator1 = function(min, max) {
	if (!this.linearTranslator) {
		this.linearTranslator = {
			parse: function(value /* between min and max */, dSlider) { // x = 100 * (y - min) / (max - min)
				return Math.max(Math.min(100 * (value - min) / (max - min), 100), 0); // ensure returned value is >= 0 and <= 100
			},
			format: function(value /* between 0 and 100 */, dSlider) {
                var v = min + value * (max - min) / 100; // y = f(x) = min + x * (max - min) / 100
                //v = Math.min(Math.max(v, min), max); // this is necessary since the value get adjusted if rotation != 0 and therefore might become lower than min or higher than max
                if (dSlider.stepSize > 0) {
                    v -= v % dSlider.stepSize; // TODO: should round by maybe adding step size
                }
				return '' + v;
			}
		}
	}
	return this.linearTranslator;
}

DSlider.prototype.getPixelValueFromValue1 = function() {
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

DSlider.prototype.getValueFromPixelValue1 = function(pixelValue) {
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

DSlider.prototype.resolveClipValue1 = function(pixelValue) {
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



