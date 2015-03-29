function DSound(sounds) {
	this.context = DSound.createContext();
	// map for loaded sounds
	this.sounds = sounds || {};
	this.initialized = false;
}

DSound.createContext = function() {
	if (!DSound.contextConstructor) {
		var c;
		if ('AudioContext' in window) {
			c = window.AudioContext;
		}
		else if ('webkitAudioContext' in window) {
			c = window.webkitAudioContext;
		}
		DSound.contextConstructor = c;
	}
	return DSound.contextConstructor ? new DSound.contextConstructor() : null;
}

DSound.prototype.init = function() {
	if (!this.initialized) {
		if (!this.context) {
			return this;
		}
		// create our permanent nodes
		this.nodes = {
			destination: this.context.destination, // speaker
			masterGain: this.context.createGain() // volume
//			backgroundMusicGain: this.context.createGain(),
//			coreEffectsGain: this.context.createGain(),
//			effectsGain: this.context.createGain(),
//			pausedEffectsGain: this.context.createGain()
		};

		this.nodes.masterGain.gain.value = 0.5;

		// and setup the graph
		this.nodes.masterGain.connect(this.nodes.destination);
//		this.nodes.backgroundMusicGain.connect(this.nodes.masterGain);
//		this.nodes.coreEffectsGain.connect(this.nodes.masterGain);
//		this.nodes.effectsGain.connect(this.nodes.coreEffectsGain);
//		this.nodes.pausedEffectsGain.connect(this.nodes.coreEffectsGain);


		this.buffer();
		this.initialized = true;
	}
	return this;
}

//DSound.prototype.pauseEffects = function() {
//	this.nodes.effectsGain.disconnect();
//	var now = performance.now();
//	for (var name in this.sounds) {
//		var sound = this.sounds[name];
//		if (!sound.ignorePause && (now - sound.source.noteOnAt < sound.buffer.duration * 1000)) {
//			sound.pausedAt = now - sound.source.noteOnAt;
//			//sound.source.noteOff();
//			sound.source.stop();
//		}
//	}
//}

DSound.prototype.pauseSound = function(sound, disconnect) {
	if (typeof sound == 'string') {
		sound = this.getSound(sound);
	}
	if (sound && sound.source) {
		var now = this.now();
		sound.source.stop(0);
		sound.pausedAt += now - sound.startTime;
		sound.startTime = NaN;
		out('stopping at '+sound.pausedAt);
		if (disconnect) {
			sound.source.disconnect();
		}
	}
	return this;
}

//DSound.prototype.resumeEffects = function() {
//	this.nodes.effectsGain.connect(this.nodes.coreEffectsGain);
//	var now = performance.now();
//	for (var name in this.sounds) {
//		var sound = this.sounds[name];
//		if (sound.pausedAt) {
//			this.play(sound.name);
//			delete sound.pausedAt;
//		}
//	}
//};

DSound.prototype.now = function() {
	return performance.now();
}

DSound.prototype.getSound = function(soundName) {
	return this.sounds[soundName];
}

DSound.prototype.isSoundPlaying = function(sound) {
	return !isNaN(sound.startTime);
}

DSound.prototype.toggleSound = function(sound, options) {
	if (typeof sound == 'string') {
		sound = this.getSound(sound);
	}
	var isPlaying = this.isSoundPlaying(sound);
	out('playing: ' + isPlaying)
	if (isPlaying) {
		this.pauseSound(sound);
	} else {
		this.playSound(sound, options);
	}
	return !isPlaying;
}

DSound.prototype.playSound = function(sound, options) {
	if (typeof sound == 'string') {
		sound = this.getSound(sound);
	}
	options = options || {};
	var source = sound.source = this.context.createBufferSource(); // must create a new buffer source node each time (start can only be called once)
	source.buffer = sound.buffer; // tell the source which sound to play
	source.connect(options.channel || this.nodes.masterGain);
	var now = this.now();
	if (sound.pausedAt) {
		// start(when (secs), offset (secs), duration (secs))
		var offset = Math.floor(sound.pausedAt / 1000);
		source.start(0, offset, sound.buffer.duration - offset);
	} else {
		source.start(0);
	}
	sound.startTime = now;
	return this;
}

DSound.prototype.getVolume = function() {
	return this.nodes.masterGain.gain.value;
}

/* volume is between 0 and 100 */
DSound.prototype.setVolume = function(volume) {
	out('setting volume: ' + volume)
	//var fraction = parseInt(element.value) / parseInt(element.max);
  // Let's use an x*x curve (x-squared) since simple linear (x) does not
  // sound as good.
  //this.gainNode.gain.value = fraction * fraction;
	var v = parseInt(volume, 10) / 100;
	this.nodes.masterGain.gain.value = v * v;
	return this;
}


//DSound.prototype.playSound1 = function(sound, options) {
//	options = options || {};
//	var now = performance.now();
//	var source;
//	if (sound.source) {
//		source = sound.source;
//		out('dur: ' + sound.buffer.duration)
//		if (!options.loop && now - source.startAt > sound.buffer.duration * 1000) {
//			// discard the previous source node
//			source.stop(0);
//			source.disconnect();
////		} else {
////			out('return')
////			return;
//		}
//	}
//	out('play')
//	source = this.context.createBufferSource();
//	sound.source = source;
//	// track when the source is started to know if it should still be playing
//	source.noteOnAt = now;
//
//	// help with pausing
//	sound.ignorePause = !!options.ignorePause;
//	var channel = options.ignorePause ? this.nodes.pausedEffectsGain : this.nodes.effectsGain;
//	source.buffer = sound.buffer; // tell the source which sound to play
//	source.connect(channel); // connect the source to the context's destination (the speakers)
//	source.loop = !!options.loop;
//
//	// Fieldrunners' current code doesn't consider sound.pausedAt.
//	// This is an added section to assist the new pausing code.
//	if (sound.pausedAt) {
//		// TODO: test this
//		source.start((sound.buffer.duration * 1000 - sound.pausedAt) / 1000);
//		source.startAt = now + sound.buffer.duration * 1000 - sound.pausedAt;
//
//		// if you needed to precisely stop sounds, you'd want to store this
//		var resumeSource = this.context.createBufferSource();
//		resumeSource.buffer = sound.buffer;
//		resumeSource.connect(channel);
//		resumeSource.start(0, sound.pausedAt, sound.buffer.duration - sound.pausedAt / 1000);
//	} else {
//		// start play immediately with a value of 0 or less
//		source.start(0);
//	}
//	return this;
//}

//DSound.prototype.startSource = function(source, time) {
//	if ('start' in source) {
//		source.start(time || 0);
//	}
//	else if ('noteOn' in source) {
//		source.start(time || 0);
//	}
//	return this;
//}

DSound.prototype.toString = function() {
	return '[object DSound]';
}

DSound.prototype.buffer = function() {
	for (var n in this.sounds) {
		var sound = this.sounds[n];
		sound.name = sound.name || n;
		sound.buffer = sound.buffer || null; // will be set in decodeData
		sound.source = null; // will be set when playing
		sound.startTime = NaN;
		sound.pausedAt = 0; // how many milliseconds of the sound have been played
	    dAjax({
		    url: sound.path,
		    sound: sound,
		    responseType: 'arraybuffer',
		    onCompleteOk: function (e, hr) {
			    alert('ok')
			    //this.decodeData(data, config.sound);
		    }.bind(this)
	    });
	}
	return this;
}

DSound.prototype.decodeData = function(arrayBuffer, sound) {
	if (arrayBuffer && sound) {
		if ('decodeAudioData' in this.context) {
			this.context.decodeAudioData(arrayBuffer, function(buffer) {
				sound.buffer = buffer;
				//out('buffered')
			});
		}
	}
	return this;
}
/*
function DSound(config) {
	this.config = config;
	this.name = '';
	this.path = '';
	this.initialized = false;
}

DSound.prototype.toString = function() {
	return '[object DSound]';
}

DSound.prototype.init = function() {

}

DSound.prototype.play = function(loop) {

}

DSound.prototype.pause = function() {

}

DSound.prototype.stop = function() {

}*/