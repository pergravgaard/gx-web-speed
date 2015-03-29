if (typeof dLib == "undefined") {
	throw new Error("DPages.js: You must load DLib.js for this file to work!");
}

function DPageSet(dElement, config) {
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.dElement = dElement;
	this.win = this.config.win || window;
	this.key = '';
	this.dPages = [];
	this.selectedIndex = -1;
	this.initialized = false;
}

DPageSet.defaultConfig = {
	scope: null,
	onBeforeInit: null,
	onAfterInit: null,
	onBeforeStart: null,
	onAfterStart: null,
	onBeforeStop: null,
	onAfterStop: null,
	onBeforeDestroy: null,
	onAfterDestroy: null
}

DPageSet.instances = {};
DPageSet.counter = 0;

DPageSet.newInstance = function(dElement, config) {
	var instance = new DPageSet(dElement, config);
	instance.key = 'dPageSet' + DPageSet.counter++;
	DPageSet.instances[instance.key] = instance;
	return instance;
}

DPageSet.initAll = function() {
	for (var key in DPageSet.instances) {
		DPageSet.instances[key].init();
	}
}

DPageSet.destroyAll = function() {
	for (var k in DPageSet.instances) {
		DPageSet.instances[k].destroy();
	}
}

DPageSet.get = function(elementOrId) {
	for (var key in DPageSet.instances) {
		var dPageSet = DPageSet.instances[key];
		if (typeof elementOrId == 'string') {
			if (dPageSet.dElement.getId() === elementOrId) {
				return dPageSet;
			}
		}
		else if (elementOrId instanceof Element) {
			if (dPageSet.dElement.element === elementOrId) {
				return dPageSet;
			}
		}
	}
	return null;
}

DPageSet.prototype.fireHandler = dLib.util.fireHandler;

DPageSet.prototype.toString = function() {
	return "[object " + this.constructor.getName() + "] " + this.key;
}

DPageSet.prototype.init = function() {
	if (!this.initialized) {
		if (this.fireHandler("onBeforeInit", arguments)) {
			this.dElement = g(this.dElement, null, this.win);
			this.dElement.q('div.page').forEach(function(div, i) {
				var pageConfigs = this.config['pages'];
				if (Array.isArray(pageConfigs) && i in pageConfigs && Object.isObject(pageConfigs[i])) {
					this.addPage(div, pageConfigs[i]);
				} else {
					this.addPage(div);
				}
			}.bind(this));
			this.dPages.forEach(function(dPage) { dPage.init(); });
			this.resolvePage();
			this.initialized = true;
		}
		this.fireHandler("onAfterInit", arguments);
	}
	return this;
}

DPageSet.prototype.addPage = function(div, cfg) {
	var dPage = new DPage(div, this, cfg);
	dPage.index = this.dPages.length;
	this.dPages.push(dPage);
	return dPage;
}

DPageSet.prototype.resolvePageId = function() {
	return this.win.location.hash.replace('#', '');
}

DPageSet.prototype.resolvePage = function() {
	this.showPage(this.resolvePageId() || this.resolveDefaultPage().id);
}

//DPageSet.prototype.resolvePage = function() {
//	var id = this.resolvePageId();
//	if (id) {
//		this.showPage(id);
//	} else {
//		var div = this.resolveDefaultPage();
//		if (div) {
//			//this.goto(div.id);
//			this.showPage(div.id);
//		}
//	}
//}

DPageSet.prototype.goto = function(pageId) {
    if (location.hash == '#' + pageId) {
        this.showPage(pageId);
    } else {
	    this.win.location.hash = pageId; // triggers hashchange listener (resolvePage)
    }
}

DPageSet.prototype.showPrevPage = function() {
	var div = this.resolvePreviousPage();
	if (div) {
		this.showPage(div.id);
	} else {
		this.goBack();
	}
}

DPageSet.prototype.showPage = function(pageId) {
	var active, oldPrev, newPrev;
	this.dElement.q('div.page').forEach(function(div, i) {
		if (pageId === div.id) {
			active = div;
		}
		if (DElement.hasClass(div, 'prev')) {
			oldPrev = div;
		}
		if (DElement.hasClass(div, 'active')) {
			newPrev = div;
			DElement.removeClass(div, 'active');
		}
	});
	dLib.assert(!!active, 'Page ' + pageId + ' not found!');
	dLib.assert(oldPrev == null || newPrev == null || oldPrev !== newPrev);
	if (!DElement.hasClass(active, 'active')) { // may be specified in the HTML
		DElement.addClass(active, 'active');
		if (oldPrev === active) {
			DElement.removeClass(oldPrev, 'prev');
		}
	}
	if (newPrev && newPrev !== active && !DElement.hasClass(newPrev, 'nohash')) {
		if (oldPrev) {
			DElement.removeClass(oldPrev, 'prev');
		}
		DElement.addClass(newPrev, 'prev');
	}
	dLib.assert(!DElement.hasClass(active, 'prev'));
//    this.hideModalMessage();
	if (active) {
		DElement.replaceClass(active, 'prev', 'active', true);
	}
	//this.initPage(pageId);
}

DPageSet.prototype.resolveDefaultPage = function() {
	return this.dElement.q('div.page.default').item(0);
}

DPageSet.prototype.resolveActivePage = function() {
	return this.dElement.q('div.page.active').item(0);
}

DPageSet.prototype.resolvePreviousPage = function() {
	return this.dElement.q('div.page.prev').item(0);
}

DPageSet.prototype.goBack = function() {
	this.win.history.back();
}

DPageSet.prototype.destroy = function() {
	if (this.initialized) {
		if (this.fireHandler("onBeforeDestroy", arguments)) {
			if (this.key) {
				// Do NOT decrement counter!
				delete DPageSet.instances[this.key];
			}
			this.dElement = null;
			this.initialized = false;
		}
		this.fireHandler("onAfterDestroy", arguments);
	}
}

// save handler for possible removal later
DPageSet.onHashchangeListener = addEvent('hashchange', function(e) {
	for (var key in DPageSet.instances) {
		DPageSet.instances[key].resolvePage();
	}
});

// save handler for possible removal later
DPageSet.onDOMReadyListener = domReady(function() {
	DPageSet.initAll();
});

function DPage(dElement, dPageSet, config) {
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.dElement = dElement;
	this.dPageSet = dPageSet;
	this.index = NaN;
	this.initialized = false;
}

DPage.defaultConfig = {
	scope: null,
	onBeforeInit: null,
	onAfterInit: null,
	onBeforeStart: null,
	onAfterStart: null,
	onBeforeStop: null,
	onAfterStop: null,
	onBeforeDestroy: null,
	onAfterDestroy: null
}

DPage.prototype.fireHandler = dLib.util.fireHandler;

DPage.prototype.toString = function() {
	return "[object " + this.constructor.getName() + "] " + this.key;
}

DPage.prototype.init = function() {
	if (!this.initialized) {
		if (this.fireHandler("onBeforeInit", arguments)) {
			this.dElement = g(this.dElement);
			this.initialized = true;
		}
		this.fireHandler("onAfterInit", arguments);
	}
	return this;
}

DPage.prototype.destroy = function() {
	if (this.initialized) {
		if (this.fireHandler("onBeforeDestroy", arguments)) {
			this.dElement = null;
			this.initialized = false;
		}
		this.fireHandler("onAfterDestroy", arguments);
	}
}