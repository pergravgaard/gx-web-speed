if (typeof dLib == "undefined") {
    throw new Error('DProgressPie.js: You must load the file DProgressBar.js!');
}

function DProgressPie(dElement, config) {
	DProgressPie.superConstructor.apply(this, [dElement, config]);
    this.width = NaN;
    this.height = NaN;
}

DProgressPie.inheritFrom(DProgressBar);

DProgressPie.instances = [];

DProgressPie.defaultConfig = Object.configure({
    width: NaN,
    height: NaN,
	cls: 'progress-pie',
	fill: false,
	borderWidthPct: 10,
	showMessage: true
}, DProgressBar.defaultConfig);

DProgressPie.newInstance = function(element, config) {
    var instance = new DProgressPie(element, config);
	DProgressPie.instances.push(instance);
    return instance;
}

DProgressPie.initAll = function() {
    for (var i = 0, l = DProgressPie.instances.length; i < l; i++) {
		DProgressPie.instances[i].init();
    }
}

DProgressPie.prototype.init = function() {
	if (!this.initialized) {
        this.dElement = g(this.dElement);
		var cfg = this.config;
		this.dElement.addClass(cfg.cls);
        this.width = cfg.width || this.dElement.getWidth(true); // must use offsets when calculating width in IE10
        this.height = cfg.height || this.dElement.getHeight(true);
		if (cfg.fill) {
			this.dElement.addClass('fill');
		}
        this.render();
		var id = this.dElement.getId();
		this.msgElement = cfg.showMessage ? g(id + '-text') : null;
        this.initialized = true;
        this.fireHandler("onInit", []);
	}
	return this;
}

DProgressPie.prototype.destroy = function(remove) {
    if (this.initialized) {
        DProgressPie.applySuper("destroy", this, arguments);
        if (typeof remove != 'boolean' || remove) {
            DProgressPie.instances.remove(this, true);
        }
    }
}

DProgressPie.prototype.render = function() {
	var id = this.dElement.getId();
	var htm = '<div id="' + id + '-text" class="percent"></div><div class="slice"><div class="pie"></div><div class="pie fill"></div></div>';
	this.dElement.html(htm);
    q('.slice', this.dElement).css('clip', 'rect(0, ' + this.width + 'px, ' + this.height + 'px, ' + (this.width / 2) + 'px)');
	var dPies = q('.slice .pie', this.dElement);
	var bw = 0;
    if (!this.config.fill) {
        if (this.config.borderWidthPct) {
            bw = Math.min(this.width, this.height) * this.config.borderWidthPct / 100;
        } else {
            bw = dPies.item(0, true).parseCSS('borderLeftWidth'); // Firefox do not support borderWidth, but left, top, right and bottom have the same value
        }
    }
	dPies.css({
		borderWidth: bw + 'px',
		width: (this.width - 2 * bw) + 'px',
		height: (this.height - 2 * bw) + 'px',
		clip: 'rect(0, ' + (this.width / 2) + 'px, ' + this.height + 'px, 0)',
		borderRadius: this.width / 2 + 'px'
	});
	return this;
}

DProgressPie.prototype.update = function (progress, msg, css) {
    this.progress = progress;
	if (this.msgElement && msg) {
		this.msgElement.html(msg);
	}
	if (progress > 50) {
		q('.slice .pie.fill', this.dElement).show();
		q('.slice', this.dElement).css('clip', 'rect(auto, auto, auto, auto)');
	}
	var deg = progress * 360 / 100;
	q('.slice .pie', this.dElement).css({
		'-moz-transform': 'rotate(' + deg + 'deg)',
		'-webkit-transform': 'rotate(' + deg + 'deg)',
		'-o-transform': 'rotate(' + deg + 'deg)',
		'-ms-transform': 'rotate(' + deg + 'deg)',
		transform: 'rotate(' + deg + 'deg)'
	});
    return this;
}

DProgressPie.prototype.reset = function() {
	DProgressPie.applySuper('reset', this, []);
	q('.slice', this.dElement).css('clip', 'rect(0, ' + this.width + 'px, ' + this.width + 'px, ' + (this.width / 2) + 'px)');
	q('.slice .pie', this.dElement).css({
		'-moz-transform': 'rotate(0)',
		'-webkit-transform': 'rotate(0)',
		'-o-transform': 'rotate(0)',
		'-ms-transform': 'rotate(0)',
		transform: 'rotate(0)'
	});
	q('.slice .pie.fill', this.dElement).css({
		'-moz-transform': 'rotate(180deg)',
		'-webkit-transform': 'rotate(180deg)',
		'-o-transform': 'rotate(180deg)',
		'-ms-transform': 'rotate(180deg)',
		transform: 'rotate(180deg)',
		display: 'none'
	});
	return this;
}

// save handler for possible removal later
DProgressPie.onDOMReadyListener = addDOMReadyListener(function() {
	DProgressPie.initAll();
});
