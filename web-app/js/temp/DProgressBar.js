if (typeof dLib == "undefined") {
    throw new Error('DProgressBar.js: You must load the file DLib.js!');
}

function DProgressBar(dElement, config) {
    this.dElement = dElement; // wrapper element
    this.config = Object.configure(config, this.constructor.defaultConfig);
    this.msgElement = null;
    this.barElement = null;
    this.progress = 0;
    this.initialized = false;
}

DProgressBar.instances = [];

DProgressBar.defaultConfig = {
    scope: null,
    onInit: null
}

DProgressBar.newInstance = function(element, config) {
    var instance = new DProgressBar(element, config);
    DProgressBar.instances.push(instance);
    return instance;
}

DProgressBar.initAll = function() {
    for (var i = 0, l = DProgressBar.instances.length; i < l; i++) {
        DProgressBar.instances[i].init();
    }
}

DProgressBar.prototype.fireHandler = dLib.util.fireHandler;

DProgressBar.prototype.toString = function() {
    return "[object " + this.constructor.getName() + "] " + ((this.dElement && this.dElement.element) ? this.dElement.element.id : this.dElement);
}

DProgressBar.prototype.init = function() {
    if (!this.initialized) {
        this.dElement = g(this.dElement);
		this.render();
        var id = this.dElement.getId();
		this.msgElement = g(id + '-text');
		this.barElement = g(id + '-bar');
        this.initialized = true;
        this.fireHandler("onInit", []);
    }
    return this;
}

DProgressBar.prototype.render = function() {
	var id = this.dElement.getId();
	var htm = '<div id="' + id + '-text" class="progress-text">' + this.dElement.html() + '</div>';
	htm += '<div id="' + id + '-bar-wrapper" class="progress-bar-wrapper">';
	htm += '<div id="' + id + '-bar" class="progress-bar"></div>';
	htm += '</div>';
	this.dElement.html(htm);
	return this;
}

DProgressBar.prototype.start = function(msg) {
    this.dElement.show();
    if (this.barElement) {
        this.barElement.show().parentElement().show();
    }
	if (this.msgElement && msg) {
		this.msgElement.html(msg);
	}
    return this;
}

DProgressBar.prototype.update = function(progress, msg, css) {
    this.progress = progress;
    if (this.barElement) {
        css = css || { width: this.progress + '%' };
        this.barElement.css(css);
    }
    if (this.msgElement && msg) {
        this.msgElement.html(msg);
    }
    return this;
}

DProgressBar.prototype.stop = function() {
    this.dElement.hide();
    this.reset();
    return this;
}

DProgressBar.prototype.reset = function() {
    this.progress = 0;
	if (this.barElement) {
    	this.barElement.css('width', '0').hide().parentElement().hide();
	}
	if (this.msgElement) {
		this.msgElement.html('');
	}
    return this;
}

// save handler for possible removal later
DProgressBar.onDOMReadyListener = addDOMReadyListener(function() {
    DProgressBar.initAll();
});
