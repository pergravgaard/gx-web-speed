/**
 * Add support for lineWidth in percent (need to do some calculations as Canvas only supports pixel values) DONE
 * Add support for margin on pie (Partially DONE - need to correct for lineWidth - pie not filled) DONE
 * Add support for changing duration when running for Canvas DONE
 * Add support for fill on canvas DONE
 * Add support for message on canvas DONE
 * Add support for semi-transparent border (Done for Canvas)
 * Add support for CSS3 animations/transitions (no JavaScript timer), but it should still be possible to change duration when running! DROPPED - use CANVAS only
 * Remove support for SVG
 * Remove keyframe animations
 */
if (typeof dLib == "undefined") {
    throw new Error('DProgress.js: You must load the file DLib.js!');
}

function DProgress(dElementList, config) {
    this.dElementList = dElementList;
    this.config = Object.configure(config || {}, this.constructor.defaultConfig);
    this.dTimer = null;
    this.progress = 0;
    this.key = '';
    this.initialized = false;
}

DProgress.instances = {};
DProgress.counter = 0;
DProgress.keyPrefix = 'dProgress';

DProgress.defaultConfig = {
    scope: null,
    onInit: null,
    initialDelay: NaN,
    showMessage: true,
    useTimer: true,
    triggerEvents: 'click', // list of events that should start the progress timer - separate several values with a space - if empty string, no listeners will be registered
    delay: 100,
    duration: 1500,
    msgTemplate: '{0} %',
    renderingType: 'html', // can also be 'svg' or 'canvas'
    progressType: 'bar', // can be bar or pie
    fill: false,    //false makes it a ring, only has effect for progressType 'pie' - if true set fillStyle instead of strokeStyle
    pieMargin: 10,  //The distance from the edge of the container to the pie/rings border.
    pieStartAngle: 0, // in degrees
    pieCentered: true,
    canvasStyles: {
        lineWidth: 8,   //Thickness of ring. If use percent please write e.g. '8%'
//        shadowOffsetX: 0,
//        shadowOffsetY: 0,
//        shadowBlur: 2,
//        shadowColor: '#999999',
        font: '15px sans-serif',
        fontColor: 'rgba(255, 255, 255, 1)',
        fillStyle: 'rgba(239, 127, 26, .6)',//Background color of ring/pie with alpha support - used if fill is true
        strokeStyle: 'rgba(239, 127, 26, .6)' // used if fill is false
    },
    callback: null, // function/handler to execute when timer has expired (duration ms has passed)
    onprogress: null, // function/handler to execute when timer is progressing (delay ms has passed)
    filter: null, // a function that filters which elements to show progress on
	resetFilterOnStop: true
}

DProgress.newInstance = function(elements, config) {
    var instance = new DProgress(elements, config);
    instance.key = (DProgress.keyPrefix || 'dProgress') + DProgress.counter++;
    DProgress.instances[instance.key] = instance;
    return instance;
}

DProgress.initAll = function() {
    for (var k in DProgress.instances) {
        DProgress.instances[k].init();
    }
}

DProgress.destroyAll = function() {
    for (var k in DProgress.instances) {
        DProgress.instances[k].destroy();
    }
}

DProgress.buildKeyFramesRules = function(name, props) {
    var rules = [];
    var prefixes = ['-webkit-', '-moz-', '-ms-', '-o-', ''];
    prefixes.forEach(function(prefix) {
        var s = '@' + prefix + 'keyframes ' + name + ' {\n';
        for (var p in props) {
            var obj = props[p];
            for (var p2 in obj) {
                s += '\t' + p + ' {\n';
                for (var i = 0, l = prefixes.length; i < l; i++) {
                    s += '\t\t' + prefixes[i] + p2 + ': ' + obj[p2] + ';\n';
                }
                s += '\t}\n';
            }
        }
        s += '}\n';
        rules.push(s);
    });
    return rules;
}

DProgress.prototype.fireHandler = dLib.util.fireHandler;

DProgress.prototype.destroy = function() {
    if (this.initialized) {
        if (this.fireHandler("onBeforeDestroy", arguments)) {
            if (this.isRunning()) {
                this.stop();
            }
            if (this.key) {
                // Do NOT decrement counter!
                delete DProgress.instances[this.key];
            }
            if (this.config.triggerEvents && this.onStartListener) {
                this.dElementList.off(this.config.triggerEvents, this.onStartListener);
            }
            this.dElementList.attr('data-progress-key', '').find('.progress-container').remove();
            this.dElementList = null;
            this.initialized = false;
        }
        this.fireHandler("onAfterDestroy", arguments);
    }
}

DProgress.prototype.init = function() {
    if (!this.initialized) {
        var cfg = this.config;
        this.dElementList = typeof this.dElementList == 'string' ? q(this.dElementList) : this.dElementList;
		this.filteredElements = this.dElementList;
        this.dTimer = cfg.useTimer ? new DTimer({
            delay: cfg.delay,
            initialDelay: cfg.initialDelay,
            duration: cfg.duration,
            onSchedule: this.onSchedule,
            onTimeup: this.onTimeup,
            scope: this
        }) : null;
        this.render();
        if (this.config.triggerEvents) {
            this.onStartListener = this.onStart.bindAsEventListener(this);
            this.dElementList.on(this.config.triggerEvents, this.onStartListener);
        }
        this.initialized = true;
        this.fireHandler("onInit", arguments);
    }
    return this;
}

//DProgress.prototype.setTimerConfig = function(cfg) {
//    if (this.dTimer) {
//        ['delay', 'initialDelay', 'duration'].forEach(function(p) {
//            if (p in cfg) {
//                this.dTimer.config[p] = cfg[p];
//            }
//        }.bind(this));
//    }
//    return this;
//}

//DProgress.prototype.resume = function(newDuration) {
//    if (this.isRunning()) {
//        this.setDuration(newDuration, true);
//    } else {
//        this.start();
//    }
//    return this;
//}

DProgress.prototype.setDuration = function(duration) {
	if (this.dTimer) {
		this.dTimer.config.duration = duration;
	}
	this.config.duration = duration;
    return this;
}

DProgress.prototype.setRemainingTime = function(remainingTime) {
    if (this.dTimer) {
        this.config['duration'] = remainingTime;
        this.dTimer.setRemainingTime(remainingTime);
    }
    return this;
}

//DProgress.prototype.getDuration = function() {
//    return this.dTimer ? this.dTimer.config.duration : null; // should be from the config object, not the internal duration
//}

DProgress.prototype.getRemainingTime = function() {
    return this.dTimer ? this.dTimer.getRemainingTime() : 0;
}

DProgress.prototype.isRunning = function() {
    return this.dTimer ? this.dTimer.isRunning() : this.progress > 0;
}

//DProgress.prototype.getRunningTime = function() {
//    return this.dTimer ? this.dTimer.runningTime : NaN;
//}

DProgress.prototype.toString = function() {
    return "[object " + this.constructor.getName() + "] key: " +this.key + ", size: " + this.dElementList.size();
}

DProgress.prototype.usePie = function() {
    return this.config.progressType == 'pie';
}

DProgress.prototype.useSVG = function() {
    return this.usePie() && this.config.renderingType == 'svg';
}

DProgress.prototype.useKeyFrames = function() {
    return this.usePie() && this.config.renderingType == 'keyframes';
}

DProgress.prototype.useCanvas = function() {
    return this.usePie() && this.config.renderingType == 'canvas';
}

DProgress.prototype.insertKeyFramesRules = function(w) {
    function insertRules(rules) {
        for (var i = 0, l = rules.length; i < l; i++) {
            try {
                styleSheet.insertRule(rules[i], 0);
            }
            catch (error) {
                // do nothing
            }
        }
    }
    var id = this.key;
    if (!document.getElementById(id)) {
        var styleEl = DElement.create('style', { id: this.key, type: 'text/css' });
        // Apparently some version of Safari needs the following line?
        styleEl.appendChild(document.createTextNode(''));
        document.head.appendChild(styleEl);
        var styleSheet = styleEl.sheet;
        /* Rotate the left side of the progress bar from 0 to 360 degrees */
        var rules = DProgress.buildKeyFramesRules('left-spin', {
            from: {
                transform: 'rotate(0deg)'
            },
            to: {
                transform: 'rotate(360deg)'
            }
        });
        insertRules(rules);
        /* Rotate the right side of the progress bar from 0 to 180 degrees */
        rules = DProgress.buildKeyFramesRules('right-spin', {
            from: {
                transform: 'rotate(0deg)'
            },
            to: {
                transform: 'rotate(180deg)'
            }
        });
        insertRules(rules);
        /* Set the wrapper clip to auto, effectively removing the clip */
        rules = DProgress.buildKeyFramesRules('close-pie', {
            to: {
                //clip: 'rect(auto, auto, auto, auto)'
                clip: 'rect(0, ' + w + 'px, ' + w + 'px, 0)'
            }
        });
        insertRules(rules);
    }
}

DProgress.prototype.render = function() {
	if (this.fireHandler('onBeforeRender', arguments)) {
		this.dElementList.forEach(this.renderElement.bind(this));
	}
	this.fireHandler('onAfterRender', arguments);
    return this;
}

DProgress.prototype.renderElement = function(el) {
	if (this.fireHandler('onBeforeRenderElement', arguments)) {
		DElement.attr(el, 'data-progress-key', this.key);
		var cls = this.config.fill ? ' fill' : '';
		var htm = '';
		if (this.usePie()) {
			var w = this.resolvePieDiameter(el);
			var styles = this.config.pieCentered ? 'position:absolute;width:' + w + 'px;height:' + w + 'px;top:50%;left:50%;margin-left:-' + (w / 2) + 'px;margin-top:-' + (w / 2) + 'px;' : '';
			if (this.useCanvas()) {
				var div = DElement.create('div', {
					'class': 'progress-container progress-pie-container'
				});
				var canvas = DElement.create('canvas', {
					'class': 'pie-canvas',
					width: w, // canvas must have width and height attributes
					height: w
				});
				if (styles) {
					canvas.setAttribute('style', styles);
				}
				var context = canvas.getContext("2d");
				var canvasStyles = Object.extend({}, this.config.canvasStyles); // necessary to copy to new object for each element and not alter instance config
				if (this.config.fill) {
					canvasStyles.lineWidth = 0; // necessary
				}
				else if (typeof canvasStyles.lineWidth == 'string') {
					var lineWidth = canvasStyles.lineWidth;
					var lw = parseFloat(lineWidth);
					canvasStyles.lineWidth = lineWidth.endsWith('%') ? lw * w / 100 : lw;
				}
				for (var p in canvasStyles) {
					if (p in context) {
						context[p] = canvasStyles[p];
					}
				}
				div.appendChild(canvas);
				el.appendChild(div);
			}
			else if (this.useSVG()) {
			}
			else if (this.useKeyFrames()) {
				htm += '<div class="progress-container progress-pie-container">';
				if (this.config.showMessage) {
					htm += '<div class="progress-message' + cls + '"></div>';
				}
				htm += '<div class="progress-pie' + cls + '"';
				if (styles) {
					htm += ' style="' + styles + '"';
				}
				htm += '>';
				htm += '<div class="pie left"></div><div class="pie right"></div></div>';
				htm += '</div>';
				DElement.append(el, htm);
				this.insertKeyFramesRules(w);
				var dur = this.config.duration / 1000;
				q('.progress-pie', el).css({
					clip: 'rect(0, ' + w + 'px, ' + w + 'px, ' + (w / 2) + 'px)',
					animationIterationCount: 1, /* Only run once */
					animationFillMode: 'forwards', /* Hold the last keyframe */
					animationTimingFunction: 'linear', /* Linear animation */
					animationDuration: '0.01s', /* Complete keyframes asap */
					animationDelay: 0.5 * dur + 's', /* Wait half of the animation */
					animationName: 'close-pie' /* Keyframes name */
				}, true);
				q('.progress-pie .pie', el).css({
					clip: 'rect(0, ' + (w / 2) + 'px, ' + w + 'px, 0)',
					borderRadius: w / 2 + 'px',
					animationIterationCount: 1, /* Only run once */
					animationFillMode: 'forwards', /* Hold the last keyframe */
					animationTimingFunction: 'linear', /* Linear animation */
					animationDuration: 0.5 * dur + 's', /* Half animation time */
					animationName: 'right-spin'
				}, true);
				q('.progress-pie .pie.left', el).css({
					animationDuration: dur + 's', /* Full animation time */
					animationName: 'left-spin'
				}, true);
			} else {
				htm += '<div class="progress-container progress-pie-container">';
				if (this.config.showMessage) {
					htm += '<div class="progress-message' + cls + '"></div>';
				}
				htm += '<div class="progress-pie' + cls + '"';
				styles += 'clip: rect(0, ' + w + 'px, ' + w + 'px, ' + (w / 2) + 'px)';
				htm += ' style="' + styles + '"';
				htm += '>';
				htm += '<div class="pie"></div><div class="pie fill"></div>';
				htm += '</div>';
				DElement.append(el, htm);
				var dPies = q('.progress-pie .pie', el);
				var bw = 0;
				if (!this.config.fill) {
					if (this.config.borderWidthPct) {
						bw = Math.round(w * parseFloat(this.config.borderWidthPct) / 100);
					} else {
						bw = dPies.item(0, true).parseCSS('borderLeftWidth'); // Firefox do not support borderWidth, but left, top, right and bottom have the same value
					}
				}
				dPies.css({
					borderWidth: bw + 'px',
					width: Math.ceil(w - 2 * bw) + 'px',
					height: Math.ceil(w - 2 * bw) + 'px',
					clip: 'rect(0, ' + (w / 2) + 'px, ' + w + 'px, 0)',
					borderRadius: w / 2 + 'px'
				});
			}
		} else {
			htm += '<div class="progress-container progress-bar-container">';
			if (this.config.showMessage) {
				htm += '<div class="progress-message"></div>';
			}
			htm += '<div class="progress-bar-wrapper">';
			htm += '<div class="progress-bar"></div>';
			htm += '</div></div>';
			DElement.append(el, htm);
		}
	}
	this.fireHandler('onAfterRenderElement', arguments);
}

DProgress.prototype.resolvePieDiameter = function(el) {
    var w = Math.max(Math.min(DElement.getWidth(el), DElement.getHeight(el)) - this.config.pieMargin, 0);
    return w - w % 2; // must be an even number
}

DProgress.prototype.onSchedule = function() {
    this.update();
    this.fireHandler('onprogress', arguments);
}

DProgress.prototype.onTimeup = function() {
	this.update().stop();
	this.fireHandler('callback', arguments);
}

DProgress.prototype.onStart = function(e) {
    return this.start(e);
}

DProgress.prototype.restart = function() {
    if (this.isRunning()) {
        this.stop();
    }
    return this.start();
}

DProgress.prototype.applyFilter = function(filter, keepPreviousFilter) {
	filter = filter || this.config.filter;
	if (typeof filter == 'function') {
		this.filteredElements = new DElementList(DElementList.filter(!!keepPreviousFilter ? this.filteredElements.elements : this.dElementList.elements, filter, this));
	}
	return this;
}

DProgress.prototype.resetFilter = function() {
	this.filteredElements = this.dElementList;
	return this;
}

DProgress.prototype.start = function(filter) {
    if (this.isRunning()) {
        return this;
    }
    if (this.fireHandler('onBeforeStart', arguments)) {
		this.applyFilter(filter);
		this.filteredElements.forEach(this.startElement.bind(this));
        if (this.dTimer) {
            this.dTimer.start();
        }
    }
    this.fireHandler('onAfterStart', arguments);
    return this;
}

DProgress.prototype.update = function(progress, msg) {
	var args = [].addAll(arguments);
	if (typeof progress == 'number') {
		this.progress = progress;
	}
	else if (this.dTimer) {
		this.progress = Math.min(Math.round(100 * this.dTimer.runningTime / this.dTimer.duration), 100);
		args.push(this.progress);
	} else {
		throw 'No progress detected!';
	}
	var cfg = this.config;
	if (typeof msg != 'string') {
		msg = (cfg.showMessage && typeof cfg.msgTemplate == 'string') ? dLib.util.formatMessage(cfg.msgTemplate, [this.progress]) : (cfg.showMessage ? this.progress + ' %' : '');
		args.push(msg);
	}
	if (this.fireHandler('onBeforeUpdate', args)) {
		this.filteredElements.forEach(function(el, i, elements) {
			this.updateElement(el, this.progress, msg, i);
		}.bind(this));
	}
	this.fireHandler('onAfterUpdate', args);
	return this;
}

DProgress.prototype.startElement = function(el, i, elements) {
	if (this.fireHandler('onBeforeStartElement', arguments)) {
		DElement.attr(el, 'data-disabled', true);
		DElement.addClass(el, 'in-progress');
		q('.progress-container', el).show();
	}
	this.fireHandler('onAfterStartElement', arguments);
}

// is also called when resetting, but then should custom events should not be fired
DProgress.prototype.updateElement = function(el, pct, msg) {
    if (!pct || this.fireHandler('onBeforeUpdateElement', arguments)) {
        if (this.config.showMessage) {
            q('.progress-message', el).html(msg);
        }
        if (this.usePie()) {
            if (this.useCanvas()) {
                this.updateCanvas(el, pct, msg);
            }
            else if (this.useSVG()) {
//                this.updateSVG(el, pct, msg);
            }
            else if (this.useKeyFrames()) {

            } else {
                if (pct > 50) {
                    q('.pie.fill', el).show();
                    q('.progress-pie', el).css('clip', 'rect(auto, auto, auto, auto)');
                }
                var deg = pct * 360 / 100;
                q('.pie', el).css('transform', 'rotate(' + deg + 'deg)', true);
            }
        } else {
            q('.progress-bar', el).css('width', pct + '%');
        }
    }
	if (pct) {
		this.fireHandler('onAfterUpdateElement', arguments);
	}
}

DProgress.prototype.updateCanvas = function(el, pct, msg) {
    var canvas = q('canvas.pie-canvas', el).item(0);
    var context = canvas.getContext("2d");
    var x = canvas.width / 2;
    var y = canvas.height / 2;
    var radius = Math.floor(Math.min(canvas.width, canvas.height) / 2);
    var counterClockwise = false;
    var startAngle = this.config.pieStartAngle % 360 - 90; // subtract 90 to make a start angle of zero correspond to "twelwe o'clock" - otherwise zero is three o'clock
    context.clearRect(0, 0, canvas.width, canvas.height); // must be called
    context.beginPath(); // must be called
    var toAngle = Math.ceil(pct * 360 / 100) + startAngle;
    var radianFactor = Math.PI / 180;
    // to increment the arc (i.e. from previous angle to current) will create small gaps in the circle and will ruin the possibility to change the duration when running, so we always redraw from the start angle
    context.arc(x, y, Math.max(0, radius - 0.5 * context.lineWidth), startAngle * radianFactor, toAngle * radianFactor, counterClockwise);
    if (this.config.fill) {
        context.lineTo(x, y);
        context.fill();
    } else {
        context.stroke();
    }
    if (msg) {
        context.fillStyle = this.config.canvasStyles.fontColor;
        context.fillText(msg, x - Math.round(0.5 * context.measureText(msg).width), y + Math.floor(0.5 * parseInt(this.config.canvasStyles.font, 10)));
        context.fillStyle = this.config.canvasStyles.fillStyle;
    }
}

// triggered by dTimer's timeup event
DProgress.prototype.reset = function() {
	if (this.fireHandler('onBeforeReset', arguments)) {
		this.filteredElements.forEach(this.resetElement.bind(this));
		this.progress = 0;
		if (this.config.resetFilterOnStop) {
			this.resetFilter();
		}
		if (this.dTimer) {
			this.dTimer.stop();
		}
	}
	this.fireHandler('onAfterReset', arguments);
	return this;
}

DProgress.prototype.resetElement = function(el) {
	if (this.fireHandler('onBeforeResetElement', arguments)) {
		if (this.usePie()) {
			if (this.useCanvas()) {
				DElement.attr(el, 'data-disabled', false);
				DElement.removeClass(el, 'in-progress');
				q('.progress-container', el).hide();
				this.updateCanvas(el, 0, '');
			}
			else if (this.useSVG()) {
//                this.updateSVG(el, pct, msg);
			}
			else if (this.useKeyFrames()) {
				// do nothing
			} else {
				DElement.attr(el, 'data-disabled', false);
				DElement.removeClass(el, 'in-progress');
				q('.progress-container', el).hide();
				if (this.config.showMessage) {
					q('.progress-message', el).html('');
				}
				var w = this.resolvePieDiameter(el);
				q('.progress-pie', el).css('clip', 'rect(0, ' + w + 'px, ' + w + 'px, ' + (w / 2) + 'px)');
				q('.progress-pie .pie', el).css('transform', 'rotate(0)', true);
				q('.progress-pie .pie.fill', el).css('transform', 'rotate(180deg)', true).hide();
			}
		} else {
			DElement.attr(el, 'data-disabled', false);
			DElement.removeClass(el, 'in-progress');
			q('.progress-container', el).hide();
			this.updateElement(el, 0, '');
		}
	}
	this.fireHandler('onAfterResetElement', arguments);
}

DProgress.prototype.stop = function() {
    if (this.fireHandler('onBeforeStop', arguments)) {
        this.reset();
    }
    this.fireHandler('onAfterStop', arguments);
    return this;
}

// save handler for possible removal later
DProgress.onDOMReadyListener = addDOMReadyListener(function() {
    DProgress.initAll();
});


