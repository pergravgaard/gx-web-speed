/* TODO:
 * - add support for animations when expanding/collapsing nodes
 * - keyboard navigation
 * - nextSibling/prevSibling
 * - partial checked visualization (if a node has some (but not all) children checked)
 * - How to select if useLabel is true: bubble and cascade must be possible! Maybe select by holding SHIFT down? Or does it intervene with native mouse listeners?
 */
if (typeof dLib == "undefined") {
	throw new Error('DTree.js: You must load the file DLib.js in order to create a tree!');
}

function DTree(dElement, config) {
	this.dElement = dElement;
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.cookie = null;
	this.index = 0;
	this.nodes = []; // will only contain root nodes
	this.ajaxEnabled = this.config.hasOwnProperty('ajax');
	this.useCheckboxes = this.config.hasOwnProperty('checkbox');
	this.initialized = false;
}

DTree.instances = {};
DTree.counter = 0;
DTree.keyPrefix = 'dTree';

DTree.defaultConfig = {
	expandNodes: false, // should the tree be expanded when initialized?
	parseNodesFromMarkup: true,
	singleNodeSelection: false, // if true only a single node can be selected at a time
	saveStateInCookie: false, // saves each nodes expanded property and restores this 'state' when tree is initialized (page reloaded) - only applies if ajax is null and does not apply to nodes added after initialization of the tree
	className: 'dtree',
	expandedClass: 'expanded',
	collapsedClass: 'collapsed',
	leafClass: 'leaf',
	branchClass: 'branch',
	rootClass: 'root',
	selectedClass: 'selected',
	hiliteClass: 'hilite',
	discardedClass: '',
	loadingClass: 'loading',
	dummyLabel: 'No root nodes found',
	ajax: { // NOTE: the tree won't be Ajax enabled unless you specify an object literal in your config object! Also see HttpRequest.defaultConfig in DAjax.js
		loadOnInit: true,
		loadOnlyOnce: true // should an Ajax request be sent when expanding a node for the second time (no matter if children was found the first time)? Default is false (no).
	},
	checkbox: { // NOTE: checkboxes won't be used unless you specify an object literal in your config object. If you don't need to override any properties, just specify an empty object literal.
		name: '', // If a non-empty string, each checkbox will be given a name attribute with this value
		value: '', // can be a function which is passed the DTreeNode instance
		useLabel: false, // Don't specify true if the only clickable text is a link as this won't check/uncheck the checkbox anyway (native HTML behavior).
		bubble: true,
		cascade: true
	},
	keystrokeDelay: 500, // delay in milliseconds from keystroke to filter execution
	minChars: 2,
	scope: null, // shared scope/context for all custom event listeners - defaults to the DTree instance
	// tree events - will be executed in the scope/context of the DTree instance and are passed the DTree instance as the last argument
	onInit: null,
	onBeforeParse: null,
	onAfterParse: null,
	onBeforeFilter: null, // will be passed the filter term as argument
	onAfterFilter: null, // will be passed the filter term and filtered results array as arguments
	// node events - will be executed in scope/context of the DTree instance though, but are passed the DTreeNode instance and the DTree instance as arguments
	onBeforeClick: null, // will only be executed if checkbox.useLabel is false
	onAfterClick: null, // will only be executed if checkbox.useLabel is false
	onBeforeDblClick: null, // will only be executed if checkbox.useLabel is false
	onAfterDblClick: null, // will only be executed if checkbox.useLabel is false
	onBeforeCheck: null,
	onAfterCheck: null,
	onBeforeSelect: null,
	onAfterSelect: null,
	onBeforeRender: null,
	onAfterRender: null,
	onBeforeHilite: null,
	onAfterHilite: null,
	onBeforeUnHilite: null,
	onAfterUnHilite: null,
	onBeforeToggle: null,
	onAfterToggle: null
}

DTree.newInstance = function(el, config) {
    var instance = new DTree(el, config);
    instance.key = (DTree.keyPrefix || 'dTree') + DTree.counter++;
    DTree.instances[instance.key] = instance;
    return instance;
}

DTree.initAll = function() {
    for (var k in DTree.instances) {
        DTree.instances[k].init();
    }
}

DTree.saveTrees = function() {
    for (var k in DTree.instances) {
        DTree.instances[k].saveCookie();
    }
}

//DTree.getTreeById = function(id) {
//	var tree = null;
//	DTree.instances.every(function(dTree) {
//		if (id == dTree.dElement.getId()) {
//			tree = dTree;
//			return false; // break loop
//		}
//		return true;
//	});
//	return tree;
//}

// breadth-first traversal
DTree.levelWalk = function(offsetNodes, callback) {
	var fifo = offsetNodes.clone();
	for (var n = fifo.shift(); n != null; n = fifo.shift()) {
		if (callback(n) === false) {
			break;
		}
		fifo.addAll(n.children);
	}
}

DTree.prototype.toString = function() {
	return "[object " + this.constructor.getName() + "] " + ((this.dElement && this.dElement.element) ? this.dElement.element.id : this.dElement);
}

DTree.prototype.fireHandler = dLib.util.fireHandler;

DTree.prototype.levelWalk = function(callback) {
	DTree.levelWalk(this.nodes, callback);
	return this;
}

DTree.prototype.doLoadChildren = function() {
	return this.ajaxEnabled;
}

DTree.prototype.useLabel = function() {
	return this.useCheckboxes && this.config.checkbox.useLabel;
}

DTree.prototype.createAjaxRequest = function(pNode) {
	var url = (typeof this.config.ajax['url'] == 'function') ? this.config.ajax['url'].apply(this, [pNode]) : this.config.ajax['url'];
	var cfg = Object.extend({ url: url }, this.config.ajax, false);
	var hr = new HttpRequest(cfg);
	hr.config.onCompleteOk = this.onCompleteOk.bindAsEventListener(this, hr, pNode);
	hr.open().send();
	return this;
}

DTree.prototype.onCompleteOk = function(e, hr, pNode) {
	var json = hr.json;
	if (Array.isArray(json)) {
		var cfg = this.config;
		if (json.length) {
			if (pNode) {
				pNode.swapStateClasses(cfg.loadingClass, cfg.expandedClass).clear().addNodes(json);
			} else {
				this.addNodes(json);
			}
		}
		else if (pNode) {
			if (cfg.ajax.loadOnlyOnce) {
				// if createAjaxRequest is called programmatically the 'Loading' class won't be present, but 'Collapsed' will
				pNode.swapStateClasses(cfg.loadingClass, cfg.leafClass).swapStateClasses(cfg.collapsedClass, cfg.leafClass);
				dLib.event.remove(pNode.getIconElement(), 'click', pNode.iconToggleListener);
			} else {
				pNode.swapStateClasses(cfg.loadingClass, cfg.collapsedClass).expanded = false;
			}
		}
	}
	this.fireHandler("onCompleteOk", [e, pNode, this.hr], this.config.ajax);
	return this;
}

DTree.prototype.collapseAll = function(offsetNodes) {
	(offsetNodes || this.nodes).forEach(function(dNode) {
		dNode.collapse(true);
	});
	return this;
}

DTree.prototype.expandAll = function(offsetNodes) {
	(offsetNodes || this.nodes).forEach(function(dNode) {
		dNode.expand(true);
	});
	return this;
}

DTree.prototype.filterOnKeystroke = function(e) {
	e = (e instanceof DEvent) ? e : g(e);
	if (!isNaN(this.keystrokeTimerId)) {
		clearTimeout(this.keystrokeTimerId);
	}
	var v = e.target.value.trim();
	if (v && v.length >= (this.config.minChars || 1)) { // there must be at least one character
		this.keystrokeTimerId = setTimeout(function(value, target) {
			this.fireFilter(value, target);
		}.bind(this, v, e.target), this.config.keystrokeDelay);
	} else {
		this.resetFilter();
	}
	return true;
}

DTree.prototype.saveCookie = function() {
	if (this.cookie) {
		this.saveState().cookie.save();
	}
	return this;
}

DTree.prototype.saveState = function(nodes) {
	(nodes || this.nodes).forEach(function(node) {
		this.cookie.setParameter(node.id, node.expanded);
		if (node.children) {
			this.saveState(node.children);
		}
	}.bind(this));
	return this;
}

DTree.prototype.readCookie = function() {
	return this.readState();
}

DTree.prototype.readState = function(nodes) {
	(nodes || this.nodes).forEach(function(node) {
		var param = this.cookie.getParameter(node.id);
		if (param) {
			node.expanded = (param == "true");
		}
		if (node.children) {
			this.readState(node.children);
		}
	}.bind(this));
	return this;
}

DTree.prototype.createDummyRootNode = function() {
	return this.config.dummyLabel ? { label: this.config.dummyLabel } : null;
}

DTree.prototype.init = function() {
	dLib.assert(dLib.event.isDOMReady, "DTree.js: The DOM must be ready to initialize a tree!");
	dLib.assert(!this.initialized, "DTree.js: The tree is already initialized!");
	var cfg = this.config;
	this.dElement = g(this.dElement).addClass(cfg.className);
	if (cfg.parseNodesFromMarkup) {
		this.parseNodes();
	}
	if (this.ajaxEnabled) {
		dLib.assertType(window.HttpRequest, "function", 'DTree.js: You must load the file DAjax.js to ajax-enable the tree!');
		if (this.config.ajax.loadOnInit) {
			this.createAjaxRequest();
		}
	} else {
		if (this.nodes.length == 0) {
			var dummyNode = this.createDummyRootNode();
			if (dummyNode) {
				this.dummyNode = this.addNode(dummyNode);
			}
		}
		if (cfg.saveStateInCookie) {
			dLib.assertType(window.DCookie, "function", 'DTree.js: You must load the file DCookie.js to save the state of the tree!');
			this.cookie = new DCookie(this.dElement.getId() + '_state', {expiryDate: new Date().addYear()});
			if (this.cookie.getValue()) {
				this.readCookie();
			}
		}
	}
	this.dElement.html('');
	if (!this.ajaxEnabled || cfg.parseNodesFromMarkup) {
		this.levelWalk(function(n) { n.render(); });
	}
	this.initialized = true;
	this.fireHandler("onInit", [this]);
	return this;
}

DTree.prototype.clear = function() {
	this.nodes.length = 0;
	this.dElement.html('');
	return this;
}

DTree.prototype.resetFilter = function() {
	this.collapseAll();
	var discardedCls = this.config.discardedClass;
	if (discardedCls) {
		this.levelWalk(function(n) {
			DElement.removeClass(n.element, discardedCls);
			n.resetText().fireUnhilite();
		});
	}
	if (this.filteredResults) {
		if (!discardedCls) {
			this.filteredResults.forEach(function(n) { n.resetText().fireUnhilite(); });
		}
		this.filteredResults = null;
	}
	return this;
}

DTree.prototype.showFilterProgress = function() {
	document.body.style.cursor = 'progress';
	return this;
}

DTree.prototype.hideFilterProgress = function() {
	document.body.style.cursor = 'default';
	return this;
}

DTree.prototype.fireFilter = function(value, target) {
	if (this.fireHandler("onBeforeFilter", arguments)) {
		this.resetFilter();
		if (value) {
			this.showFilterProgress().filter(value).hideFilterProgress();
		}
	}
	this.fireHandler("onAfterFilter", [value, target, this.filteredResults]);
	return this;
}

DTree.prototype.filter = function(regExp, res) {
	var results = this.filteredResults = [];
	if (typeof regExp == "string") {
		// the following characters must be escaped \^$.+-?*|()[]{}
		var s = regExp.replace(/([\\\^\$\.\+\(\)\[\]\?\*\-\|\{\}])/g, '\\$1');
		regExp = new RegExp(s, "gim");
	}
	var discardedCls = this.config.discardedClass;
	DTree.levelWalk(this.nodes, function(n) {
		var found = DElement.text(n.getLabelElement()).match(regExp);
		if (found) {
			found = found.unique();
			n.decorateText(found).fireHilite();
			results.push(n);
		}
		else if (discardedCls) {
			DElement.addClass(n.element, discardedCls);
		}
	});
	if (Array.isArray(res)) {
		res.addAll(results);
	}
	return this;
}

DTree.prototype.findNodes = function(comparator) {
	var nodes = [], thisNode = this;
	DTree.levelWalk(this.nodes, function(n) {
		if (comparator.apply(thisNode, [n])) {
			nodes.push(n);
		}
	});
	return nodes;
}

DTree.prototype.findNode = function(comparator) {
	var node = null, thisNode = this;
	DTree.levelWalk(this.nodes, function(n) {
		if (!!comparator.apply(thisNode, [n])) {
			node = n;
			return false;
		}
		return true;
	});
	return node;
}

DTree.prototype.getSelectedNodes = function() {
	return this.findNodes(function(n) { return n.selected; });
}

DTree.prototype.getCheckedNodes = function() {
	return this.findNodes(function(n) { return n.checked; });
}

DTree.prototype.getFilteredNodes = function() {
	return this.filteredResults || [];
}

// This is not as simple as just deleting/removing every selected nodes, since when removing a node it's children is automatically removed as well
DTree.prototype.removeSelectedNodes = function(propName) {
	propName = propName || 'selected'; // could be the 'checked' property as well
	var fifo = this.nodes.clone();
	for (var n = fifo.shift(); n != null; n = fifo.shift()) {
		if (n[propName]) {
			n.remove();
		} else {
			fifo.addAll(n.children);
		}
	}
	return this;
}

DTree.prototype.parseNodes = function() {
	var el = this.dElement.element;
	if (el.children.length) {
		if (!['UL', 'OL', 'DL'].contains(el.tagName.toUpperCase())) {
			var dEl = this.dElement.firstElement();
			if (dEl) {
				el = dEl.element;
			}
		}
		this.parseList(el);
	}
	return this;
}

/*
The el argument will be a list-item (LI, DD or DT tag).
Find possible link among firstChild's siblings only (don't go deeper).
*/
DTree.prototype.parseListItem = function(el, parentNode) {
	if (this.fireHandler("onBeforeParse", [el, parentNode])) {
		var fChild = el.firstChild;
		if (fChild) {
			var o;
			switch (fChild.nodeType) {
				case Node.TEXT_NODE:
					o = { label: fChild.nodeValue.trim() };
					break;
				case Node.ELEMENT_NODE:
					if (fChild.getAttribute("href")) {
						o = { label: DElement.text(fChild), href: fChild.getAttribute("href"), target: fChild.getAttribute("target") || "" };
					}				
					break;
			}
			if (o) {
				o.title = el.getAttribute("title") || "";
				if (DElement.hasClass(el, this.config.expandedClass)) {
					o.expanded = true;
				}
				var pNode = (parentNode || this).addNode(o);
				this.parseList(fChild.nextSibling, pNode);
			}
		}
	}
	this.fireHandler("onAfterParse", [el, parentNode]);
	return this;
}

DTree.prototype.parseList = function(el, parentNode) {
	if (el && el.nodeType == Node.ELEMENT_NODE) {
		switch (el.tagName.toUpperCase()) {
			case "UL":
			case "OL":
			case "DL":
				for (var n = el.firstChild; n != null; n = n.nextSibling) {
					if (n.nodeType == Node.ELEMENT_NODE) {
						switch (n.nodeName.toUpperCase()) {
							case "LI":
							case "DT":
							case "DD":
								this.parseListItem(n, parentNode);
								break;
						}
					}
				}
				break;
		}
	}
	return this;
}

DTree.prototype.removeNode = function(node) {
	node.remove();
	return this;
}

// a root node must be added with this method - either as a describing object literal or a DTreeNode instance
DTree.prototype.addNode = function(node, index) {
	if (typeof node == "object" && node) {
		if (this.dummyNode && this.nodes.length) {
			var dummy = this.nodes[0];
			dummy.remove();
			delete this.dummyNode;
		}
		var children;
		if (!(node instanceof DTreeNode)) {
			var cfg = typeof this.config.mapNode == 'function' ? this.config.mapNode.call(this.config.scope || this, node, this) : Object.clone(node);
			if (Array.isArray(cfg.children)) {
				children = cfg.children;
				delete cfg.children;
			}
			node = new DTreeNode(cfg);
		}
		if (index > -1 && index < this.nodes.length) {
			node.index = index;
			this.nodes.splice(node.index, 0, node);
			for (var i = index + 1; i < this.nodes.length; i++) {
				this.nodes[i].updateIndexAndId(i);
			}
		} else {
			node.index = this.nodes.length;
			this.nodes.push(node);
		}
		node.attach(null, this); // important to attach before adding possible children from object literal
		if (children) {
			children.forEach(function(child) {
				node.addNode(child);
			});
		}
		if (this.initialized) {
			DTree.levelWalk([node], function(n) { n.render(); });
		}
		return node;
	}
	return null;
}

// add several root nodes at a time - delegates to addNode
DTree.prototype.addNodes = function(nodes) {
	for (var i = 0, l = nodes.length; i < l; i++) {
		this.addNode(nodes[i]);
	}
	return this;
}

DTree.prototype.getRootBranchElement = function() {
	return this.dElement.element.firstChild;
}

function DTreeNode(config) {
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.depth = -1;
	this.tree = null;
	this.element = null;
	this.children = null;
	this.index = -1;
	this.id = "";
	// state variables
	this.expanded = false;
	this.selected = false;
	this.checked = false;
	this.hilited = false;
	this.rendered = false;
}

DTreeNode.defaultConfig = {
	label: "N/A",
	title: "",
	href: "",
	target: "",
	expanded: null // should the node be expanded when loaded - a value of null indicates that the configuration of the tree decides
}

DTreeNode.prototype.fireHandler = dLib.util.fireHandler;

DTreeNode.prototype.toString = function() {
	return "[object " + this.constructor.getName() + "] " + this.config.label + " (" + this.id + ")";
}

// will be executed before the init method
DTreeNode.prototype.attach = function(parentNode, tree) {
	this.parentNode = parentNode || null;
	this.tree = tree || parentNode.tree;
	this.depth = this.parentNode ? this.parentNode.depth + 1 : 0;
	var id = this.parentNode ? this.parentNode.id : (typeof this.tree.dElement == "string" ? this.tree.dElement : this.tree.dElement.getId());
	this.id = id + "_" + this.index;
	if (this.tree.useCheckboxes) {
		var useLabel = this.useLabel();
		var checked = !!(!useLabel && this.tree.initialized && this.parentNode && this.parentNode.checked);
		if (!checked) {
			var cfg = this.config;
			if ("checked" in cfg) {
				checked = !!cfg.checked;
			}
			else if (("selected" in cfg) && useLabel) {
				checked = !!cfg.selected;
			}
		}
		this.setChecked(checked);
	}
	this.expanded = (typeof this.config.expanded == "boolean") ? this.config.expanded : this.tree.config.expandNodes && !this.tree.ajaxEnabled;
	if (this.expanded) {
		for (var n = this.parentNode; n != null; n = n.parentNode) {
			n.expanded = true;
		}
	}
	return this;
}

DTreeNode.prototype.updateIndexAndId = function(index) {
	this.index = index;
	var id = this.parentNode ? this.parentNode.id : (typeof this.tree.dElement == "string" ? this.tree.dElement : this.tree.dElement.getId());
	this.id = id + "_" + this.index;
	this.element.id = this.id;
	if (this.children) {
		for (var i = 0, l = this.children.length; i < l; i++) {
			this.children[i].updateIndexAndId(i);
		}
	}
}

/*	Before the node itself is removed possible children are removed.
	Removes the node from either root nodes array (tree.nodes) or parentNode's children array.
	If rendered it is removed from the HTML structure (DOM).	*/
DTreeNode.prototype.remove = function() {
	if (!this.isLeafNode()) {
		// remove children first, but do it backwards as the list is manipulated while iterated
		for (var i = this.children.length - 1; i >= 0; i--) {
			this.children[i].remove();
		}
	}
	var list = this.parentNode ? this.parentNode.children : this.tree.nodes;
	var index = list.indexOf(this);
	dLib.assert(index > -1, 'DTree.js: The node to be removed was not found!');
	list.splice(index, 1);
	if (this.rendered) {
		if (list.length == 0) {
			var branch = this.isRootNode() ? this.getRootBranchElement() : this.element.parentNode;
			branch.parentNode.removeChild(branch);
			if (!this.isRootNode()) { // update rendering of possible parent and remove event Listeners
				var cfg = this.tree.config;
				DElement.replaceClass(this.parentNode.getIconElement(), cfg.expandedClass, cfg.leafClass);
				this.parentNode.children = null;
				// safe to remove all as these elements are removed from DOM
				dLib.event.removeAll(this.getLabelElement());
				dLib.event.removeAll(this.getCheckboxElement());
				// only remove the one we added ourselves as the icon element is NOT removed from DOM
				dLib.event.remove(this.parentNode.getIconElement(), 'click', this.parentNode.iconToggleListener);
			}
		}
		this.element.parentNode.removeChild(this.element);
	}
	for (var n = index, l = list.length; n < l; n++) {
		list[n].updateIndexAndId(n);
	}
	return this;
}

DTreeNode.prototype.clear = function() {
	if (this.children) {
		this.children.length = 0;
		DNode.remove(this.getBranchElement());
	}
	return this;
}

// non-root nodes must be added with this method - or via a children property in object literal for parent node
DTreeNode.prototype.addNode = function(node, index) { // node is a describing object literal or a DTreeNode instance
	if (typeof node == "object" && node) {
		var children;
		if (!(node instanceof DTreeNode)) {
			var cfg = Object.clone(node);
			if (Array.isArray(cfg.children)) {
				children = cfg.children;
				delete cfg.children;
			}
			node = new DTreeNode(cfg);
		}
		this.children = this.children || [];
		if (index > -1 && index < this.children.length) {
			node.index = index;
			this.children.splice(node.index, 0, node);
			for (var i = index + 1; i < this.children.length; i++) {
				this.children[i].updateIndexAndId(i);
			}
		} else {
			node.index = this.children.length;
			this.children.push(node);
		}
		node.attach(this); // important to attach before adding possible children from object literal
		if (children) {
			children.forEach(function(child) {
				node.addNode(child);
			});
		}
		if (this.tree.initialized && this.rendered) { // this is the parentNode of node and must be rendered before any children can be rendered
			node.render();
		}
		return node;
	}
	return null;
}

DTreeNode.prototype.addNodes = DTree.prototype.addNodes;

DTreeNode.prototype.getRootBranchElement = function() {
	return this.tree.getRootBranchElement();
}

DTreeNode.prototype.getBranchElement = function() {
	return this.getElementByClass(this.tree.config.branchClass);
}

DTreeNode.prototype.getIconElement = function() {
	return this.getElementByClass(this.tree.config.className + '-icon');
}

DTreeNode.prototype.getLabelElement = function() {
	return this.getElementByClass(this.tree.config.className + '-node-label');
}

DTreeNode.prototype.getCheckboxElement = function() {
	return this.getLabelElement().firstChild;
}

DTreeNode.prototype.getElementByClass = function(cls, element) {
	for (var el = (element || this.element).firstChild; el != null; el = el.nextSibling) {
		if (DElement.hasClass(el, cls)) {
			return el;
		}
	}
	return null;
}

DTreeNode.prototype.fireHilite = function() {
	if (this.tree.fireHandler("onBeforeHilite", [this])) {
		this.hilite();
	}
	this.tree.fireHandler("onAfterHilite", [this]);
	return this;
}

DTreeNode.prototype.hilite = function() {
	this.hilited = true;
	DElement.addClass(this.element, this.tree.config.hiliteClass);
	this.expand().bubbleExpand();
	return this;
}

DTreeNode.prototype.fireUnhilite = function() {
	if (this.tree.fireHandler("onBeforeUnHilite", [this])) {
		this.unhilite();
	}
	this.tree.fireHandler("onAfterUnHilite", [this]);
	return this;
}

DTreeNode.prototype.unhilite = function() {
	this.hilited = false;
	DElement.removeClass(this.element, this.tree.config.hiliteClass);
	return this;
}

DTreeNode.prototype.decorateText = function(found) {
	var lbl = this.getLabelElement();
	if (this.config.href) {
		lbl = DElement.firstElement(lbl);
	}
	var cls = this.tree.config.className;
	function substitute(nodeList) {
		var s = '';
		if (nodeList && nodeList.length) {
			for (var i = 0, l = nodeList.length; i < l; i++) {
				var n = nodeList[i];
				switch (n.nodeType) {
					case Node.ELEMENT_NODE:
						var t = n.nodeName.toLowerCase();
						s += '<' + t;
						for (var j = 0, len = n.attributes.length; j < len; j++) {
							var attr = n.attributes[j];
							if (attr.name && attr.value && attr.value != "null" && attr.value.indexOf("function") != 0) { // this is necessary in IE
								s += ' ' + attr.name.toLowerCase() + '="' + attr.value + '"';
							}
						}
						s += '>' + arguments.callee(n.childNodes) + '</' + t + '>';
						break;
					case Node.TEXT_NODE:
						if (n.nodeValue) {
							var v = n.nodeValue;
							found.forEach(function(m) {
								v = v.replace(new RegExp(m, 'g'), '<span class="' + cls + '-hit">' + m + '</span>');
							});
							s += v;
						}
						break;
					case Node.ATTRIBUTE_NODE:
						// an attribute node is never a child node
					default:
						break;
				}
			}
		}
		return s;
	}
	lbl.innerHTML = substitute(lbl.childNodes);
	return this;
}

DTreeNode.prototype.resetText = function() {
	var n = this.getLabelElement();
	if (this.config.href) {
		n = DElement.firstElement(n);
	}
	n.innerHTML = this.config.label;
	return this;
}

DTreeNode.prototype.render = function() {
	dLib.assert(dLib.event.isDOMReady, "DTree.js: The DOM must be ready to render a node!");
	dLib.assert(!this.rendered, "DTree.js: The node is already rendered!");
	if (this.tree.fireHandler("onBeforeRender", [this])) {
		var cfg = this.config, tCfg = this.tree.config;
		var parentElement = this.parentNode ? this.parentNode.element : this.tree.dElement.element;
		if (this.index == 0) {
			var cls = this.parentNode ? tCfg.branchClass : tCfg.rootClass + ' ' + tCfg.branchClass;
			cls += ' ' + (!this.parentNode || this.parentNode.expanded ? tCfg.expandedClass : tCfg.collapsedClass);
			var dl = DElement.create("dl", {'class': cls});
			parentElement = parentElement.appendChild(dl);
		}
		else if (parentElement.tagName.toLowerCase() != 'dl') {
			parentElement = this.getElementByClass(tCfg.branchClass, parentElement);
		}
		var dd = this.element = DElement.create('dd', {id: this.id, 'class': tCfg.className + '-node', title: cfg.title});
		if (parentElement.childNodes && parentElement.childNodes.length == this.index) {
			parentElement = parentElement.appendChild(dd);
		} else {
			var beforeEl = DElement.firstElement(parentElement);
			if (this.index > 0) {
				beforeEl = DElement.nextElement(beforeEl, this.index);
			}
			parentElement.insertBefore(dd, beforeEl);
		}
		var icon = DElement.create('div', {'class': tCfg.className + '-icon'});
		dd.appendChild(icon);
		if (this.tree.ajaxEnabled || !this.isLeafNode()) {
			this.iconToggleListener = dLib.event.add(icon, 'click', this.onToggle.bindAsEventListener(this));
			DElement.addClass(icon, this.expanded ? tCfg.expandedClass : tCfg.collapsedClass);
			if (!this.canHaveChildren()) {
				DElement.addClass(icon, tCfg.leafClass);
			}
		} else {
			DElement.addClass(icon, tCfg.leafClass);
		}
		var cName = tCfg.className + '-node-label' + (cfg.selected ? ' ' + tCfg.selectedClass : '');
		var label = DElement.create(this.useLabel() ? 'label' : 'div', {'class': cName});
		dLib.event.add(label, 'click', this.onClick.bindAsEventListener(this));
		dLib.event.add(label, 'dblclick', this.onDblClick.bindAsEventListener(this));
		dd.appendChild(label);
		if (this.tree.useCheckboxes) {
			var chb = DElement.create('input', {'type': 'checkbox', 'class': tCfg.className + '-checkbox', checked: this.checked});
			var chbCfg = tCfg.checkbox;
			if (chbCfg.name) {
				chb.name = chbCfg.name;
				if (chbCfg.value) {
					chb.value = (typeof chbCfg.value == "function" ? chbCfg.value(this) : chbCfg.value) || cfg.label;
				}
			}
			label.appendChild(chb);
			dLib.event.add(chb, 'click', this.onCheck.bindAsEventListener(this));
		}
		if (cfg.href) {
			var clz = tCfg.className + '-link' + ((cfg.target && cfg.target.toLowerCase() == '_blank') ? ' external' : '');
			var a = DElement.create('a', {href: cfg.href, 'class': clz, target: cfg.target});
			label.appendChild(a);
			DElement.append(a, cfg.label);
		} else {
			DElement.append(label, cfg.label);
		}
		this.rendered = true;
	}
	this.tree.fireHandler("onAfterRender", [this]); // pass the node - the tree will automatically be passed too
	return this;
}

DTreeNode.prototype.isRootNode = function() {
	return !this.parentNode;
}

DTreeNode.prototype.isLeafNode = function() {
	return !(this.children && this.children.length > 0);
}

// if ajax enabled, this makes it possible for the server to configure a node as leaf without an additional request to the server
DTreeNode.prototype.canHaveChildren = function() {
	if (this.tree.ajaxEnabled) {
		return !("hasChildren" in this.config) || this.config["hasChildren"] === true;
	}
	return !this.isLeafNode();
}

DTreeNode.prototype.onCheck = function(e) {
	e.stopPropagation();
	return this.fireCheck(e);
}

DTreeNode.prototype.fireCheck = function(e) {
	var args = [e, this];
	if (this.tree.fireHandler("onBeforeCheck", args)) {
		this.check();
	}
	this.tree.fireHandler("onAfterCheck", args);
	return this;
}

DTreeNode.prototype.setChecked = function(checked) {
	var chb = this.rendered ? this.getCheckboxElement() : null;
	if (chb) {
		if (typeof checked == "boolean") {
			this.checked = chb.checked = checked;
		} else {
			this.checked = chb.checked;
		}
	} else {
		this.checked = !!checked;
	}
	return this;
}

DTreeNode.prototype.check = function(checked) {
	this.setChecked(checked);
	// synchronize descendants
	this.cascadeCheck(this.checked);
	// synchronize ancestors
	this.bubbleCheck(this.checked);
	return this;
}

DTreeNode.prototype.doCascade = function() {
	return this.tree.config.checkbox.cascade && !this.isLeafNode();
}

DTreeNode.prototype.doBubble = function() {
	return this.parentNode && this.tree.config.checkbox.bubble;
}

DTreeNode.prototype.cascadeCheck = function(state) {
	if (this.doCascade()) {
		for (var i = 0, l = this.children.length; i < l; i++) {
			this.children[i].setChecked(state).cascadeCheck(state);
		}
	}
	return this;
}

DTreeNode.prototype.bubbleCheck = function(state) {
	if (this.doBubble()) {
		for (var pNode = this.parentNode; pNode != null; pNode = pNode.parentNode) {
			if (!state || !pNode.children.some(function(n) { return n.checked !== state; })) {
				pNode.setChecked(state);
			}
		}
	}
	return this;
}

DTreeNode.prototype.onClick = function(e) {
	e.stopPropagation();
	return this.fireClick(e);
}

DTreeNode.prototype.fireClick = function(e) {
	var args = [e, this];
	if (!this.useLabel() && this.tree.fireHandler("onBeforeClick", args)) {
		this.fireSelect(e);
	}
	this.tree.fireHandler("onAfterClick", args);
	return this;
}

DTreeNode.prototype.fireSelect = function(e) {
	var args = [e, this];
	if (this.tree.fireHandler("onBeforeSelect", args)) { // use & and not && as we need to fire both no matter the returned value
		this.toggleSelected();
	}
	this.tree.fireHandler("onAfterSelect", args);
	return this;
}

DTreeNode.prototype.onDblClick = function(e) {
	e.stopPropagation();
	return this.fireDblClick(e);
}

DTreeNode.prototype.fireDblClick = function(e) {
	if (this.tree.fireHandler("onBeforeDblClick", [e, this])) {
		// do nothing
	}
	this.tree.fireHandler("onAfterDblClick", [e, this]);
	return this;
}

DTreeNode.prototype.toggleSelected = function() {
	this.selected ? this.unselect() : this.select();
	return this;
}

DTreeNode.prototype.select = function() {
	if (this.tree.config.singleNodeSelection) {
		this.tree.levelWalk(function(n) { n.unselect(); });
	}
	this.setSelected(true);
	DElement.addClass(this.element, this.tree.config.selectedClass);
	return this;
}

DTreeNode.prototype.useLabel = function() {
	return this.tree.useLabel();
}

DTreeNode.prototype.setSelected = function(selected) {
	this.selected = !!selected;
	return this;
}

DTreeNode.prototype.unselect = function() {
	this.setSelected();
	DElement.removeClass(this.element, this.tree.config.selectedClass);
	return this;
}

// added to non-leaf nodes
DTreeNode.prototype.onToggle = function(e) {
	e.stopPropagation();
	return this.fireToggle(e);
}

DTreeNode.prototype.fireToggle = function(e) {
	var args = [e, this];
	if (this.tree.fireHandler("onBeforeToggle", args)) {
		this.toggle();
	}
	this.tree.fireHandler("onAfterToggle", args);
	return this;
}

DTreeNode.prototype.toggle = function(deep) {
	return this.expanded ? this.collapse(deep) : this.expand(deep);
}

DTreeNode.prototype.swapStateClasses = function(fromClass, toClass) {
	var arr = [this.getIconElement()];
	if (!this.isLeafNode()) {
		arr.push(this.getBranchElement());
	}
	arr.forEach(function(el) {
		DElement.replaceClass(el, fromClass, toClass);
	});
	return this;
}

DTreeNode.prototype.doLoadChildren = function() {
	return (!this.children || !this.tree.config.ajax.loadOnlyOnce) && this.tree.doLoadChildren();
}

DTreeNode.prototype.collapse = function(deep) {
	var cfg = this.tree.config;
	this.swapStateClasses(cfg.expandedClass, cfg.collapsedClass).expanded = false;
	if (deep && this.children) {
		this.children.forEach(function(dNode) {
			dNode.collapse(true);
		});
	}
	return this;
}

DTreeNode.prototype.expand = function(deep) {
	var cfg = this.tree.config;
	this.swapStateClasses(cfg.collapsedClass, this.doLoadChildren() ? cfg.loadingClass : cfg.expandedClass).expanded = true;
	if (this.doLoadChildren()) {
		this.tree.createAjaxRequest(this);
	}
	else if (deep && this.children) {
		this.children.forEach(function(dNode) {
			dNode.expand(true);
		});
	}
	return this;
}

DTreeNode.prototype.bubbleExpand = function() {
	if (this.expanded) {
		for (var n = this.parentNode; n != null; n = n.parentNode) {
			n.expand();
		}
	}
	return this;
}

DTree.onDOMReadyListener = domReady(DTree.initAll);
DTree.onUnloadListener = addEvent("unload", DTree.saveTrees);