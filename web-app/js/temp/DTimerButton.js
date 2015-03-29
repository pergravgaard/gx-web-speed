if (typeof dLib == "undefined") {
    throw new Error('DTimerButton.js: You must load the file DProgressBar.js!');
}

function DTimerButton(dElement, config) {
    this.dElement = dElement; // wrapper element
    this.config = Object.configure(config || {}, this.constructor.defaultConfig);
    this.dTimer = null;
    this.dProgress = null;
    this.initialized = false;
}

DTimerButton.instances = {};

DTimerButton.defaultConfig = {
    scope: null,
    onInit: null,
	initialDelay: NaN,
	bindEvents: 'click', // list of events that should start the timer - separate several values with a space
	delay: 100,
	duration: 1500,
	progressType: 'bar', // can be bar or pie - if pie DProgressPie.js must be loaded too. Can be configured by properties progressBarConfig and progressPieConfig, respectively.
	callback: null, // function/handler to execute when timer has expired (duration ms has passed)
	onprogress: null // function/handler to execute when timer is progressing (delay ms has passed)
}

DTimerButton.newInstance = function(element, config) {
    var instance = new DTimerButton(element, config);
	var id = typeof element == 'string' ? element : DElement.getId(element);
    DTimerButton.instances[id] = instance;
    return instance;
}

DTimerButton.initAll = function() {
    for (var id in DTimerButton.instances) {
        DTimerButton.instances[id].init();
    }
}

DTimerButton.prototype.fireHandler = dLib.util.fireHandler;

DTimerButton.prototype.init = function() {
    if (!this.initialized) {
        var cfg = this.config;
        this.dElement = g(this.dElement);
		var timerConfig = Object.extend({ delay: cfg.delay, initialDelay: cfg.initialDelay, duration: cfg.duration }, {
			onSchedule: this.onSchedule,
			onTimeup: this.onTimeup
		});
        this.dTimer = new DTimer(Object.extend({ scope: this }, timerConfig));
		this.render();
		switch (cfg.progressType) {
			case 'pie':
				this.dProgress = new DProgressPie(this.dElement.getId() + '-progress', cfg.progressPieConfig).init();
				break;
			case 'bar':
			default:
				this.dProgress = new DProgressBar(this.dElement.getId() + '-progress', cfg.progressBarConfig).init();
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
	var dEl = this.dElement;
	var id = dEl.getId();
	var usePie = this.config.progressType == 'pie';
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
		this.dElement.on(this.config.bindEvents, this.onClick.bindAsEventListener(this));
	}
    return this;
}

DTimerButton.prototype.onClick = function(e) {
    if (this.fireHandler('onBeforeClick', [e])) {
        this.start();
    }
    this.fireHandler('onAfterClick', [e]);
}

DTimerButton.prototype.start = function() {
	if (this.dProgress instanceof DProgressPie) {
		this.clickListener = function(e) { // important to 'disable' the button - which is a DIV element - while showing progress
			e.preventDefault().stopPropagation();
		};
		// Maybe add more event types than just click, but it works on touch screens as well. But it won't work if the button is assigned other event listeners than of type 'click'!
		q('.progress-overlay, .progress-pie-container', this.dElement).on('click', this.clickListener).show();
	}
    this.dElement.attr('data-disabled', true);
    this.dProgress.start();
    this.dTimer.start();
    return this;
}

DTimerButton.prototype.update = function() {
    var pct = Math.min(Math.round(100 * this.dTimer.runningTime / this.dTimer.duration), 100);
    this.dProgress.update(pct, pct + '%');
    return this;
}

// triggered by dTimer's timeup event
DTimerButton.prototype.stop = function() {
	if (this.clickListener) {
		q('.progress-overlay, .progress-pie-container', this.dElement).off('click', this.clickListener).hide();
	}
    this.dElement.attr('data-disabled', false);
    this.dProgress.stop();
    this.dTimer.stop();
    return this;
}

// save handler for possible removal later
DTimerButton.onDOMReadyListener = addDOMReadyListener(function() {
    DTimerButton.initAll();
});


