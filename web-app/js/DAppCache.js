// See http://alistapart.com/article/application-cache-is-a-douchebag
// See https://developer.mozilla.org/en-US/docs/HTML/Using_the_application_cache
// See http://appcachefacts.info/
if (!window.DProgress) {
	throw new Error('DAppCache.js: You must load the file DProgress.js!');
}
// singleton
var dAppCache = {
	filesCounter: 0,
	noOfCachedFiles: NaN, // set after loading/including this file
	progressBarId: '', // set after loading/including this file
	dProgressBar: null, // initialized on ready if progressBarId is set
	cache: window.applicationCache,
	messages: {
		onprogress: 'Downloading {0} of {1} files&hellip;'
	},
	fireHandler: dLib.util.fireHandler,
	// event listeners - this refers to dAppCache.cache (window.applicationCache)
	onchecking: function(e) { // occurs after DOMContentLoaded!
		this.fireHandler("onChecking", arguments);
	},
	onnoupdate: function(e) {
		this.fireHandler("onNoUpdate", arguments);
	},
	ondownloading: function(e) {
		if (this.dProgress) {
			this.dProgress.start();
		}
		this.fireHandler("onDownloading", arguments);
	},
	onprogress: function(e) { // is called when another file has been downloaded
		if (typeof e.total == 'number') {
			this.noOfCachedFiles = e.total + 1; // e.total does not include the master file, which also fires the progress event
		}
		if (this.dProgress) {
			var msg = dLib.util.formatMessage(this.messages['onprogress'], [++this.filesCounter, this.noOfCachedFiles]);
			var pct = Math.min(Math.round(100 * this.filesCounter / this.noOfCachedFiles), 100);
			this.dProgress.update(pct, msg);
		}
		this.fireHandler("onProgress", arguments);
	},
	onupdateready: function(e) {
		if (this.dProgress) {
			this.dProgress.stop();
		}
		this.fireHandler("onUpdateReady", arguments);
		this.filesCounter = 0;
	},
	oncached: function(e) {
		if (this.dProgress) {
			this.dProgress.stop();
		}
		this.fireHandler("onCached", arguments);
		this.filesCounter = 0;
	},
	onobsolete: function(e) {
		this.fireHandler("onObsolete", arguments);
	},
	onerror: function(e) {
		this.fireHandler("onError", arguments);
	},
	reload: function(force) {
		this.swap();
		location.reload(typeof force != 'boolean' ? true : force);
	},
	update: function() {
		if (!this.cache) {
			return;
		}
		//out('update status: ' + this.cache.status)
		switch (this.cache.status) {
			case applicationCache.UNCACHED: // 0
			case applicationCache.CHECKING: // 2
			case applicationCache.DOWNLOADING: // 3
			case applicationCache.OBSOLETE: // 5
				break;
			case applicationCache.IDLE: // 1
			case applicationCache.UPDATEREADY: // 4
				this.cache.update(); // will throw an error if statis is UNCACHED (0)
				break;
		}
		return this;
	},
	// NOTE: Even though the cache is updated and swapped, the new versions of the files will not be used by the browser until page is reloaded!
	swap: function() {
		if (!this.cache) {
			return;
		}
		if (this.cache.status === applicationCache.UPDATEREADY) {
			this.cache.swapCache();
		}
		return this;
	},
	init: function() {
		if (!this.cache) {
			return;
		}
		var eventTypes = 'checking,error,noupdate,downloading,progress,updateready,cached,obsolete'.split(',');
		var i = eventTypes.length;
		while (i--) {
			var eType = eventTypes[i];
			this.cache.addEventListener(eType, this['on' + eType].bind(this), false);
		}
		return this;
	},
	ready: function() {
		if (!this.cache) {
			return;
		}
		if (this.progressBarId) {
			this.dProgress = DProgress.newInstance('#' + this.progressBarId, {
				useTimer: false
			}).init();
		}
	}
};

dAppCache.init(); // must be done now - onDOMContentLoaded is too late

// save handler for possible removal later
dAppCache.onDOMReadyListener = addDOMReadyListener(function() {
	if (document.documentElement && document.documentElement.getAttribute && document.documentElement.getAttribute('manifest')) {
		dAppCache.ready();
	}
});
