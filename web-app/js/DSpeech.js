if (typeof dLib == "undefined") {
	throw new Error('DSpeech.js: You must load the file DLib.js!');
}

function DSpeech(dElement, config) {
	this.dElement = dElement;
	this.config = Object.configure(config || {}, this.constructor.defaultConfig);
	//this.speechRecognition = DSpeech.createSpeechRecognition(this.config); // requires network connection (that you're online)
	this.speechSynthesis = ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) ? window.speechSynthesis : null;
	this.startTime = null;
	this.endTime = null;
	this.ignoreEnd = false;
	this.recognizing = false;
	this.initialized = false;
}

DSpeech.instances = {};
DSpeech.counter = 0;

DSpeech.defaultConfig = {
	lang: 'en-US',
	scope: null,
	onInit: null,
	onStart: null,
	onError: null,
	onEnd: null,
	onResult: null,
	recognition: {
		continuous: true,
		interimResults: true
	},
	utterance: {
		voiceURI: 'native',
		volume: 1, // 0 to 1
		rate: 0.1, // 0.1 to 10
		pitch: 1.5 //0 to 2
	}
}

DSpeech.createSpeechRecognition = function(cfg) {
	if ('SpeechRecognition' in window) {
		if (!Object.isObject(cfg)) {
			cfg = DSpeech.defaultConfig.recognition;
		}
		var speech = new SpeechRecognition();
		for (var p in cfg) {
			if (p in speech) {
				Log.d(p + ': ' + cfg[p]);
				speech[p] = cfg[p];
			}
		}
		return speech;
	}
	return null;
}

DSpeech.createSpeechUtterance = function(cfg) {
	if ('SpeechSynthesisUtterance' in window) {
		if (!Object.isObject(cfg)) {
			cfg = DSpeech.defaultConfig.utterance;
		}
		var speech = new SpeechSynthesisUtterance();
		for (var p in cfg) {
			if (p in speech) {
				Log.d(p + ': ' + cfg[p]);
				speech[p] = cfg[p];
			}
		}
		return speech;
	}
	return null;
}

DSpeech.newInstance = function(element, config) {
	var instance = new DSpeech(element, config);
	instance.key = 'dSpeech' + DSpeech.counter++;
	DSpeech.instances[instance.key] = instance;
	return instance;
}

DSpeech.initAll = function() {
	for (var k in DSpeech.instances) {
		DSpeech.instances[k].init();
	}
}

DSpeech.destroyAll = function() {
	for (var k in DSpeech.instances) {
		DSpeech.instances[k].destroy();
	}
}

DSpeech.prototype.fireHandler = dLib.util.fireHandler;

DSpeech.prototype.toString = function() {
	return "[object " + this.constructor.getName() + "] key: " +this.key;
}

DSpeech.prototype.destroy = function() {
	if (this.initialized) {
		if (this.fireHandler("onBeforeDestroy", arguments)) {
			if (this.recognizing) {
				Log.d('destroying');
				this.stop();
			}
			if (this.key) {
				// Do NOT decrement counter!
				delete DSpeech.instances[this.key];
			}
			this.speechRecognition = null;
			this.startTime = null;
			this.endTime = null;
//			this.dElement.attr('data-progress-key', '').find('.progress-container').remove();
			this.dElement = null;
			this.initialized = false;
		}
		this.fireHandler("onAfterDestroy", arguments);
	}
}

DSpeech.prototype.init = function() {
	if (!this.initialized) {
		this.dElement = typeof this.dElement == 'string' ? g(this.dElement) : this.dElement;
//		this.render();
		if (this.speechRecognition) {
			['error', 'start', 'end', 'result'].forEach(function(s) {
				this.speechRecognition['on' + s] = this['on' + s.capitalize()].bind(this);
			}.bind(this));
		}
		this.initialized = true;
		this.fireHandler("onInit", arguments);
	}
	return this;
}

DSpeech.prototype.speak = function(msg, voice) {
	if (this.speechSynthesis) {
		var utterance = new SpeechSynthesisUtterance(msg);
		dLib.assert(utterance instanceof SpeechSynthesisUtterance, 'SpeechSynthesisUtterance is not supported!');
		Object.extend(utterance, this.config.utterance);
		var voices = this.speechSynthesis.getVoices();
		out(voices.length)
		var voice = null;
		// Chrome separates language and country with an underscore while others uses a hyphen
		for (var i = 0, l = voices.length; i < l; i++) {
			var v = voices[i];
			var lang = v.lang.replace('-', '_');
			if (lang == 'en_US') {
				voice = v;
				break;
			}
		}
		if (voice) {
			var f = function(e) {
				out(e.type);
			};
			out('voice: ' + voice.lang);
			['start', 'end', 'error'].forEach(function(s) {
				if (utterance.addEventListener) {
					utterance.addEventListener(s, f);
				} else {
					utterance['on' + s] = f;
				}
			});
			if (!utterance.text) {
				utterance.text = msg;
			}
			utterance.voice = voice;
			utterance.voiceURI = 'native';
			//utterance.lang = voice.lang;
			inspect(utterance);
			//inspect(this.speechSynthesis);
			this.speechSynthesis.speak(utterance);
		}
		//debug(utterance);
		//var thisObj = this;
		//['error', 'start', 'end'].forEach(function(s) {
		//	utterance['on' + s] = this['on' + s.capitalize()].bind(thisObj);
		//});
	} else {
		out('no speaking');
	}
	return this;
}

DSpeech.prototype.start = function() {
	if (!this.initialized) {
		this.init();
	}
	if (this.fireHandler("onBeforeStart", arguments)) {
		if (this.speechRecognition) {
			this.speechRecognition.start();
		}
	}
	this.fireHandler("onAfterStart", arguments);
	return this;
}

DSpeech.prototype.stop = function() {
	if (!this.initialized) {
		this.init();
	}
	if (this.fireHandler("onBeforeStop", arguments)) {
		if (this.speechRecognition) {
			this.speechRecognition.stop();
			// reset internal variables
			this.recognizing = false;
			this.ignoreEnd = false;
			this.startTime = NaN;
		}
	}
	this.fireHandler("onAfterStop", arguments);
	return this;

}

DSpeech.prototype.onStart = function(e) {
	Log.d('on start: ' + e)
	this.recognizing = true;
	this.startTime = e.timeStamp;
}

DSpeech.prototype.onError = function(e) {
	switch (e.error) {
		case 'no-speech':
			this.ignoreEnd = true;
			break;
		case 'audio-capture': // no microphone
			this.ignoreEnd = true;
			break;
		case 'not-allowed':
			if (e.timeStamp - this.startTime < 100) {
				// blocked
			} else {
				// denied
			}
			this.ignoreEnd = true;
			break;
		default:
			break;
	}
	Log.d('error: '+e.error);
}

DSpeech.prototype.onEnd = function(e) {
	Log.d('on end: '+e);
	this.recognizing = false;
	if (this.ignoreEnd) {
		return;
	}

}

DSpeech.prototype.onResult = function(e) {
	Log.d('on result: '+ e)
	if (typeof e.results == 'undefined') {
		Log.d('no results');
		this.speechRecognition.stop();
		return;
	}
	for (var i = e.resultIndex; i < e.results.length; i++) {
		var result = e.results[i];
		if (result.isFinal) {
			Log.d('final result: ' + result[0].transcript);
		} else {
			Log.d('interim result: ' + result[0].transcript);
		}
	}
};

domReady(function() {
	var ss = window.speechSynthesis;
    if (!ss) {
	    out('Speech API not supported!');
	    return;
    }
    if (ss.getVoices().length) {
	    out('Found ' + ss.getVoices().length + ' voices');
	    return;
    }
    if ('onvoiceschanged' in ss) {
	    var f = function(e) {
			out('Found ' + ss.getVoices().length + ' voices');
	    };
		if (ss.addEventListener) {
			ss.addEventListener('voiceschanged', f);
		} else {
			ss.onvoiceschanged = f;
		}
	    out('added voice change listener')
    } else {
	    out('Hmmm');
    }
});


//var dSpeech = new DSpeech().start();
//setTimeout(function() {
//	dSpeech.destroy();
//}, 10000);
//
//var create_email = false;
//var final_transcript = '';
//var ignore_onend;
//var start_timestamp;
//if (!('webkitSpeechRecognition' in window)) {
//  upgrade();
//} else {
//  start_button.style.display = 'inline-block';
//  var recognition = new webkitSpeechRecognition();
//  recognition.continuous = true;
//  recognition.interimResults = true;
//
//  recognition.onstart = function() {
//    recognizing = true;
//    showInfo('info_speak_now');
//    start_img.src = '/intl/en/chrome/assets/common/images/content/mic-animate.gif';
//  };
//
//  recognition.onerror = function(event) {
//    if (event.error == 'no-speech') {
//      start_img.src = '/intl/en/chrome/assets/common/images/content/mic.gif';
//      showInfo('info_no_speech');
//      ignore_onend = true;
//    }
//    if (event.error == 'audio-capture') {
//      start_img.src = '/intl/en/chrome/assets/common/images/content/mic.gif';
//      showInfo('info_no_microphone');
//      ignore_onend = true;
//    }
//    if (event.error == 'not-allowed') {
//      if (event.timeStamp - start_timestamp < 100) {
//        showInfo('info_blocked');
//      } else {
//        showInfo('info_denied');
//      }
//      ignore_onend = true;
//    }
//  };
//
//  recognition.onend = function() {
//    recognizing = false;
//    if (ignore_onend) {
//      return;
//    }
//    start_img.src = '/intl/en/chrome/assets/common/images/content/mic.gif';
//    if (!final_transcript) {
//      showInfo('info_start');
//      return;
//    }
//    showInfo('');
//    if (window.getSelection) {
//      window.getSelection().removeAllRanges();
//      var range = document.createRange();
//      range.selectNode(document.getElementById('final_span'));
//      window.getSelection().addRange(range);
//    }
//    if (create_email) {
//      create_email = false;
//      createEmail();
//    }
//  };
//
//  recognition.onresult = function(event) {
//    var interim_transcript = '';
//    if (typeof(event.results) == 'undefined') {
//      recognition.onend = null;
//      recognition.stop();
//      upgrade();
//      return;
//    }
//    for (var i = event.resultIndex; i < event.results.length; ++i) {
//      if (event.results[i].isFinal) {
//        final_transcript += event.results[i][0].transcript;
//      } else {
//        interim_transcript += event.results[i][0].transcript;
//      }
//    }
//    final_transcript = capitalize(final_transcript);
//    final_span.innerHTML = linebreak(final_transcript);
//    interim_span.innerHTML = linebreak(interim_transcript);
//    if (final_transcript || interim_transcript) {
//      showButtons('inline-block');
//    }
//  };
//}
//
//function upgrade() {
//  start_button.style.visibility = 'hidden';
//  showInfo('info_upgrade');
//}
//
//var two_line = /\n\n/g;
//var one_line = /\n/g;
//function linebreak(s) {
//  return s.replace(two_line, '<p></p>').replace(one_line, '<br>');
//}
//
//var first_char = /\S/;
//function capitalize(s) {
//  return s.replace(first_char, function(m) { return m.toUpperCase(); });
//}
//
//function createEmail() {
//  var n = final_transcript.indexOf('\n');
//  if (n < 0 || n >= 80) {
//    n = 40 + final_transcript.substring(40).indexOf(' ');
//  }
//  var subject = encodeURI(final_transcript.substring(0, n));
//  var body = encodeURI(final_transcript.substring(n + 1));
//  window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
//}
//
//function copyButton() {
//  if (recognizing) {
//    recognizing = false;
//    recognition.stop();
//  }
//  copy_button.style.display = 'none';
//  copy_info.style.display = 'inline-block';
//  showInfo('');
//}
//
//function emailButton() {
//  if (recognizing) {
//    create_email = true;
//    recognizing = false;
//    recognition.stop();
//  } else {
//    createEmail();
//  }
//  email_button.style.display = 'none';
//  email_info.style.display = 'inline-block';
//  showInfo('');
//}
//
//function startButton(event) {
//  if (recognizing) {
//    recognition.stop();
//    return;
//  }
//  final_transcript = '';
//  recognition.lang = select_dialect.value;
//  recognition.start();
//  ignore_onend = false;
//  final_span.innerHTML = '';
//  interim_span.innerHTML = '';
//  start_img.src = '/intl/en/chrome/assets/common/images/content/mic-slash.gif';
//  showInfo('info_allow');
//  showButtons('none');
//  start_timestamp = event.timeStamp;
//}
//
//function showInfo(s) {
//  if (s) {
//    for (var child = info.firstChild; child; child = child.nextSibling) {
//      if (child.style) {
//        child.style.display = child.id == s ? 'inline' : 'none';
//      }
//    }
//    info.style.visibility = 'visible';
//  } else {
//    info.style.visibility = 'hidden';
//  }
//}
//
//var current_style;
//function showButtons(style) {
//  if (style == current_style) {
//    return;
//  }
//  current_style = style;
//  copy_button.style.display = style;
//  email_button.style.display = style;
//  copy_info.style.display = 'none';
//  email_info.style.display = 'none';
//}
