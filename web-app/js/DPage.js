var dPage = {
	caller: '', // value set by calling page to support custom behavior
	init: function () {
		this.resolvePage();
	},
	resolveDefaultPage: function() { // meant to be overridden
		return null;
	},
	initPage: function(pageId) {
		// meant to be overridden
	},
	resolvePageId: function() {
		return location.hash.replace('#', '');
	},
	resolvePage: function() {
		var id = this.resolvePageId();
		if (id) {
			this.showPage(id);
		} else {
			var div = this.resolveActivePage();
			if (div) {
				this.goto(div.id);
			}
		}
	},
	goto: function(pageId, caller) {
		if (caller) {
			this.caller = caller;
		}
        if (location.hash == '#' + pageId) {
            this.showPage(pageId);
        } else {
		    location.hash = pageId; // triggers hashchange listener (resolvePage)
        }
	},
	showPrevPage: function() {
		var div = this.resolvePreviousPage();
		if (div) {
			this.showPage(div.id);
		} else {
			this.goBack();
		}
	},
	showPage: function(pageId) {
		var active, oldPrev, newPrev;
		q('div.page').forEach(function(div, i) {
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
        this.hideModalMessage();
		if (active) {
			DElement.replaceClass(active, 'prev', 'active', true);
		}
		this.initPage(pageId);
	},
	resolveActivePage: function() {
		return q('div.page.active').item(0);
	},
	resolvePreviousPage: function() {
		return q('div.page.prev').item(0);
	},
	goBack: function() {
		history.back();
	},
	goBack1: function() {
		var div = this.resolvePreviousPage() || this.resolveDefaultPage();
		if (!div) {
			return;
		}
		if (location.hash == '#' + div.id) {
			this.showPage(div.id);
		} else {
			this.goto(div.id);
		}
	},
//	preparePage: function () {
//		this.showModalProgressMessage('Initializing page');
//	},
    // TODO: The following methods should be moved to a dMessage object in DLib.js where the different CSS class names can be overridden/configured
	/* some show/hide message methods - you can show modal, progress and message anyway you like, but you should call the corresponding hide method afterwards */
	showModalProgressMessage: function (msg, cfg) {
		g('modal').show();
		g('progress').addClass('modal').show();
		this.showMessage(cfg);
	},
	hideModalProgressMessage: function (cfg) {
		g('progress').removeClass('modal').hide();
		g('modal').hide();
		this.hideMessage(cfg);
	},
	showProgressMessage: function (msg, cfg) {
		g('progress').show();
		this.showMessage(cfg);
	},
	hideProgressMessage: function (cfg) {
		g('progress').hide();
		this.hideMessage(cfg);
	},
	showModalMessage: function (msg, cfg) {
		g('modal').show();
		this.showMessage(msg, cfg);
	},
	hideModalMessage: function (cfg) {
		g('modal').hide();
		this.hideMessage(cfg);
	},
    showErrorMessage: function (msg, config) {
        this.showMessage(msg, config);
    },
	showMessage: function (msg, config) {
		var cfg = Object.extend({
			timeout: NaN,
			cls: 'has-messages',
			fadeIn: null // specify an (empty) object literal for fading
		}, config);
		var dEl = g('messages');
		dEl.addClass(cfg.cls);
		if (msg) {
			dEl.html(msg);
		}
		if (cfg.fadeIn) {
			dEl.fadeIn(cfg.fadeIn);
		} else {
			dEl.show();
		}
		if (cfg.timeout) {
			window.setTimeout(function () {
				dPage.hideModalMessage(cfg);
			}, cfg.timeout);
		}
	},
	hideMessage: function (config) {
		var cfg = Object.extend({
            cls: 'has-messages',
			fadeOut: null // specify an (empty) object literal for fading
		}, config);
		var dEl = g('messages');
		if (cfg.fadeOut) {
			dEl.fadeOut(Object.extend({
				complete: function() {
					this.html('').attr('class', cfg.cls);
				}
			}, cfg.fadeOut));
		} else {
			dEl.html('').hide().attr('class', cfg.cls);
		}
	}
};

// save handler for possible removal later
dPage.onHashchangeListener = addEvent('hashchange', function(e) {
	dPage.resolvePage();
});

// save handler for possible removal later
dPage.onDOMReadyListener = addDOMReadyListener(function() {
	dPage.init();
});