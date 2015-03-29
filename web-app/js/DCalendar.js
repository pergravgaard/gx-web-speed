/*
TODO:
Keyboard navigation does not quite work. Also make arrow down focus on the picker
*/
/*	The calendar consists of a navigation part and a rendering part.
	The rendering part is rerendered for all changes made by user whereas the navigation part is rendered only on initialization and updated afterwards on changes made by user.	*/

if (typeof dLib == "undefined") {
	throw new Error('DCalendar.js: You must load the file DLib.js!');
}

function DCalendar(dElement, config, win) {
	this.dElement = dElement;
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.win = win || window; // refers to the window object in which the DOM elements reside - this is not necessarily the window in which the code reside!
	this.winRef = '';
	this.offsetDate = null; // is used as base (offset) for all calculations and rendering
	this.selectedDate = null;
	this.minDate = null;
	this.maxDate = null;
	this.updateFields = [];
	this.index = 0;
	this.initialized = false;
}

DCalendar.instances = [];

DCalendar.defaultConfig = {
	renderOnInit: true,
	className: 'DCalendar',
	showWeekNo: true,
	showToolBar: false,
	noOfMonths: 1, // number of months to render - must be a positive integer
	updateFields: null, // input elements to update on user selection
	startDate: null, // date to use for first rendering, defaults to now - is overruled by possible date in first update field though
	minDate: null, // minimum date selectable by user
	maxDate: null, // maximum date selectable by user
	yearsBefore: 4, // years to subtract in year drop down if no min date
	yearsAfter: 5, // years to add in year drop down if no max date
	datePattern: 'd-M-yyyy', // pattern used for formatting selected date - the value which the input elements are given on selection
	monthPattern: 'MMMM yyyy',
	weekDayPattern: 'EEE',
	weekDayTitlePattern: 'EEEE',
	weekNoPattern: "w",
	weekNoTitlePattern: "'week 'w",
	weekDays: Date.daysShort.clone(),
	months: Date.months.clone(), // used in navigation part
	isWeekendActive: true, // can a date in a weekend be selected by the user
	isHolidayActive: true, // can a date which is a holiday be selected by the user
	sixRows: false, // specify true if the calendar table should always have 6 rows
	prevMonthText: '&#171;', // text for link to previous month
	nextMonthText: '&#187;', // text for link to next month
	prevYearText: '&#171;', // text for link to previous year
	nextYearText: '&#187;', // text for link to next year
	scope: null, // if null the scope for every handler below will be this DCalendar instance, unless you've bound your handler to another scope (i.e. invoked handler.bind) - specify window for global scope
	onInit: null, // a function (or handler object - an object literal with properties 'scope' and 'handleEvent') to invoke after initialization - will be passed the DCalendar instance
	onBeforeSetSelectedDate: null, // a function (or handler object - an object literal with properties 'scope' and 'handleEvent') to invoke before setting selected date - return false to cancel selection
	onAfterSetSelectedDate: null, // a function (or handler object - an object literal with properties 'scope' and 'handleEvent') to invoke after setting selected date
	onBeforeChangeMonth: null,
	onAfterChangeMonth: null,
	onBeforeUpdatePeriod: null,
	onAfterUpdatePeriod: null
};

DCalendar.newInstance = function(dElement, config, win) {
	var dCal = new DCalendar(dElement, config, win);
	dCal.index = DCalendar.instances.length;
	DCalendar.instances.push(dCal);
	return dCal;
}

DCalendar.initAll = function() {
	for (var i = 0, l = DCalendar.instances.length; i < l; i++) {
		DCalendar.instances[i].init();
	}
}

DCalendar.prototype.cName = "DCalendar"; // this constructor name property makes it possible to write HTML events which works for inheriting classes as well

DCalendar.prototype.fireHandler = dLib.util.fireHandler;

DCalendar.prototype.toString = function() {
	return "[object " + this.constructor.getName() + "] " + ((this.dElement && this.dElement.element) ? this.dElement.element.id : 'N/A');
}

DCalendar.prototype.validateConfigurationDates = function() {
	var cfg = this.config, minDate = this.resolveMinDate(), maxDate = this.resolveMaxDate(), startDate = this.resolveConfigDate("startDate");
	dLib.assert(!Date.isDate(minDate) || !Date.isDate(maxDate) || !minDate.after(maxDate), "DCalendar.js: The minimum date must be before the maximum date!");
	if (Date.isDate(startDate)) {
		dLib.assert(!Date.isDate(minDate) || !startDate.before(minDate), "DCalendar.js: The start date must be after the minimum date!");
		dLib.assert(!Date.isDate(maxDate) || !startDate.after(maxDate), "DCalendar.js: The start date must be before the maximum date!");
	}
}

DCalendar.prototype.adjustOffsetDate = function(offsetDate) {
	offsetDate = offsetDate.clone();
	var minDate = this.minDate = this.resolveMinDate();
	var maxDate = this.maxDate = this.resolveMaxDate();
	if (Date.isDate(minDate) && offsetDate.before(minDate)) {
		offsetDate = minDate.clone();
	}
	else if (Date.isDate(maxDate) && offsetDate.after(maxDate)) {
		offsetDate = maxDate.clone();
	}
	return offsetDate;
}

DCalendar.prototype.resolveMinDate = function() {
	return this.resolveConfigDate("minDate");
}

DCalendar.prototype.resolveMaxDate = function() {
	return this.resolveConfigDate("maxDate");
}

DCalendar.prototype.resolveConfigDate = function(name) {
	var date = null;
	var p = this.config[name];
	if (typeof p == "function") {
		date = p.apply(p.bound ? null : this, [this]);
	}
	else if (Date.isDate(p)) {
		date = p; // do not clone!
	}
	return date;
}

DCalendar.prototype.init = function() {
	if (!this.initialized) {
		this.validateConfigurationDates();
		this.dElement = g(this.dElement, null, this.win);
		var win = this.dElement.getDefaultView() || this.win;
		if (win != window) { // important not to compare by reference as they're only equal by value in IE
			this.win = win;
			var ref = ('_' + (Math.random() * new Date().getTime())).replace('.' , '');
			win[ref] = window;
			this.winRef = ref + '.';
		}
		var cfg = this.config;
		this.dElement.addClass(cfg.className);
		var fields = cfg.updateFields;
		if (fields && !Array.isArray(fields)) {
			fields = [fields];
		}
		this.updateFields = Array.isArray(fields) ? g(fields, null, this.win) : [];
		if (this.updateFields.length > 0) {
			this.selectedDate = Date.parseDate(this.updateFields[0].element.value, cfg.datePattern);
		}
		var offsetDate = (this.selectedDate || this.resolveConfigDate("startDate") || new Date()).clone();
		this.offsetDate = this.adjustOffsetDate(offsetDate);
		this.noOfMonths = Math.max(parseInt(this.config.noOfMonths, 10), 1);
		this.initialized = true;
		if (cfg.renderOnInit) {
			this.render();
		}
		this.fireHandler("onInit");
	}
	return this;
}

DCalendar.prototype.onSetSelectedDate = function(e, cell) {
	e = (e instanceof DEvent) ? e : g(e);
	e.preventDefault();
	if (this.fireHandler("onBeforeSetSelectedDate", [e, cell])) {
		this.setSelectedDate(this.parseSelectedDate(cell));
		var pNode = cell.parentNode.parentNode;
		if (this.noOfMonths > 1) {
			pNode = pNode.parentNode.parentNode.parentNode;
		}
		q('.Selected', pNode).forEach(function(el, i) {
			g(el).removeClass('Selected');
		});
		g(cell).addClass('Selected');
	}
	this.fireHandler("onAfterSetSelectedDate", [e, cell]);
	return false;
}

DCalendar.prototype.parseSelectedDate = function(cell) {
	var arr = cell.getAttribute('data-abbr').split('-');
	return new Date(arr[0], arr[1] - 1, arr[2]);
}

DCalendar.prototype.setSelectedDate = function(date) {
	this.selectedDate = date;
	var s = this.selectedDate.format(this.config.datePattern);
	this.updateFields.forEach(function(dField) {
		dField.element.value = s;
	});
	return this;
}

DCalendar.prototype.renderDateEntries = function(date) {
	return '';
}

// Override to support your own holidays
DCalendar.prototype.isHoliday = function(date) {
	return date.isHoliday();
}

DCalendar.prototype.renderTitle = function(title) {
	return title ? ' title="' + title + '"' : '';
}

DCalendar.prototype.renderWeekDay = function(date) {
	return date.format({pattern: this.config.weekDayPattern, daysShort: this.config.weekDays});
}

DCalendar.prototype.renderWeekDayTitle = function(date) {
	return this.renderTitle(date.format(this.config.weekDayTitlePattern));
}

DCalendar.prototype.renderWeekNoTitle = function(date) {
	return this.renderTitle(date.format(this.config.weekNoTitlePattern));
}

DCalendar.prototype.renderWeekNoCell = function(date, cfg) {
	return cfg.showWeekNo ? '<td class="WeekNo"' + this.renderWeekNoTitle(date) + '>' + date.format(cfg.weekNoPattern) + '<\/td>': '';
}

DCalendar.prototype.renderMonth = function(offsetDate) {
	offsetDate = offsetDate || this.offsetDate.clone();
	var itDate = offsetDate.getFirstDateOfMonth().getFirstDateOfWeek();
	var htm = '<div class="MonthContainer"><table class="Month">';
	htm += this.renderMonthTableCaption(offsetDate);
	htm += this.renderMonthTableHead(itDate);
	htm += this.renderMonthTableBody(itDate, offsetDate);
	htm += '<\/table><\/div>';
	return htm;
}

DCalendar.prototype.renderMonthTableCaption = function(date) {
	return '<caption>' + date.format(this.config.monthPattern) + '<\/caption>';
}

DCalendar.prototype.renderMonthTableHead = function(itDate) {
	var htm = '<thead><tr>';
	if (this.config.showWeekNo) {
		htm += '<th class="WeekNo"><div>&nbsp;<\/div><\/th>';
	}
	var weekDate = itDate.clone();
	for (var i = 0; i < 7; i++) {
		var classNames = "WeekDay";
		if (weekDate.isWeekend()) {
			classNames += " Weekend";
		}
		if (weekDate.isHoliday()) {
			classNames += " Holiday";
		}
		htm += '<th class="' + classNames + '"' + this.renderWeekDayTitle(weekDate) + '>';
		htm += this.renderWeekDay(weekDate);
		htm += '<\/th>';
		weekDate.next();
	}
	htm += '<\/tr><\/thead>';
	return htm;
}

DCalendar.prototype.renderMonthTableBody = function(itDate, offsetDate) {
	var htm = '<tbody><tr>';
	var cfg = this.config;
	htm += this.renderWeekNoCell(itDate, cfg);
	var today = new Date(), minDate = this.minDate, maxDate = this.maxDate;
	var sixRows = this.config.sixRows, rows = 0;
	for (var nextDate = itDate.clone().next(); ; nextDate.next(), itDate.next()) {
		var classNames = "Date";
		var onClick = ' onclick="' + this.winRef + this.cName + '.instances[' + this.index + '].onSetSelectedDate(event, this)"';
		var link = '<a href="javascript:void(0);" class="DateLink">' + itDate.getDate() + '<\/a>';
		var disabled = false;
		var m = itDate.getMonth(), m0 = offsetDate.getMonth();
		if (m != m0) {
			if (itDate.after(offsetDate)) {
				classNames += " Next";
			} else {
				classNames += " Prev";
			}
		} else {
			classNames += " Current";
		}
		if ((minDate && itDate.before(minDate, true)) || (maxDate && itDate.after(maxDate, true))) {
			disabled = true;
		}
		if (itDate.isWeekend()) {
			classNames += " Weekend";
			if (!cfg.isWeekendActive) {
				disabled = true;
			}
		}
		if (this.isHoliday(itDate)) {
			classNames += " Holiday";
			if (!cfg.isHolidayActive) {
				disabled = true;
			}
		}
		var entries = this.renderDateEntries(itDate);
		if (entries) {
			classNames += " HasEntries";
		}
		if (today.isSameDate(itDate)) {
			classNames += " Today";
		}
		if (this.selectedDate && this.selectedDate.isSameDate(itDate)) {
			classNames += " Selected";
		}
		if (disabled) {
			onClick = '';
			link = itDate.getDate();
			classNames += " Disabled";
		}
		htm += '<td data-abbr="' + this.formatSelectedDate(itDate) + '" class="' + classNames + '"' + onClick + '>' + link + entries + '<\/td>';
		if (nextDate.getWeekOfYear() != itDate.getWeekOfYear()) {
			if (!offsetDate.isSameMonth(nextDate)) {
				if (!sixRows || rows > 4) {
					break;
				}
			}
			rows++;
			htm += '<\/tr><tr>';
			htm += this.renderWeekNoCell(nextDate, cfg);
		}
	}
	htm += '<\/tr><\/tbody>';
	return htm;
}

DCalendar.prototype.formatSelectedDate = function(date) {
	return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
}

DCalendar.prototype.render = function(offsetDate) {
	if (!Date.isDate(offsetDate)) {
		offsetDate = this.offsetDate.clone();
	}
	this.offsetDate = this.adjustOffsetDate(offsetDate);
	var htm = this.renderNavigator(this.offsetDate);
	htm += '<div id="divCalBody_' + this.dElement.element.id + '">';
	htm += this.renderPeriod(this.offsetDate);
	htm += '<\/div>';
	if (this.config.showToolBar) {
		htm += this.renderBottomBar();
	}
	this.dElement.write(htm);
	return this;
}

DCalendar.prototype.renderBottomBar = function() { // TODO: finish
	return '';
}

DCalendar.prototype.renderPeriod = function(offsetDate) {
	offsetDate = offsetDate.getFirstDateOfMonth();
	var c = (this.noOfMonths > 1) ? "Multiple" : "Single";
	var htm = '<div class="Period ' + c + '">' + this.renderMonth();
	for (var i = 1; i < this.noOfMonths; i++) {
		htm += this.renderMonth(offsetDate.addMonth(1));
	}
	htm += '<\/div>';
	return htm;
}

/* Navigator methods */

DCalendar.prototype.updatePeriod = function(offsetDate, select) {
	// validate new offset date
	var minDate = this.minDate;
	var maxDate = this.maxDate;
	var doUpdate = (!minDate || !minDate.after(offsetDate)) && (!maxDate || !offsetDate.after(maxDate));
	// The following check is necessary if we're stepping back in time, since the offset date always is a date in the first month in the period! The last condition prevents infinite steps back in time
	if (!doUpdate && this.noOfMonths > 1 && offsetDate.before(this.offsetDate) && minDate.before(this.offsetDate)) {
		doUpdate = true;
	}
	if (doUpdate) {
		if (this.fireHandler("onBeforeUpdatePeriod")) {
			this.offsetDate = offsetDate;
			g('divCalBody_' + this.dElement.element.id, null, this.win).write(this.renderPeriod(offsetDate));
			this.updateNavigator(offsetDate, minDate, maxDate, select);
		}
		this.fireHandler("onAfterUpdatePeriod");
	}
	return this;
}

DCalendar.prototype.renderNavigator = function(date) {
	var titles = this.calculateNavigatorTitles(date);
	var c = (this.noOfMonths > 1) ? "Multiple" : "Single";
	var cfg = this.config;
	var htm = '<div class="PeriodNavigator ' + c + '">';
	htm += '<div class="MonthNavigation">';
	htm += '<div class="PrevPeriod PrevMonth"' + this.renderTitle(titles.prevMonthTitle) + '><a href="javascript:void(0);" onclick="' + this.winRef + this.cName + '.instances[' + this.index + '].renderPrevPeriod(event);">' + this.config.prevMonthText + '<\/a><\/div>';
	if (this.noOfMonths == 1) {
        var id1 = 'selChangeMonth' + this.index + this.winRef;
		htm += '<label for="' + id1 + '">&nbsp;<select id="' + id1 + '" onchange="' + this.winRef + this.cName + '.instances[' + this.index + '].onChangeMonth(event, this);">';
		var options = this.calculateMonthOptions(date);
		for (var i = 0, l = options.length; i < l; i++) {
			var option = options[i];
			var selected = option.selected ? ' selected="selected"' : '';
			htm += '<option value="' + option.value + '"' + selected + '>' + option.text + '<\/option>';
		}
		htm += '<\/select>&nbsp;<\/label>';
	}
	htm += '<div class="NextPeriod NextMonth"' + this.renderTitle(titles.nextMonthTitle) + '><a href="javascript:void(0);" onclick="' + this.winRef + this.cName + '.instances[' + this.index + '].renderNextPeriod(event);">' + cfg.nextMonthText + '<\/a><\/div>';
	htm += '<\/div>';
	if (this.noOfMonths == 1) {
		htm += '<div class="YearNavigation">';
		htm += '<div class="PrevPeriod PrevYear"' + this.renderTitle(titles.prevYearTitle) + '><a href="javascript:void(0);" onclick="' + this.winRef + this.cName + '.instances[' + this.index + '].renderPrevYear(event);">' + cfg.prevMonthText + '<\/a><\/div>';
        var id2 = 'selChangeYear' + this.index + this.winRef;
		htm += '<label for="' + id2 + '">&nbsp;<select id="' + id2 + '" onchange="' + this.winRef + this.cName + '.instances[' + this.index + '].onChangeYear(event, this);">';
		var options = this.calculateYearOptions(date);
		for (var i = 0, l = options.length; i < l; i++) {
			var option = options[i];
			var selected = option.selected ? ' selected="selected"' : '';
			htm += '<option value="' + option.value + '"' + selected + '>' + option.text + '<\/option>';
		}
		htm += '<\/select>&nbsp;<\/label>';
		htm += '<div class="NextPeriod NextYear"' + this.renderTitle(titles.nextYearTitle) + '><a href="javascript:void(0);" onclick="' + this.winRef + this.cName + '.instances[' + this.index + '].renderNextYear(event);">' + cfg.nextMonthText + '<\/a><\/div>';
		htm += '<\/div>';
	}
	htm += '<\/div>';
	return htm;
}

DCalendar.prototype.updateNavigator = function(date, minDate, maxDate, select) {
	this.updateMonthOptions(date, minDate, maxDate, select);
	this.updateYearOptions(date, minDate, maxDate, select);
	return this.updateNavigatorTitles(date, minDate, maxDate);
}

DCalendar.prototype.updateMonthOptions = function(date, minDate, maxDate, select) {
	var selMonth = this.win.document.getElementById('selChangeMonth' + this.index + this.winRef);
	if (selMonth && selMonth !== select) {
		selMonth.options.length = 0;
		var options = this.calculateMonthOptions(date, minDate, maxDate);
		for (var i = 0, l = options.length; i < l; i++) {
			var opt = options[i];
			selMonth.options[i] = new this.win.Option(opt.text, opt.value, false, opt.selected);
		}
	}
	return this;
}

DCalendar.prototype.updateYearOptions = function(date, minDate, maxDate, select) {
	var selYear = this.win.document.getElementById('selChangeYear' + this.index + this.winRef);
	if (selYear && selYear !== select) {
		selYear.options.length = 0;
		this.calculateYearOptions(date, minDate, maxDate).forEach(function(opt, i) {
			selYear.options[i] = new window.Option(opt.text, opt.value, false, opt.selected);
		});
	}
	return this;
}

DCalendar.prototype.updateNavigatorTitles = function(date, minDate, maxDate) {
	var titles = this.calculateNavigatorTitles(date, minDate, maxDate);
	q('.PrevMonth, .NextMonth, .PrevYear, .NextYear', this.dElement.element).forEach(function(el) {
		if (DElement.hasClass(el, 'PrevMonth')) {
			el.title = titles.prevMonthTitle;
		}
		else if (DElement.hasClass(el, 'NextMonth')) {
			el.title = titles.nextMonthTitle;
		}
		else if (DElement.hasClass(el, 'PrevYear')) {
			el.title = titles.prevYearTitle;
		}
		else if (DElement.hasClass(el, 'NextYear')) {
			el.title = titles.nextYearTitle;
		}
	});
	return this;
}

DCalendar.prototype.calculateNavigatorTitles = function(date, minDate, maxDate) {
	var n = this.noOfMonths;
	var mDate = date.getFirstDateOfMonth();
	minDate = minDate || this.minDate;
	maxDate = maxDate || this.maxDate;
	var cfg = this.config;
	var prevMonth = mDate.clone().addMonth(-1); // must be -1 and not -n
	if (minDate && prevMonth.before(minDate)) {
		prevMonth = minDate;
	}
	var prevMonthTitle = prevMonth.isSameMonth(mDate) ? "" : prevMonth.format(cfg.monthPattern);
	var nextMonth = mDate.clone().addMonth(n);
	if (maxDate && nextMonth.after(maxDate)) {
		nextMonth = maxDate;
	}
	var nextMonthTitle = nextMonth.isSameMonth(mDate) ? "" : nextMonth.format(cfg.monthPattern);
	if (n > 1) {
		var prevNTitle = prevMonthTitle;
		if (prevNTitle) {
			prevNTitle = mDate.clone().addMonth(-n).format(cfg.monthPattern) + " - " + prevNTitle;
		}
		var nextNTitle = nextMonthTitle;
		if (nextNTitle) {
			nextNTitle += " - " + mDate.clone().addMonth(2 * n - 1).format(cfg.monthPattern);
		}
		return { prevMonthTitle: prevNTitle, nextMonthTitle: nextNTitle	};
	}
	var prevYear = mDate.clone().addYear(-1);
	if (minDate && prevYear.before(minDate)) {
		prevYear = minDate;
	}
	var prevYearTitle = prevYear.isSameYear(mDate) ? "" : prevYear.format(cfg.monthPattern);
	var nextYear = mDate.clone().addYear(1);
	if (maxDate && nextYear.after(maxDate)) {
		nextYear = maxDate;
	}
	var nextYearTitle = nextYear.isSameYear(mDate) ? "" : nextYear.format(cfg.monthPattern);
	return {
		prevMonthTitle: prevMonthTitle, nextMonthTitle: nextMonthTitle,
		prevYearTitle: prevYearTitle, nextYearTitle: nextYearTitle
	};
}

DCalendar.prototype.calculateMonthOptions = function(date, minDate, maxDate) {
	var itDate = (date || this.offsetDate).clone();
	minDate = minDate || this.minDate;
	if (minDate) {
		minDate = minDate.getFirstDateOfMonth();
	}
	maxDate = maxDate || this.maxDate;
	if (maxDate) {
		maxDate = maxDate.getLastDateOfMonth();
	}
	var options = [];
	for (var i = 0; i < 12; i++) {
		itDate.setMonth(i, 1);
		if ((!minDate || itDate.compareTo(minDate) >= 0) && (!maxDate || itDate.compareTo(maxDate) <= 0)) {
			options.push({value: '' + itDate.getMonth(), text: this.config.months[i], selected: itDate.getMonth() == date.getMonth()});
		}
	}
	return options;
}

DCalendar.prototype.calculateYearOptions = function(date, minDate, maxDate) {
	date = date || this.offsetDate;
	var selYear = date.getFullYear();
	var minYear = (minDate || this.minDate || new Date().set(selYear - this.config.yearsBefore, 0, 1)).getFullYear();
	var maxYear = (maxDate || this.maxDate || new Date().set(selYear + this.config.yearsAfter, 0, 1)).getFullYear();
	var options = [];
	for (var i = minYear; i <= maxYear; i++) {
		options.push({value: '' + i, text: '' + i, selected: selYear == i});
	}
	return options;
}

DCalendar.prototype.onChangeMonth = function(e, select) {
	e = (e instanceof DEvent) ? e : g(e);
	e.preventDefault();
	if (this.fireHandler("onBeforeChangeMonth", [e, select])) {
		this.changeMonth(select);
	}
	this.fireHandler("onAfterChangeMonth", [e, select]);
	return false;
}

DCalendar.prototype.changeMonth = function(select) {
	var date = this.parseDateFromOptions(select);
	this.updatePeriod(date, select);
	return this;
}

DCalendar.prototype.onChangeYear = function(e, select) {
	e = (e instanceof DEvent) ? e : g(e);
	e.preventDefault();
	if (this.fireHandler("onBeforeChangeYear", [e, select])) {
		this.changeYear(select);
	}
	this.fireHandler("onAfterChangeYear", [e, select]);
	return false;
}

DCalendar.prototype.changeYear = function(select) {
	var date = this.parseDateFromOptions(null, select);
	var minDate = this.minDate;
	if (minDate && date.before(minDate)) {
		date = minDate;
	} else {
		var maxDate = this.maxDate;
		if (maxDate && date.after(maxDate)) {
			date = maxDate;
		}
	}
	this.updatePeriod(date, select);
	return this;
}

DCalendar.prototype.parseDateFromOptions = function(selMonth, selYear) {
	selMonth = selMonth || this.win.document.getElementById('selChangeMonth' + this.index + this.winRef);
	selYear = selYear || this.win.document.getElementById('selChangeYear' + this.index + this.winRef);
	return new Date().set(parseInt(selYear.options[selYear.selectedIndex].value, 10), parseInt(selMonth.options[selMonth.selectedIndex].value, 10), this.offsetDate.getDate());
}

DCalendar.prototype.renderPrevPeriod = function(e) {
	if (e) {
		DEvent.preventDefault(e); // this is necessary in IE8 if an onbeforeunload listener is assigned to the window object - otherwise this listener will be fired
	}
	var last = this.offsetDate.getFirstDateOfMonth().addMonth(-this.noOfMonths).getLastDateOfMonth();
	this.updatePeriod(last);
}

DCalendar.prototype.renderNextPeriod = function(e) {
	if (e) {
		DEvent.preventDefault(e); // this is necessary in IE8 if an onbeforeunload listener is assigned to the window object - otherwise this listener will be fired
	}
	var first = this.offsetDate.getFirstDateOfMonth().addMonth(this.noOfMonths);
	this.updatePeriod(first);
}

DCalendar.prototype.renderPrevYear = function(e) {
	if (e) {
		DEvent.preventDefault(e); // this is necessary in IE8 if an onbeforeunload listener is assigned to the window object - otherwise this listener will be fired
	}
	var last = this.offsetDate.getFirstDateOfMonth().addYear(-1).getLastDateOfMonth();
	var minDate = this.minDate;
	this.updatePeriod((minDate && last.before(minDate)) ? minDate : last);
}

DCalendar.prototype.renderNextYear = function(e) {
	if (e) {
		DEvent.preventDefault(e); // this is necessary in IE8 if an onbeforeunload listener is assigned to the window object - otherwise this listener will be fired
	}
	var first = this.offsetDate.getFirstDateOfMonth().addYear(1);
	var maxDate = this.maxDate;
	this.updatePeriod((maxDate && first.after(maxDate)) ? maxDate : first);
}

/* DDatePicker class - wraps a DCalendar instance */
function DDatePicker(dInput, config, calConfig, win) {
	this.dInput = dInput; // reference to the input element which will hold the chosen date
	this.config = Object.configure(config, this.constructor.defaultConfig);
	this.win = win || window; // refers to the window object in which the DOM elements reside - this is not necessarily the window in which the code reside!
	this.calConfig = Object.clone(calConfig);
	this.dCal = null;
	this.id = "";
	this.index = 0;
	this.initialized = false;
}

DDatePicker.instances = [];

DDatePicker.defaultConfig = {
	className: 'DDatePicker',
	position: 'absolute',
	showOnFocus: true,
	titleText: 'Date format: ', // specify null if you don't wan't any title attribute added to the input element
	helpText: '. Press CTRL + . to see keyboard shortcuts',
	keyboardText: 'Keyboard navigation:\n\n\
Previous date\t= CTRL + Arrow Left\n\n\
Next date\t\t= CTRL + Arrow Right\n\n\
Previous week\t= CTRL + Arrow Up\n\n\
Next week\t= CTRL + Arrow Down\n\n\
Previous month\t= CTRL + SHIFT + Arrow Left\n\n\
Next month\t= CTRL + SHIFT + Arrow Right\n\n\
Previous year\t= CTRL + SHIFT + Arrow Up\n\n\
Next year\t\t= CTRL + SHIFT + Arrow Down\n\n\
Select date\t= CTRL + SPACE\n\n\
Help\t\t= CTRL + .\n\nESC\t\t= Close\n\nNOTE:\n\nIn Opera on Mac the CTRL key is replaced with the APPLE key!\n\n',
	fadeIn: { to: .9, show: true }, // if a configuration object is specified the date picker will fade in - example: { to: .85, show: true }
	fadeOut: {}, // if a configuration object is specified the date picker will fade out - example: {}
	onBeforeShow: null, // a function (or handler object - an object literal with properties 'scope' and 'handleEvent') to invoke before showing the datepicker - return false to cancel showing
	onAfterShow: null, // a function (or handler object - an object literal with properties 'scope' and 'handleEvent') to invoke after showing the datepicker
	onBeforeHide: null, // a function (or handler object - an object literal with properties 'scope' and 'handleEvent') to invoke before hiding the datepicker - return false to cancel hiding
	onAfterHide: null, // a function (or handler object - an object literal with properties 'scope' and 'handleEvent') to invoke after hiding the datepicker
	onInit: null
}

DDatePicker.autoLoad = true;

DDatePicker.newInstance = function(dInput, config, calConfig, win) {
	var instance = new DDatePicker(dInput, config, calConfig, win);
	instance.index = DDatePicker.instances.length;
	DDatePicker.instances.push(instance);
	return instance;
}

DDatePicker.initAll = function() {
	q('.' + DDatePicker.defaultConfig.className).forEach(function(input) {
		DDatePicker.newInstance(input);
	});
	DDatePicker.instances.forEach(function(instance) {
		instance.init();
	});
	addEvent("resize", DDatePicker.adjustPositions);
}

DDatePicker.adjustPositions = function(e) {
	for (var i = 0, l = DDatePicker.instances.length; i < l; i++) {
		var instance = DDatePicker.instances[i];
		if (instance.isDisplayed()) {
			instance.adjustPosition(instance.dInput);
		}
	}
}

DDatePicker.hideAll = function(e) {
	var hide = true;
	if (e) {
		for (var i = 0, l = DDatePicker.instances.length; i < l; i++) {
			if (DDatePicker.instances[i].dInput.element === e.target) { // this check is necessary in order to support animation when showing/hiding the datepicker
				hide = false;
				break;
			}
		}
	}
	if (hide) {
		var f = function(instance) {
			if (e && instance.isDisplayed()) {
				instance.onHide(e);
			} else {
				instance.hide();
			}
		}
		if (window.remoteDatePickers) {
			window.remoteDatePickers.forEach(f);
		}
		DDatePicker.instances.forEach(f);
	}
}

DDatePicker.prototype.cName = "DDatePicker";

DDatePicker.prototype.toString = function() {
	return "[object DDatePicker] " + this.id;
}

DDatePicker.prototype.isDisplayed = function() {
	return this.dCal.dElement.isDisplayed();
}

DDatePicker.prototype.init = function() {
	if (!this.initialized) {
		this.dInput = g(this.dInput, null, this.win);
		if (this.win != window) { // important not to compare by reference as they're only equal by value in IE
			if (!this.win.remoteDatePickers) {
				this.win.remoteDatePickers = [];
			}
			this.win.remoteDatePickers.push(this);
		}
		var div = this.win.document.createElement("div"); // TODO: refactor
		this.id = DElement.getId(div); // give it a random id
		this.win.document.body.appendChild(div);
		var cfg = this.config;
		this.dCal = DCalendar.newInstance(div, Object.extendAll({}, this.calConfig, {
			updateFields: this.dInput,
			className: cfg.className,
			onBeforeSetSelectedDate: { scope: this, handleEvent: this.onBeforeSetSelectedDate },
			onAfterSetSelectedDate: { scope: this, handleEvent: this.onAfterSetSelectedDate }
		}), this.win).init();
		this.dCal.dElement.hide().prepareToMove(cfg.position || "absolute").on("mousedown", function(e) { e.stopPropagation(); }); // important to stop propagation otherwise the document onmousedown event listener will hide the datepicker
		if (cfg.showOnFocus) {
			this.dInput.on('focus', function(e) { DDatePicker.hideAll(); this.onShow(e); }.bindAsEventListener(this)).on("mousedown", function(e) { e.stopPropagation(); });
		}
		/*	The onKeyDown function must be associated with the keydown event as the keypress event is not triggered by tabbing in IE8
		 * 	and pressing ESC does not fire the keypress event either in (never) WebKit based browsers.
		 *	Only exception is Opera. Here it must be the keypress event. Note that in Opera on Mac the CTRL key (keycode is 0) is replaced with the APPLE key (keycode is 17). */
		this.dInput.on(dLib.ua.isOpera ? "keypress" : "keydown", this.onKeyDown.bindAsEventListener(this));
		if (typeof cfg.titleText == "string") {
			this.dInput.setAttribute('title', cfg.titleText + this.dCal.config.datePattern + cfg.helpText);
		}
		this.fireHandler("onInit");
	}
	return this;
}

DDatePicker.prototype.fireHandler = dLib.util.fireHandler;

DDatePicker.prototype.onShow = function(e) {
	if (this.fireHandler("onBeforeShow", [e])) {
		if (this.config.showOnFocus && !DDatePicker.mouseDownListener) {
			DDatePicker.mouseDownListener = dLib.event.add(this.win.document, "mousedown", DDatePicker.hideAll);
		}
		this.adjustPosition(e.getTarget()).show(!!e);
	}
	this.fireHandler("onAfterShow", [e]);
	return this;
}

DDatePicker.prototype.adjustPosition = function(dEl) {
	var pos = dEl.getPageOffset().plus([0, dEl.element.offsetHeight]);
	this.dCal.dElement.moveTo(pos);
	return this;
}

DDatePicker.prototype.show = function(fade) {
	this.dCal.render();
	var dEl = this.dCal.dElement;
	var cfg = this.config;
	if (fade && cfg.fadeIn) {
		// important to call show before calling setOpacity in IE6+7+8
		this.dCal.dElement.show().setOpacity(0).fadeIn(cfg.fadeIn);
	} else {
		if (cfg.fadeIn) {
			this.dCal.dElement.setOpacity(cfg.fadeIn.to);
		}
		this.dCal.dElement.show();
	}
	return this;
}

DDatePicker.prototype.showHelp = function() {
	alert(this.config.keyboardText || 'No help provided!');
	return this;
}

DDatePicker.prototype.onHide = function(e) {
	if (this.fireHandler("onBeforeHide", [e])) {
		if (DDatePicker.mouseDownListener) {
			dLib.event.remove(this.win.document, "mousedown", DDatePicker.mouseDownListener);
			DDatePicker.mouseDownListener = null;
		}
		this.hide(!!e);
	}
	this.fireHandler("onAfterHide", [e]);
	return this;
}

DDatePicker.prototype.hide = function(fade) {
	if (fade && this.config.fadeOut) {
		this.dCal.dElement.fadeOut(this.config.fadeOut);
	} else {
		this.dCal.dElement.hide();
	}
	return this;
}

DDatePicker.prototype.onKeyDown = function(e) {
	var isCtrl = false, isCtrlShift = false;
	if (e.isCtrlDown() && !e.isMetaDown()) {
		isCtrl = !e.isAltDown() && !e.isShiftDown();
		isCtrlShift = e.isShiftDown();
	}
	var c = this.dCal;
	var d = c.offsetDate.clone();
	switch (e.getKeyCode()) {
		// hide/close on TAB and ESC
		case 9:
		case 27:
			this.hide(!!e);
			break;
		// select date on SPACE - ENTER conflicts with submission of the form and preventDefault won't work in Opera (tested 10.53)
		case 32:
			if (c.dElement.isDisplayed() && (isCtrl || isCtrlShift)) {
				e.preventDefault();
				c.setSelectedDate(d);
				this.hide(!!e);
			}
			break;
		// show help on CTRL + .
		case 190: // keydown value
		case 46: // keypress value
			if (isCtrl) {
				e.preventDefault();
				this.showHelp();
			}
			break;
		default:
			if (e.isLeftArrowKey()) { // previous date
				if (isCtrl) {
					e.preventDefault();
					this.show();
					c.updatePeriod(d.prev());
				}
				else if (isCtrlShift) { // previous month/period
					e.preventDefault();
					this.show();
					c.renderPrevPeriod(e.event);
				}
			}
			else if (e.isRightArrowKey()) { // next date
				if (isCtrl) {
					e.preventDefault();
					this.show();
					c.updatePeriod(d.next());
				}
				else if (isCtrlShift) { // next month/period
					e.preventDefault();
					this.show();
					c.renderNextPeriod(e.event);
				}
			}
			else if (e.isUpArrowKey()) { // previous week
				if (isCtrl) {
					e.preventDefault();
					this.show();
					c.updatePeriod(d.add(-7));
				}
				else if (isCtrlShift) { // previous year
					e.preventDefault();
					this.show();
					c.renderPrevYear(e.event);
				}
			}
			else if (e.isDownArrowKey()) { // next week
				if (isCtrl) {
					e.preventDefault();
					this.show();
					c.updatePeriod(d.add(7));
				}
				else if (isCtrlShift) { // next year
					e.preventDefault();
					this.show();
					c.renderNextYear(e.event);
				}
			}
			break;
	}
	return this;
}

// this function is registered as an onAfterSetSelectedDate handler for the wrapped DCalendar instance
DDatePicker.prototype.onBeforeSetSelectedDate = function(e, cell, dCalendar) {
	var rv = this.fireHandler("onBeforeSetSelectedDate", [e, cell, dCalendar], this.calConfig);
	if (rv) {
		this.onHide(e);
	}
	return rv;
}

DDatePicker.prototype.onAfterSetSelectedDate = function(e, cell, dCalendar) {
	this.fireHandler("onAfterSetSelectedDate", [e, cell, dCalendar], this.calConfig);
	return this;
}

DCalendar.onDOMReadyListener = addDOMReadyListener(function() {
	DCalendar.initAll();
	DDatePicker.initAll();
	if (DDatePicker.autoLoad) {
		q('input.date[pattern]').forEach(function(ipt) {
			DDatePicker.newInstance(ipt, null, {
				datePattern: ipt.pattern
			}).init();
		});
	}
});