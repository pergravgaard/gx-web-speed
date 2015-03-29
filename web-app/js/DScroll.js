if (typeof dLib == "undefined") {
    throw new Error("DScroll.js: You must load DLib.js!");
}

function DScroll(dElement, config) {
    this.dElement = dElement;
	this.processing = false;
	this.prevScrollY = 0;
    this.config = Object.configure(config, this.constructor.defaultConfig);
    this.initialized = false;
}

DScroll.defaultConfig = {
    scope: null,
    onInit: null
}

DScroll.instances = [];

DScroll.initAll = function() {
    for (var i = 0, l = DScroll.instances.length; i < l; i++) {
        DScroll.instances[i].init();
    }
}

DScroll.newInstance = function(dElement, config) {
    var instance = new DScroll(dElement, config);
    DScroll.instances.push(instance);
    return instance;
}

DScroll.prototype.fireHandler = dLib.util.fireHandler;

DScroll.prototype.init = function() {
	if (!this.initialized) {
		this.dElement = g(this.dElement);
		dLib.event.add(window, 'scroll', this.onScroll.bindAsEventListener(this));
		this.initialized = true;
		this.fireHandler("onInit", []);
	}
	return this;
}


DScroll.prototype.toString = function() {
	return "[object " + this.constructor.getName() + "] " + ((this.dElement && this.dElement.element) ? this.dElement.element.id : this.dElement);
}

DScroll.prototype.onScroll = function(e) {
	var offset = this.dElement.getPageOffset();
	var pageY = offset[1];
	var vw = this.dElement.getDefaultView();
	var scrollY = getScrollY(vw);
	var wh = getViewportHeight(vw);
	var oh = this.dElement.element.offsetHeight;
	if (scrollY > this.prevScrollY && scrollY + wh >= pageY + oh) {
		this.loadData();
	}
	this.prevScrollY = Math.max(this.prevScrollY, scrollY);
}

DScroll.prototype.loadData = function() {
	if (this.processing) {
		return;
	}
	out('loading...');
	this.processing = true;
	setTimeout(function() { this.processing = false; }.bind(this), 750);
	return this;
}

// save handler for possible removal later
DScroll.onDOMReadyListener = addDOMReadyListener(function() {
    return;
	q('.scaffold .list').forEach(function(el, i) {
		DScroll.newInstance(el);
	});
    DScroll.initAll();
});
