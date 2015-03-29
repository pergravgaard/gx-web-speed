if (typeof DProgressBar !== "function") {
    throw new Error('DTimerButtonList.js: You must load the file DProgressBar.js!');
}

function DTimerButton(dElementList, config) {
    this.dElementList = dElementList;
    this.config = Object.configure(config || {}, this.constructor.defaultConfig);
    this.dTimer = null;
    this.dProgress = [];
    this.index = NaN;
    this.initialized = false;
}

DTimerButton.instances = [];

DTimerButton.defaultConfig = {
    scope: null,
    onInit: null,
	initialDelay: NaN,
	bindEvents: 'click', // list of events that should start the timer - separate several values with a space
	delay: 100,
	duration: 1500,
	progressType: 'bar', // can be bar or pie - if pie DProgressPie.js must be loaded too. Can be configured by properties progressBarConfig and progressPieConfig, respectively.
	callback: null, // function/handler to execute when timer has expired (duration ms has passed)
	onprogress: null, // function/handler to execute when timer is progressing (delay ms has passed)
    progressFilter: null // a function that filters which timer buttons to show progress on
}

DTimerButton.newInstance = function(elements, config) {
    var instance = new DTimerButton(elements, config);
    instance.index = DTimerButton.instances.length;
    DTimerButton.instances.push(instance);
    return instance;
}

DTimerButton.initAll = function() {
    DTimerButton.instances.forEach(function(instance) {
        instance.init();
    });
}

DTimerButton.destroyAll = function() {
    DTimerButton.instances.forEach(function(instance) {
        instance.destroy();
    });
}

DTimerButton.prototype.fireHandler = dLib.util.fireHandler;

DTimerButton.prototype.destroy = function() {
    if (this.initialized) {
        if (this.isRunning()) {
            this.stop();
        }
        if (this.config.bindEvents) {
            this.dElementList.off(this.config.bindEvents, this.onClickListener);
        }
        this.dProgress.forEach(function(dp) { dp.destroy(); });
    }
}

DTimerButton.prototype.init = function() {
    if (!this.initialized) {
        var cfg = this.config;
        this.dElementList = typeof this.dElementList == 'string' ? q(this.dElementList) : this.dElementList;
		var timerConfig = Object.extend({ delay: cfg.delay, initialDelay: cfg.initialDelay, duration: cfg.duration }, {
			onSchedule: this.onSchedule,
			onTimeup: this.onTimeup
		});
        this.dTimer = new DTimer(Object.extend({ scope: this }, timerConfig));
		this.render();
        var list = this.dProgress;
		switch (cfg.progressType) {
			case 'pie':
                this.dElementList.forEach(function(el) {
                    list.push(new DProgressPie(DElement.getId(el) + '-progress', cfg.progressPieConfig).init());
                });
				break;
			case 'bar':
			default:
                this.dElementList.forEach(function(el) {
				    list.push(new DProgressBar(DElement.getId(el) + '-progress', cfg.progressBarConfig).init());
                });
				break;
		}
        this.bindEvents();
        this.initialized = true;
        this.fireHandler("onInit", []);
    }
    return this;
}

DTimerButton.prototype.setTimerConfig = function(cfg) {
	var dTimer = this.dTimer;
	['delay', 'initialDelay', 'duration'].forEach(function(p) {
		if (p in cfg) {
			dTimer.config[p] = cfg[p];
		}
	});
	return this;
}

DTimerButton.prototype.addDuration = function(deltaDuration, ignoreIsRunning) {
	return this.setDuration(this.getDuration() + deltaDuration, ignoreIsRunning);
}

DTimerButton.prototype.setDuration = function(duration, ignoreIsRunning) {
	this.dTimer.config['duration'] = duration;
	if (ignoreIsRunning && this.dTimer.isRunning()) {
		this.dTimer.duration = duration;
	}
	return this;
}

DTimerButton.prototype.getDuration = function() {
	return this.dTimer.config.duration; // should be from the config object, not the internal duration
}

DTimerButton.prototype.getRemaining = function () {
	// should be the internal duration, not the configured
	return this.dTimer.duration - this.dTimer.runningTime;
}

DTimerButton.prototype.getRunningTime = function() {
    return this.dTimer.runningTime;
}

DTimerButton.prototype.toString = function() {
    return "[object " + this.constructor.getName() + "] " + ((this.dElement && this.dElement.element) ? this.dElement.element.id : this.dElement);
}

DTimerButton.prototype.render = function() {
	var usePie = this.config.progressType == 'pie';
    var index = this.index;
    this.dElementList.forEach(function(dEl) {
        dEl.attr('data-timer-button-index', '' + index);
        var id = dEl.getId();
        var htm = '';
        if (usePie) {
            var w = Math.min(dEl.getWidth(), dEl.getHeight());
            var t = parseInt(0.1 * w, 10);
            w = w - 2 * t;
            w = w - w % 2; // must be an even number
            htm += '<div class="progress-overlay"></div><div class="progress-pie-container" style="position:absolute;top:50%;left:50%;width:' + w + 'px;height:'+ w +'px;margin-left:-' + (w / 2) + 'px;margin-top:-' + (w / 2) + 'px">';
        } else {
            htm += '<div class="button-text">' + dEl.html() + '</div>';
        }
        htm += '<div id="' + id + '-progress" class="progress-button"';
        if (usePie) {
            htm += ' style="top:0;right:0;bottom:0;left:0;"';
        }
        htm += '></div>';
        if (usePie) {
            htm += '</div>';
        }
        dEl.html(htm);
    }, true);
	return this;
}

DTimerButton.prototype.onSchedule = function() {
	this.update();
	this.fireHandler('onprogress', []);
}

DTimerButton.prototype.onTimeup = function() {
	this.stop();
	this.fireHandler('callback', []);
}

DTimerButton.prototype.isRunning = function() {
	return this.dTimer.isRunning();
}

DTimerButton.prototype.bindEvents = function() {
    if (this.config.bindEvents) {
        this.onClickListener = this.onClick.bindAsEventListener(this);
		this.dElementList.on(this.config.bindEvents, this.onClickListener);
	}
    return this;
}

DTimerButton.prototype.onClick = function(e) {
    if (this.fireHandler('onBeforeClick', [e])) {
        this.start();
    }
    this.fireHandler('onAfterClick', [e]);
}

DTimerButton.prototype.filterProgress = function(fn) {
    var filter = typeof this.config.progressFilter === 'function' ? this.config.progressFilter : function() { return true; };
    var instance = this;
    this.dProgress.forEach(function(dp) {
        if (filter.apply(instance, [dp])) {
            fn(dp);
        }
    });
    return this;
}

DTimerButton.prototype.start = function() {
	if (this.config.progressType == 'pie') {
		this.clickListener = function(e) { // important to 'disable' the button - which is a DIV element - while showing progress
			DEvent.preventDefault(e);
            DEvent.stopImmediatePropagation(e);
            DEvent.stopPropagation(e);
		};
        this.dElementList.on('click', this.clickListener);
		// Maybe add more event types than just click, but it works on touch screens as well. But it won't work if the button is assigned other event listeners than of type 'click'!
        this.dElementList.find('.progress-overlay, .progress-pie-container').show();
	}
    this.dElementList.attr('data-disabled', true);
    this.filterProgress(function(dp) { dp.start(); });
    this.dTimer.start();
    return this;
}

DTimerButton.prototype.update = function() {
    var pct = Math.min(Math.round(100 * this.dTimer.runningTime / this.dTimer.duration), 100);
    this.filterProgress(function(dp) { dp.update(pct, pct + '%'); });
    return this;
}

// triggered by dTimer's timeup event
DTimerButton.prototype.stop = function() {
	if (this.clickListener) {
		this.dElementList.off('click', this.clickListener);
	}
    this.dElementList.find('.progress-overlay, .progress-pie-container').hide();
    this.dElementList.attr('data-disabled', false);
    this.filterProgress(function(dp) { dp.stop(); });
    this.dTimer.stop();
    return this;
}

// save handler for possible removal later
DTimerButton.onDOMReadyListener = addDOMReadyListener(function() {
    DTimerButton.initAll();
});


