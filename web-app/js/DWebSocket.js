// Wrapper class for the native WebSocket class
function DWebSocket(wsUri, protocols) {
	this.wsUri = wsUri;
	this.protocols = DWebSocket.resolveProtocols(protocols);
	this.webSocket = DWebSocket.create(this.wsUri);
}

// returns a list of strings
DWebSocket.resolveProtocols = function(protocol) {
	if (protocol instanceof Array) {
		return protocol;
	}
	if (typeof protocol == 'string') {
		return [protocol];
	}
	return ['DWebSocket Protocol']; // TODO: Shouldn't this be something else?
}

DWebSocket.create = function(wsUri) {
	var wsCreator = DWebSocket.wsCreator;
	if (!wsCreator) {
		if (window.WebSocket && window.WebSocket.CLOSED == 3) { // rule out browsers that supports the older versions of the WebSocket API (like Android Stock Browser) where CLOSED equals 2 and not 3
			wsCreator = function(wsu) {
				return new WebSocket(wsu);
			}
		}
		else if (window.MozWebSocket) {
			wsCreator = function(wsu) {
				return new MozWebSocket(wsu);
			}
		} else {
			wsCreator = function() { throw new Error('The WebSocket interface is not supported'); }
		}
		DWebSocket.wsCreator = wsCreator;
	}
	return wsCreator(wsUri);
}

DWebSocket.normalizeEventType = function(eventType) {
	var et = eventType.toLowerCase();
	if (et.indexOf('on') != 0) {
		et = 'on' + et;
	}
	return et;
}

DWebSocket.transformData = function(data) {
	switch (data.constructor) {
		case Object:
			return JSON.stringify(data);
		case String:
		default:
			return data;
	}
}

DWebSocket.prototype.toString = function() {
	return '[DWebSocket ' + this.wsUri + ']';
}

//WebSocket.OPEN = 1
//WebSocket.CONNECTING = 0
//WebSocket.CLOSING = 2
//WebSocket.CLOSED = 3
DWebSocket.prototype.send = function(data) {
	if (this.webSocket && this.webSocket.readyState == window.WebSocket.OPEN) {
		this.webSocket.send(DWebSocket.transformData(data));
	}
	return this;
}

// The code must be either 1000, or between 3000 and 4999. Otherwise browsers (tested on Chrome) will throw an error
DWebSocket.prototype.close = function(code, reason) {
	if (this.webSocket) {
		switch(this.webSocket.readyState) {
			case WebSocket.CONNECTING:
			case WebSocket.OPEN:
				this.webSocket.close(code, reason);
				break;
			case WebSocket.CLOSED:
			case WebSocket.CLOSING:
			default:
				break;
		}
	}
	return this;
}

/**
 * Add event listener - supported event types are open, message, close and error
 * Executes the eventHandler in the scope of the wrapper instance
 * Allows a chainable coding style by returning this wrapper instance
 * @param eventType
 * @param eventHandler
 */
DWebSocket.prototype.on = function(eventType, eventHandler) {
	if (this.webSocket) {
		var thisObj = this;
		this.webSocket[DWebSocket.normalizeEventType(eventType)] = function(e) {
			eventHandler.call(thisObj, e);
		}
	}
	return this;
}