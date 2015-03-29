if (typeof dLib == "undefined") {
	throw new Error('DFileUpload.js: You must load the file DLib.js!');
};
var dFileUpload = {
    submitListenerAdded: false,
    expr: '', // is changed in onReady
    notRequiredClass: 'not-required',
    decoratorClass: 'decorator',
    decoratorRequiredClass: 'required',
	fileClass: 'file',
	focusClass: 'file-focus',
	fileButtonText: '&hellip;',
	thumbnailContainer: null,
	resolveThumbnailHeight: function(fullWidth, fullHeight) {
		return NaN;
	},
	onImageError: function() {},
	createFileReaderListener: function(img) {
		return function(e) {
			img.src = e.target.result;
		}
	},
	createImageListener: function() {
		return function(e) {
            this.removeAttribute('width');
            var ratio = this.height / this.width;
            var h = dFileUpload.resolveThumbnailHeight(this.width, this.height) || 75;
            var w = Math.round(h / ratio);
			var title = this.width + 'x' + this.height + ', ' + this.alt;
			this.setAttribute('height', '' + h); // do not set width/height until we've read the original width/height of the picture
			this.parentNode.setAttribute('title', title);
			this.parentNode.style.display = 'inline-block';
			this.parentNode.style.width = w + 'px';
			this.parentNode.style.height = h + 'px';
			this.parentNode.style.overflow = 'hidden';
            var styles = document.getElementsByTagName('style');
            var style;
            if (styles.length) {
                style = styles[0];
            } else {
                style = document.createElement('style');
                style.setAttribute('type', 'text/css');
                document.getElementsByTagName('head')[0].appendChild(style);
            }
            if (this.parentNode.className && style && style.sheet && style.sheet.insertRule) {
                var bw = 5;
				var mw = this.parentNode.parentNode ? this.parentNode.parentNode.offsetWidth - 2 * bw : 0;
				mw = mw ? '; max-width: ' + mw + 'px' : '';
                var rule = '.' + this.parentNode.className + ':after { width: ' + (w - 2 * bw)  + 'px' + mw + '; height: ' + (h - 2 * bw) + 'px; border-width: ' + bw + 'px; }';
                style.sheet.insertRule(rule, style.sheet.cssRules.length); // important to insert last to override previously added rules
            }
		}
	},
    readImageAsBlob: function(img, file) {
        var imgUrl = getBlobURL(file);
        img.src = imgUrl;
        revokeBlobURL(imgUrl);
    },
    readImageAsFile: function(img, file) {
        var fileReader = new FileReader();
        fileReader.onload = dFileUpload.createFileReaderListener(img);
        fileReader.readAsDataURL(file);
    },
	onFileChange: function(e) {
		if (this.value) {
			var filenames = '';
			if (this.files) { // not supported by IE9
				var containsImage = false;
				var accept = this.getAttribute('accept');
				if (accept && accept.indexOf('image/') > -1) {
					containsImage = true;
				}
				for (var i = 0, l = this.files.length; i < l; i++) {
					var file = this.files[i];
                    if (containsImage) {
                        if (!file.size) {
                            dFileUpload.onImageError.apply(this, [file]);
                        }
						if (!dFileUpload.thumbnailContainer) {
							var div = dFileUpload.thumbnailContainer = DElement.create('div', {
								'class': 'thumbnail-container',
								style: 'position:relative'
							});
							this.parentNode.parentNode.appendChild(div);
						}
						else if (i == 0) {
							var firstChild;
							while ((firstChild = dFileUpload.thumbnailContainer.firstChild) != null) {
								firstChild.parentNode.removeChild(firstChild);
							}
						}
                        var img = DElement.create('img', {
	                        'class': 'thumbnail',
                            width: '0',
                            alt: file.name + ' (' + file.size.format() + ' bytes)'
                        });
						img.onload = dFileUpload.createImageListener();
						var wrapper = DElement.create('div', {
							'class': 'thumbnail-wrapper',
							style: 'display: none'
						});
	                    dFileUpload.thumbnailContainer.appendChild(wrapper);
						wrapper.appendChild(img);
                        try {
                            // a possible error occurring when setting the src property, won't be caught by the catch clause
                            img.onerror = function() {
                                dFileUpload.readImageAsFile(this, file);
                            }
                            dFileUpload.readImageAsBlob(img, file);
                        }
                        catch (error) {
	                        try {
                                // a possible error occurring when setting the src property, won't be caught by the catch clause
                                img.onerror = function(fileItem) {
                                    dFileUpload.onImageError.apply(this, fileItem);
                                }.bind(this, file);
                                dFileUpload.readImageAsFile(img, file);
	                        }
	                        catch (err) {
								dFileUpload.onImageError.apply(this, [file]);
	                        }
                        }
					}
					if (i > 0) {
						filenames += ', ';
					}
					filenames += file.name;
				}
			} else {
				var arr = this.value.split(/\/|\\/);
				filenames = arr[arr.length - 1];
			}
			g(this).parentElement().nextElement().html(filenames);
		}
	},
    submitListener: function(e) {
        q(dFileUpload.expr, this).forEach(function(ipt) {
            if (!ipt.value && !ipt.required) {
                ipt.disabled = true;
            }
        });
    },
	forEachFileInput: function(ipt) {
        if (!dFileUpload.submitListenerAdded) {
            g(ipt.form).on('submit', dFileUpload.submitListener);
            dFileUpload.submitListenerAdded = true;
        }
		var dFile = g(ipt).addClass('file-upload');
//        // remove required class from file input and wrapping decorator (edit view in CRUD)
//        if (dFile.hasClass(dFileUpload.notRequiredClass)) {
//            dFile.attr('required', false);
//            if (dFileUpload.decoratorClass && dFileUpload.decoratorRequiredClass) {
//                for (var n = ipt.parentNode; n != null; n = n.parentNode) {
//                    if (n === ipt.form) {
//                        break;
//                    }
//                    if (DElement.hasClass(n, dFileUpload.decoratorClass)) {
//                        DElement.removeClass(n, dFileUpload.decoratorRequiredClass);
//                        break;
//                    }
//                }
//            }
//        }
		DElement.addClass(dFile.element.parentNode, 'file-wrapper');
		var btn = DElement.create('div', {'class': 'file-button'});
		dFile.insertBefore(btn);
		dFile.insertAfter(DElement.create('div', {'class': 'filename'}));
		// now pull the file element out of the DOM tree and insert as a child of our DIV element
		btn.appendChild(dFile.element);
        var span = DElement.create('span');
		span.innerHTML = dFileUpload.fileButtonText || '&hellip;'; // createTextNode does not allow HTML entities
        btn.appendChild(span);
		dFileUpload.onFileChange.apply(dFile.element, []);
		dFile.on('change', dFileUpload.onFileChange).on('focus', function() {
			DElement.addClass(this.parentNode, dFileUpload.focusClass);
		}).on('blur', function() {
			DElement.removeClass(this.parentNode, dFileUpload.focusClass);
		});
	},
	onReady: function() {
		var expr = dFileUpload.expr = dFileUpload.fileClass ? 'input.' + dFileUpload.fileClass : 'input[type="file"]';
		q(expr).forEach(dFileUpload.forEachFileInput);
		return;
		var dropTarget = document; // TODO: Finish - see page 696 in JS: TDG 6
		g(dropTarget).on('dragenter', function(e) {
//			if (e.target.tagName == 'BODY') {
				//e.preventDefault().stopPropagation();
				out(e.type + ': ' + e.target.tagName);
//			}
		}).on('dragleave', function(e) {
//			if (e.target.tagName == 'BODY') {
				//e.preventDefault().stopPropagation();
				out(e.type + ': ' + e.target.tagName);
//			}
		}).on('dragover', function(e) {
			out(e.type + ': ' + e.target.tagName);
			return false; // tell browser to keep sending notifications
		});
	}
};
domReady(dFileUpload.onReady);