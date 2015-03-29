/*
 * TODO:
 * - DTabSet.prototype.destroy doesn't work properly
 */
if (typeof dLib == "undefined") {
	throw new Error("DTabs.js: You must load DLib.js for this file to work!");
}

/**	To create a set of tabs you just invoke the static method newInstance of the class DTabSet with the parameters tabBar and config.
	As the names suggests the first parameter should be an id of the list element (UL, OL or DL) for the set of tabs or a reference to this list element.
	Each list item (LI or DD) must contain links (A-tags) which links (anchors) to the associated content tab.
	If you only need one tab bar, but need it to be placed below the tabs, simply just place the list element for your tab bar below the last tab element
	in the tab set.
	*/

DTabSet.defaultConfig = {
	secondTabBar: "", // id or reference to second tab bar element - it's assumed that it is placed below the tabs and will therefore be added the CSS class 'tabBarBottomClass'
	eventType: "click", // which kind of event should be used to change tabs - could be mouseover as well
	tabBarClass: "DTabBar",
	tabBarBottomClass: "DTabBarBottom",
	tabClass: "DTab",
	tabActiveClass: "DTabActive",
	tabInActiveClass: "DTabInActive",
	tabDisabledClass: "DTabDisabled",
	tabItemClass: "DTabItem",
	tabItemActiveClass: "DTabItemActive",
	tabItemLeftClass: "DTabItemLeft", // inactive class
	tabItemRightClass: "DTabItemRight", // inactive class too
	tabItemDisabledClass: "DTabItemDisabled",
	tabParam: 'tabIndex',
	saveStateInCookie: false, // requires that DCookie.js is loaded too
	selectedIndex: -1, // if > -1 forces a selected index
	defaultSelectedIndex: 0, // if > -1 selected index will become this value if selected index not specified otherwise (by query string parameter, by location.hash, by cookie or by CSS class)
	ignoreShiftDownOnchange: false,
	ignoreNestedSelectedIndex: true, // see the resolveSelectedIndex method of the DTabSet class
	resetFormValidationOnchange: false,
	hideDatePickersOnchange: true,
	scope: null,
	onInit: null,
/*	These methods are fired when activating (likely clicking) another tab.
	The argument e refers to the event object.
	The argument selTab refers to the tab you're changing to.
	The argument prevTab refers to the tab you're leaving.
	The argument dTabBar refers to the tab bar in which the user changed the tab.
	The this keyword refers to the tabSet containing the tabs (scope will be the tabSet instance if not specified - if specified you can always refer to the tabSet instance via the tabSet property of the Tab class).
	*/
	onBeforeChangeTab: null, // could be: function(e, selTab, prevTab) { return false; } - returning false prevents change of tabs
	onAfterChangeTab: null // could be: function(e, selTab, prevTab) { }
}

DTabSet.instances = [];

function DTabSet(tabBar, config) {
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.tabBar = tabBar;
	this.tabBarBottom = this.config.secondTabBar;
	this.index = DTabSet.instances.length;
	this.tabs = [];
	this.selectedIndex = -1;
	this.initialized = false;
}

DTabSet.newInstance = function(bar, config) {
	var instance = new DTabSet(bar, config);
	DTabSet.instances.push(instance);
	return instance;
}

DTabSet.adjustFormAction = function(form) {
	var tab = DTabSet.getTabFromNode(form);
	if (tab && form.action.toLowerCase().indexOf('javascript:') == -1) {
		if (form.method.toLowerCase() == "get") {
			if (document.createElement) {
				var hiddenField;
				// do not create the hidden field twice
				var els = form.getElementsByTagName("input");
				for (var i = 0, len = els.length; i < len; i++) {
					var el = els[i];
					if (el.type == "hidden" && el.form === form && el.name == tab.tabSet.config.tabParam) {
						hiddenField = el;
						break;
					}
				}
				if (!hiddenField) {
					hiddenField = document.createElement("input");
				}
				hiddenField.setAttribute("type", "hidden");
				hiddenField.name = tab.tabSet.config.tabParam;
				hiddenField.value = tab.tabSet.index + "-" + tab.index;
				form.appendChild(hiddenField);
			}
		} else {
			var query = (form.action.indexOf("?") == -1) ? "?" : "&";
			query += tab.tabSet.config.tabParam + "=" + tab.tabSet.index + "-" + tab.index;
			form.action += query;
		}
	}
}

/**
	Returns the tab containing the specified node/element, if any. Returns null otherwise. If targetTabSet not provided loops through every tab set instance.
*/
DTabSet.getTabFromNode = function(node, targetTabSet) {
	function getTab(tabSet, node) {
		for (var i = 0, l = tabSet.tabs.length; i < l; i++) {
			var tab = tabSet.tabs[i];
			if (tab.dEl.element === node) {
				return tab;
			}
		}
		return null;
	}
	while (node) {
		var name = node.nodeName;
		if (name && node.nodeType == 1 && ["div", "p"].indexOf(name.toLowerCase()) > -1) { // only check div and p tags for better performance
			if (targetTabSet instanceof DTabSet) {
				var tab = getTab(targetTabSet, node);
				if (tab) {
					return tab;
				}				
			} else {
				for (var i = 0, l = DTabSet.instances.length; i < l; i++) {
					var tabSet = DTabSet.instances[i];
					var tab = getTab(tabSet, node);
					if (tab) {
						return tab;
					}
				}
			}
		}
		node = node.parentNode;
	}
	return null;
}

DTabSet.initTabSets = function() {
	for (var i = 0, l = DTabSet.instances.length; i < l; i++) {
		DTabSet.instances[i].init();
	}
}

DTabSet.getState = function() {
	var s = "";
	DTabSet.instances.forEach(function(dTabSet) {
		s += dTabSet.getState() + "&";
	});
	return s ? s.substring(0, s.length - 1) : s;
}

DTabSet.saveState = function() {
	if (DTabSet.instances.some(function(dTabSet) {
		return dTabSet.config.saveStateInCookie;
	})) {
		var pName = encodeURIComponent(location.pathname);
		new DCookie("DTabSet", {
			path: '/',
			expiryDate: new Date().addYear(1)
		}).setParameter(pName, DTabSet.getState()).save();
	}
}

DTabSet.getIdFromURL = function(url) {
	var idx = url.indexOf("#");
	return (idx > -1) ? url.substring(idx + 1) : "";	
}

DTabSet.getTabById = function(id) {
	function getTab(tabSet, tabId) {
		for (var i = 0, l = tabSet.tabs.length; i < l; i++) {
			var tab = tabSet.tabs[i];
			if (tab.dEl.element.id == tabId) {
				return tab;
			}
		}
		return null;
	}
	for (var i = 0, l = DTabSet.instances.length; i < l; i++) {
		var tabSet = DTabSet.instances[i];
		var tab = getTab(tabSet, id);
		if (tab) {
			return tab;
		}
	}
	return null;
}

// method to switch to a possible tab containing the element (used in conjunction with DForm.js)
DTabSet.changePossibleTab = function(element) {
	var tab = DTabSet.getTabFromNode(element);
	while (tab) {
		tab.tabSet.changeTab(tab);
		tab = tab.dEl.element.parentNode ? DTabSet.getTabFromNode(tab.dEl.element.parentNode) : null;
	}
}

DTabSet.prototype.toString = function() {
	return "[object " + this.constructor.getName() + "]";
}

// TODO: if j out of bounds shift node list
DTabSet.prototype.moveTab = function(i, step) {
	var l = this.tabs.length, j = i + step;
	dLib.assert(i >= 0 && i < l && j >= 0 && j < l, "Invalid index!");
	if (i == this.selectedIndex) {
		this.selectedIndex = j;
	}
	return this.swapTabs(i, j);
}

DTabSet.prototype.swapTabs = function(i, j) {
	dLib.assert(i >= 0 && i < this.tabs.length && j >= 0 && j < this.tabs.length, "Invalid index!");
	this.tabBar.swapItems(i, j);
	if (this.tabBarBottom) {
		this.tabBarBottom.swapItems(i, j);
	}
	this.getTabElements().swapElements(i, j);
	this.tabs.swap(i, j).forEach(function(tab, n) {
		tab.index = n;
	});
	return this;
}

DTabSet.prototype.getTabElements = function(asArray) {
	dLib.assert(this.tabs.length > 0, "No tabs defined!");
	var el = this.tabs[0].dEl.element;
	var dElementList = q(el.parentNode.tagName.toLowerCase() + ' > ' + el.tagName, el.parentNode);
	return !!asArray ? dElementList.asArray() : dElementList;
}

// TODO: test
DTabSet.prototype.nextTab = function(e, dTabBar, chain) {
	var index = this.selectedIndex + 1;
	if (index == this.tabs.length) {
		if (!chain) {
			return this;
		}
		index = 0;
	}
	return this.onChangeTab(e, this.tabs[index]);
}

//TODO: test
DTabSet.prototype.prevTab = function(e, dTabBar, chain) {
	var index = this.selectedIndex - 1;
	if (index < 0) {
		if (!chain) {
			return this;
		}
		index = this.tabs.length - 1;
	}
	return this.onChangeTab(e, this.tabs[index]);	
}

DTabSet.prototype.adjustTabItems = function() {
	this.tabBar.adjustItems();
	if (this.tabBarBottom) {
		this.tabBarBottom.adjustItems();
	}
	return this;
}

DTabSet.prototype.adjustTabItem = function(tab) {
	this.tabBar.adjustItem(tab);
	if (this.tabBarBottom) {
		this.tabBarBottom.adjustItem(tab);
	}
	return this;
}

DTabSet.prototype.init = function() {
	if (!this.initialized) {
		var cfg = this.config;
		this.tabBar = new DTabBar(this.tabBar, this).init(); // initializes each tab too
		if (this.tabBarBottom) {
			this.tabBarBottom = new DTabBar(this.tabBarBottom, this, false).init();
		}
		this.resolveSelectedIndex();
		var selTab = this.tabs[this.selectedIndex];
		if (selTab.disabled) {
			selTab = null;
			for (var i = 0, l = this.tabs.length; i < l; i++) {
				var tab = this.tabs[i];
				if (!tab.disabled) {
					this.selectedIndex = i;
					selTab = tab;
					break;
				}
			}
		}
		dLib.assert(!!selTab, "DTabs.js: No tabs to select! They're all disabled!");
		this.showSelectedTab(selTab);
		this.initialized = true;
		this.fireHandler("onInit");
	}
	return this;
}

DTabSet.prototype.fireHandler = dLib.util.fireHandler;

/**
	Priority:
	1. tabParam in configuration object - overrules ignoreNestedSelectedIndex in configuration object in nesting tab set
	2. location.hash - obeys ignoreNestedSelectedIndex in configuration object in nesting tab set
	3. cookie
	4. class attribute - obeys ignoreNestedSelectedIndex in configuration object in nesting tab set
	5. selectedIndex in configuration object - obeys ignoreNestedSelectedIndex in configuration object in nesting tab set
	Note that if a nested tabset has any kind of preference for a selected tab, this will overrule any kind of preference for a selected tab in the nesting tabset, if ignoreNestedSelectedIndex is false (except when selectedIndex is specified as URL parameter).
	Then the tab containing the nested tab set will be selected!
*/
// TODO: split into several methods
DTabSet.prototype.resolveSelectedIndex = function() {
	var cfg = this.config;
	var ignoreNestedSelectedIndex = !!cfg.ignoreNestedSelectedIndex;
	var selIndex = -1;
	var values = location.href.getParameterValues(cfg.tabParam);
	if (values) {
		for (var i = 0, l = values.length; i < l; i++) {
			var value = values[i];
			var hyphenIndex = value.indexOf("-");
			var tabSetIndex = (hyphenIndex > -1) ? Math.max(parseInt(value, 10), 0) : NaN;
			if (tabSetIndex == this.index - 1) {
				ignoreNestedSelectedIndex = false;
				this.dontIgnore = true;
			}
			else if (ignoreNestedSelectedIndex && !isNaN(tabSetIndex) && tabSetIndex < this.index) {
				var prevTabSet = DTabSet.instances[this.index - 1];
				ignoreNestedSelectedIndex = !prevTabSet.dontIgnore; // TODO: does not work if 2 tab set instances is in the 'middle' of the grandfather - father - son hierarchy
				delete prevTabSet.dontIgnore;
			}
			var index = (hyphenIndex + 1 <= value.length) ? parseInt(value.substring(hyphenIndex + 1), 10) : parseInt(value, 10);
			index = isNaN(index) ? 0 : Math.max(index, 0);
			if ((isNaN(tabSetIndex) || tabSetIndex == this.index) && index < this.tabs.length) {
				selIndex = index;
				break;
			}
		}
	}
	if (selIndex == -1) {
		var id = location.hash.substring(1);
		this.tabs.forEach(function(tab, index) {
			if (!tab.disabled) {
				if (id && tab.dEl.element.id == id) {
					selIndex = index;
				}
				if (selIndex == -1 && tab.dEl.hasClass(tab.tabSet.config.tabActiveClass)) {
					selIndex = index;
				}
			}
		});
	}
	if (selIndex == -1 && cfg.saveStateInCookie) {
		var pName = encodeURIComponent(location.pathname);
		// no need to specify path if you only wan't to read the cookie
		var state = new DCookie(this.constructor.name).getParameter(pName);
		if (state) {
			var n = NaN;
			state.split(cfg.tabParam + "=").every(function(v) {
				n = parseInt(v.replace(/[0-9]{1,}\-/, ''), 10);
				return isNaN(n) ? true : n !== this.index;
			}.bind(this));
			if (!isNaN(n) && n >= 0 && n < this.tabs.length) {
				selIndex = n;
			}
		}
	}
	if (selIndex > -1) {
		this.selectedIndex = selIndex;
	}
	else if (cfg.selectedIndex > -1) {
		this.selectedIndex = cfg.selectedIndex;
	}
	else if (cfg.defaultSelectedIndex > -1) {
		this.selectedIndex = cfg.defaultSelectedIndex;
	} else {
		this.selectedIndex = 0;
	}	
	if (ignoreNestedSelectedIndex) {
		return this;
	}
	var nestedTabSet = this.getNestedTabSet();
	if (nestedTabSet) {
		var selTab = nestedTabSet.tabs[nestedTabSet.selectedIndex];
		DTabSet.changePossibleTab(selTab.dEl.element.parentNode);
	}
	return this;
}

DTabSet.prototype.getTabByIndex = function(index) {
	return (!isNaN(index) && index > -1 && index < this.tabs.length) ? this.tabs[index] : null;
}

DTabSet.prototype.getSelectedTab = function() {
	return (this.selectedIndex > -1) ? this.tabs[this.selectedIndex] : null;
}

DTabSet.prototype.showSelectedTab = function(selTab) {
	selTab = selTab || this.getSelectedTab();
	this.selectedIndex = selTab.index;
	for (var i = 0, l = this.tabs.length; i < l; i++) {
		this.tabs[i].hide();
	}
	selTab.show();
	this.adjustTabItems();
	return this;
}

DTabSet.prototype.onChangeTab = function(e, selTab) {
	e.preventDefault().stopPropagation();
	dLib.assert(selTab != null, "Cannot resolve clicked tab!");
	var prevTab = this.tabs[this.selectedIndex];
	var doChange = this.fireHandler("onBeforeChangeTab", [e, selTab, prevTab]);
	if (doChange) {
		var cfg = this.config;
		if (e && !cfg.ignoreShiftDownOnchange && e.isShiftDown()) {
			var value = this.index + "-" + selTab.index;
			var values = (location.href.getParameterValues(cfg.tabParam) || []).filter(function (entry, i) {
				return (entry.indexOf(this.index + "-") != 0);
			}, this);
			values.unshift(value); // put value in front
			location.search = location.search.setParameterValues(cfg.tabParam, values);
		} else {
			this.changeTab(selTab, prevTab);
		}
	}
	this.fireHandler("onAfterChangeTab", [e, selTab, prevTab]);
	return this;
}

DTabSet.prototype.changeTab = function(selTabOrIndex, prevTab) {
	var selTab;
	switch (selTabOrIndex.constructor) {
		case Number:
			if (selTabOrIndex >= 0) {
				selTab = this.tabs[selTabOrIndex];
				break;
			}
		case DTab:
			selTab = selTabOrIndex;
			break;
	}
	dLib.assert(!!selTab, "Can't find tab with index " + selTabOrIndex + "!");
	if (selTab.index !== this.selectedIndex && !selTab.disabled) {
		prevTab = prevTab || this.tabs[this.selectedIndex];
		if (this.config.hideDatePickersOnchange) {
			selTab.hidePossibleDatePickers(prevTab);
		}
		if (this.config.resetFormValidationOnchange) {
			selTab.resetDForms(prevTab);
		}
		this.showSelectedTab(selTab);
	}
	return this;
}

/** A nested tab set must be instantiated just before the nesting tab set! */
DTabSet.prototype.getNestedTabSet = function() {
	var prevTabSet = (this.index > 0) ? DTabSet.instances[this.index - 1] : null;
	if (prevTabSet) {
		var target = prevTabSet.tabBar.dEl.element;
		if (DTabSet.getTabFromNode(target, this)) {
			return prevTabSet;
		}
	}
	return null;
}

DTabSet.prototype.getNestingTabSet = function() {
	var nextTabSet = (this.index + 1 < DTabSet.instances.length) ? DTabSet.instances[this.index + 1] : null;
	if (nextTabSet) {
		var target = this.tabBar.dEl.element;
		if (DTabSet.getTabFromNode(target, nextTabSet)) {
			return nextTabSet;
		}
	}
	return null;
}

DTabSet.prototype.addTab = function(label, index, url) {
	index = parseInt(index, 10);
	if (isNaN(index) || index < 0 || index + 1 > this.tabs.length) {
		index = this.tabs.length;
	}
	var id = !!url ? DTabSet.getIdFromURL(url) : "";
	id = id || "divTab" + new Date().getTime();
	url = url || "#" + id;
	var tab = new DTab(id, this);
	tab.index = index;
	tab.init();
	this.tabs.splice(index, 0, tab);
	if (index <= this.selectedIndex) {
		this.selectedIndex += 1;
	}
	for (var i = 0, l = this.tabs.length; i < l; i++) {
		this.tabs[i].index = i;
	}
	this.tabBar.addItem(label, index, url);
	if (this.tabBarBottom) {
		this.tabBarBottom.addItem(label, index, url);
	}
	this.adjustTabItems(); // need to adjust all items in order for the event listener to be associated with the right tab element
	return index; // the passed index may be changed, so the index variable is returned. Besides the DTab class is not designed to be accessed directly, but through the DTabSet class
}

DTabSet.prototype.getIndexById = function(id) {
	for (var i = 0, l = this.tabs.length; i < l; i++) {
		if (this.tabs[i].dEl.element.id == id) {
			return i;
		}
	}
	return NaN;
}

// TODO: Test removal of last and only tab! Should it be allowed?
DTabSet.prototype.removeTab = function(indexOrId) {
	var index = -1;
	if (typeof indexOrId == "string") {
		index = this.getIndexById(indexOrId);
	}
	else if (typeof indexOrId == "number") {
		index = indexOrId;
	}
	dLib.assert(index >= 0 && index < this.tabs.length, "Can't remove tab with index " + index + "! It doesn't exists!");
	// remove/update object references (remove possible nested tabs, remove tab in this.tabs and decrement tab.index in subsequent tabs)
	var tab = this.tabs[index];
	tab.destroyPossibleNestedTabSet();
	// remove tab
	this.tabs.splice(index, 1);
	for (var i = index, l = this.tabs.length; i < l; i++) {
		this.tabs[i].index -= 1;
	}
	// remove HTML elements
	tab.removeElement();
	this.tabBar.removeItem(index);
	if (this.tabBarBottom) {
		this.tabBarBottom.removeItem(index);
	}
	this.adjustTabItems();
	var dTabs = this.tabs;
	var findEnabledTabIndex = function(step, start) { // step must be 1 or -1, start is included, limit is excluded
		var n = start;
		var limit = (step < 0) ? 1 : dTabs.length;
		while (n * step < limit) {
			if (!dTabs[n].disabled) {
				return n;
			}
			n += step;
		}
		return -1;
	}
	var newIndex = -1;
	if (this.selectedIndex >= dTabs.length) {
		// go down
		newIndex = findEnabledTabIndex(-1, dTabs.length - 1);
	}
	else if (this.selectedIndex == index) {
		// go up
		newIndex = findEnabledTabIndex(1, index);
		if (newIndex == -1) { // none found, go down then
			newIndex = findEnabledTabIndex(-1, index);
		}
	}
	if (newIndex >= 0) {
		this.selectedIndex = -1; // reset first - change tab will set it correctly
		this.changeTab(newIndex);
	}
	else if (this.tabs.length == 0) {
		this.selectedIndex = -1;
	}
	return this;
}

/* removes tabs and reverts HTML back */
DTabSet.prototype.destroy = function() {
	// must destroy tab bars before destroying tabs
	this.tabBar.destroy();
	if (this.tabBarBottom) {
		this.tabBarBottom.destroy();
	}
	this.tabs.forEach(function(tab, index) {
		tab.destroyPossibleNestedTabSet();
		tab.destroy();
	});
	this.tabs = null;
	DTabSet.instances.splice(this.index, 1);
	return this;
}

DTabSet.prototype.getState = function() {
	return this.config.tabParam + "=" + this.index + "-" + this.selectedIndex;
}

DTabSet.prototype.writeTab = function(index, htm, append) {
	if (typeof index == "string") {
		index = this.getIndexById(index);
	}
	this.tabs[index].dEl.write(htm, append);
	return this;	
}

DTabSet.prototype.disableTab = function(index) {
	if (typeof index == "string") {
		index = this.getIndexById(index);
	}
	if (index == this.selectedIndex) {
		return;
	}
	var tab = this.tabs[index];
	tab.disabled = true;
	this.adjustTabItem(tab);
	return this;
}

DTabSet.prototype.enableTab = function(index) {
	if (typeof index == "string") {
		index = this.getIndexById(index);
	}
	if (index == this.selectedIndex) {
		return;
	}
	var tab = this.tabs[index];
	tab.disabled = false;
	this.adjustTabItem(tab, true);
	return this;
}

function DTabBar(element, tabSet, isPrimary) {
	this.dEl = element;
	this.tabSet = tabSet;
	this.itemTagName = "";
	this.isPrimary = (typeof isPrimary == "boolean") ? isPrimary : true;
	this.initialized = false;
}

DTabBar.prototype.toString = DTabSet.prototype.toString;

DTabBar.prototype.init = function() {
	if (!this.initialized) {
		var dEl = this.dEl = g(this.dEl);
		dLib.assert(["UL", "OL", "DL"].contains(dEl.element.tagName.toUpperCase()), 'DTabs.js: Invalid type of tab bar container! Must be a list tag (UL, OL or DL)!');
		this.itemTagName = dEl.element.tagName.toLowerCase() == "dl" ? "dd" : "li";
		var tabSet = this.tabSet;
		var cfg = tabSet.config;
		dEl.addClass(cfg.tabBarClass);
		if (this.isPrimary) {
			q("a", dEl.element).forEach(function(link) {
				var index = link.href.indexOf("#");
				var id = (index > -1) ? link.href.substring(index + 1) : ""; // TODO: What if no # present? But just contains a plain url for Ajax use
				var tab = new DTab(id, tabSet);
				tabSet.tabs.push(tab);
				tab.init();
			});
			// check if tabBar is placed below sheets - not a foolproof check though
			var nextElement = tabSet.tabs[tabSet.tabs.length - 1].dEl.nextElement();
			var firstElement;
			if (nextElement && (dEl.element === nextElement.element || ((firstElement = nextElement.firstElement()) != null && dEl.element === firstElement.element))) {
				dEl.addClass(cfg.tabBarBottomClass);
			}
		} else {
			dEl.addClass(cfg.tabBarBottomClass);
		}
		this.initialized = true;
	}
	return this;
}

DTabBar.prototype.addItem = function(label, index, url) {
	var item = document.createElement(this.itemTagName);
	var nextItem = g(this.dEl.getElementsByTagName(this.itemTagName)[index]);
	if (nextItem) {
		nextItem.insertBefore(item);
	}
	else if (index > 0) {
		var prevItem = g(this.dEl.getElementsByTagName(this.itemTagName)[index - 1]);
		if (prevItem) {
			prevItem.insertAfter(item);
		}
	} else {
		this.dEl.element.appendChild(item);
	}
	// nodes must be inserted in this order to avoid memory leaks in IE (DOM Insertion Order Leak Model) - see http://msdn.microsoft.com/en-us/library/bb250448.aspx
	var a = document.createElement("a");
	a.href = url;
	item.appendChild(a);
	a.appendChild(document.createTextNode(label));
	return this;
}

DTabBar.prototype.getItems = function(asArray) {
	var dElementList = q(this.dEl.element.tagName.toLowerCase() + ' > ' + this.itemTagName, this.dEl.element);
	return !!asArray ? dElementList.asArray() : dElementList;
}

DTabBar.prototype.getItem = function(index) {
	return this.getItems().item(index);
}

DTabBar.prototype.adjustItems = function() {
	for (var i = 0, l = this.tabSet.tabs.length; i < l; i++) {
		this.adjustItem(this.tabSet.tabs[i]);
	}
	return this;
}

DTabBar.prototype.swapItems = function(i, j) {
	this.getItems().swapElements(i, j);
	this.adjustItems();
	return this;
}

DTabBar.prototype.adjustItem = function(tab) {
	return this.adjustItemClasses(tab).addItemListener(tab);
}

DTabBar.prototype.addItemListener = function(tab) {
	if (!this.linkListeners) {
		this.linkListeners = {};
	}
	var link = DElement.firstElement(this.getItem(tab.index));
	var id = DElement.getId(link);
	if (!(id in this.linkListeners)) {
		var cfg = this.tabSet.config;
		var f = this.tabSet.onChangeTab.bindAsEventListener(this.tabSet, tab);
		this.linkListeners[id] = f;
		dLib.event.add(link, cfg.eventType, f);
	}
	return this;
}

DTabBar.prototype.adjustItemClasses = function(tab) {
	var cfg = this.tabSet.config;
	var dItem = g(this.getItem(tab.index));
	['', 'Left', 'Right', 'Active', 'InActive'].forEach(function(s) {
		dItem.removeClass(cfg['tabItem' + s + 'Class']);
	});
	if (tab.index == this.tabSet.selectedIndex) {
		dItem.addClass(cfg.tabItemActiveClass, true).addClass(cfg.tabItemClass, true);
	} else {
		var clazz = (tab.index > this.tabSet.selectedIndex) ? cfg.tabItemRightClass : cfg.tabItemLeftClass;
		dItem.addClass(clazz, true).addClass(cfg.tabItemClass, true);
	}
	if (tab.disabled) {
		dItem.addClass(cfg.tabItemDisabledClass);
	} else {
		dItem.removeClass(cfg.tabItemDisabledClass);
	}
	return this;
}

DTabBar.prototype.removeItem = function(index) {
	var dItem = g(this.dEl.getElementsByTagName(this.itemTagName)[index]);
	dItem.element.parentNode.removeChild(dItem.element);
	/*this.dEl.element.normalize();
	if (this.dEl.element.children.length == 0) {
		this.tabSet.destroy();
	}*/
	return this;
}

DTabBar.prototype.destroy = function() {
	var cfg = this.tabSet.config;
	this.destroyItems();
	this.dEl.removeClass(cfg.tabBarClass).removeClass(cfg.tabBarBottomClass);
	return this;
}

DTabBar.prototype.destroyItems = function() {
	for (var i = 0, l = this.tabSet.tabs.length; i < l; i++) {
		this.destroyItem(this.tabSet.tabs[i]);
	}
	return this;
}

DTabBar.prototype.destroyItem = function(tab) {
	var cfg = this.tabSet.config;
	var dItem = g(this.dEl.getElementsByTagName(this.itemTagName)[tab.index]);
	dItem.removeClass(cfg.tabItemClass);
	dItem.removeClass(cfg.tabItemActiveClass);
	dItem.removeClass(cfg.tabItemLeftClass);	
	dItem.removeClass(cfg.tabItemRightClass);	
	dItem.removeClass(cfg.tabItemDisabledClass);		
	var link = dItem.getElementsByTagName('a')[0];
	link['on' + cfg.eventType] = null;
}

function DTab(element, tabSet) {
	this.dEl = element;
	this.tabSet = tabSet;
	this.index = this.tabSet.tabs.length;
	this.disabled = false;
	this.initialized = false;
}

DTab.prototype.toString = function() {
	return "[object " + this.constructor.getName() + " " + ((this.dEl && this.dEl.element) ? this.dEl.element.id : this.dEl) + "]";
}

DTab.prototype.init = function() {
	if (!this.initialized) {
		this.dEl = g(this.dEl) || this.dEl;
		if (typeof this.dEl == "string") {
			this.create(this.dEl);
			this.dEl = g(this.dEl);
		}
		var cfg = this.tabSet.config;
		this.disabled = this.dEl.hasClass(cfg.tabDisabledClass);
		this.dEl.addClass(cfg.tabInActiveClass, true).addClass(cfg.tabClass, true);
		this.initialized = true;
	}
	return this;
}

DTab.prototype.show = function() {
	this.dEl.replaceClass(this.tabSet.config.tabInActiveClass, this.tabSet.config.tabActiveClass, true);
	return this;
}

DTab.prototype.hide = function() {
	this.dEl.replaceClass(this.tabSet.config.tabActiveClass, this.tabSet.config.tabInActiveClass, true);
	return this;
}

DTab.prototype.removeElement = function() {
	this.dEl.element.parentNode.removeChild(this.dEl.element);
	return this;
}

DTab.prototype.remove = function() {
	this.tabSet.removeTab(this.index);
	return this;
}

DTab.prototype.create = function(id) {
	if (id) {
		var div = document.createElement("div");
		div.id = id;
		var nextTab = this.tabSet.tabs[this.index];
		if (nextTab) {
			nextTab.dEl.insertBefore(div);
			return this;
		}
		var	prevTab = this.tabSet.tabs[this.index - 1];
		if (prevTab) {
			prevTab.dEl.insertAfter(div);
			return this;
		}
		document.body.appendChild(div);
	}
	return this;
}

DTab.prototype.destroy = function() {
	var cfg = this.tabSet.config;
	this.dEl.removeClass(cfg.tabClass).removeClass(cfg.tabActiveClass).removeClass(cfg.tabInActiveClass).removeClass(cfg.tabDisabledClass);
	return this;
}

DTab.prototype.destroyPossibleNestedTabSet = function() {
	var prevTabSet = (this.tabSet.index > 0) ? DTabSet.instances[this.tabSet.index - 1] : null;
	if (prevTabSet) {
		var target = prevTabSet.tabBar.dEl.element;
		if (this === DTabSet.getTabFromNode(target, this.tabSet)) {
			prevTabSet.destroy();
		}
	}
	return this;
}

/* This method is fired when clicking on another tab. */
DTab.prototype.hidePossibleDatePickers = function(prevTab) {
/*	Hides any possible calendar on the tab that you're leaving, when clicking on another tab.
	The tab argument refers to the tab that you're leaving and e to the event object. */
	if (typeof DDatePicker == "function") {
		DDatePicker.hideAll();
	}
	return this;
}

/* This method is fired when changing to another tab. */
DTab.prototype.resetDForms = function(prevTab) {
	if (typeof DForm == "function") {
		var forms = prevTab.dEl.getElementsByTagName("form");
		for (var i = 0, l = forms.length; i < l; i++) {
			var dForm = DForm.getInstance(forms[i]);
			if (dForm) {
				dForm.resetValidation();
			}
		}
	}
	return this;
}

DTabSet.onDOMReadyListener = addDOMReadyListener(DTabSet.initTabSets);
DTabSet.onUnloadListener = addEvent("unload", DTabSet.saveState);

/*
TODO:
- resolveSelectedIndex (DCookie)
- history iframe (Back button) - What if several instances uses the same history iframe (every JS app depending on the history behavior should use the same iframe!)?
- save state in cookie (when shift is down try to save in cookie before adjusting location/url)
- work with DCalendar.js
- drag'n'drop
*/