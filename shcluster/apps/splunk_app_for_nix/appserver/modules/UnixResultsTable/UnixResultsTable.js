Splunk.Module.UnixResultsTable = $.klass(Splunk.Module.DispatchingModule, {

    initialize: function($super, container) {
        $super(container);
        this.logger = Splunk.Logger.getLogger("sc_results_table.js");
        this.resultsContainer = $('.actual-container', this.container);
        this.doubleScrollbar = $('.double-scrollbar', this.container);

        // retrieve module load params that are server-bound
        this.loadParams = {
            'count': parseInt(this.getParam('count'), 10),
            'offset': parseInt(this.getParam('offset'), 10),
            'field_list': this.parseList(this.getParam('fieldList')),
            'postprocess': this.getParam('postprocess')
        };
        // initialize server-bound params
        this.params = {};
        // fill in load params in local cached params
        for (key in this.loadParams) {
            if (this.loadParams[key] !== null) {
                this.params[key] = this.loadParams[key];
            }
        }

        // initialize table settings
        this.settings = {
            displayRowNumbers: !!(Splunk.util.normalizeBoolean(this.getParam('displayRowNumbers'))),
            displayTopScrollbar: !!(Splunk.util.normalizeBoolean(this.getParam('displayTopScrollbar'))),
            drilldown: this.getParam("drilldown"),
            drilldownPrefix: this.getParam("drilldownPrefix"),
            initValueList: this.parseList(this.getParam('initValueList')),
            initResponse: null,
            fieldFormats: this.getParam("fieldFormats") || {},
            floatHead: !!(Splunk.util.normalizeBoolean(this.getParam("floatHead"))),
            sortFields: [], // ordered list of field names,
            sortOrders: [], // ordered list of field sort orders
            statusMsgLevel: 0 // 0 for info & above,  1 for error & above
        };

        // initialize internal state
        this._previousSID = null;
        this._selection = null;
        this._results = null;

        // upstream context constants
        this._CONTEXT_NAMESPACE = 'results';
        this._CONTEXT_FIELDS = ['count', 'offset', 'fields'];
        this._CONTEXT_INTEGER_FIELDS = ['count', 'offset'];
        this._CONTEXT_WARN_ON_COLLISION = ['fields'];
        this._CONTEXT_IGNORE_ON_COLLISION = ['count'];

        // data type identifiers
        this._LOADING_IDENTIFIER = '##_LOADING_##';
        this._SPARKLINE_IDENTIFIER = '##__SPARKLINE__##';
        // sparkline default settings
        this._SPARKLINE_DEFAULT_SETTINGS = {
            type: 'line',
            lineColor: '#008000',
            highlightSpotColor: null,
            minSpotColor: null,
            maxSpotColor: null,
            spotColor: null,
            fillColor: null
        };

        // field constants
        this._TIME_FIELD = '_time';
        this._RAW_FIELD = '_raw';     

        // setup rendering templates
        this.setupTemplate();
        // add params keys to context so they can be picked up by downstream modules 
        this.mergeLoadParamsIntoContext(this._CONTEXT_NAMESPACE, this._CONTEXT_FIELDS);

        // setup event handlers:
        // when any table header is clicked
        $('table thead', this.resultsContainer).live('click', this.onColHeaderClick.bind(this));
        if (this.settings.drilldown != 'none') {
            $('table tbody', this.resultsContainer).live('click', this.onRowClick.bind(this));
        }
        if (this.settings.drilldown == 'all') {
            $('table tbody', this.resultsContainer)
                .live('mouseover', this.onCellMouseOver.bind(this))
                .live('mouseout', this.onCellMouseOut.bind(this));
        }

        // simulate top horizontal scrollbar
        if (this.settings.displayTopScrollbar) {
            this.resultsContainer.scroll(function(){
                this.doubleScrollbar.scrollLeft(this.resultsContainer.scrollLeft());
            }.bind(this));
            this.doubleScrollbar.scroll(function(){
                this.resultsContainer.scrollLeft(this.doubleScrollbar.scrollLeft());
            }.bind(this));
        }

        // render placeholder data if specified
        if (this.settings.initValueList) {
            this.settings.initResponse = this.genPlaceholderReponse(this.settings.initValueList);
            this.settings.statusMsgLevel = 1; // Only show error messages
            this.renderResults(this.settings.initResponse, {responseType : 'PLACEHOLDER_RESPONSE'});
        }
    },

    parseList: function(value) {
        if (typeof value === "undefined" || value === null) {
            return null;
        }
        return Splunk.util.stringToFieldList(value);
    },

    genPlaceholderReponse: function(values) {
        var fields=[], result={}, i, l;
        for (i=0, l=values.length; i < l; i++) {
            fields.push('field_' + i);
            result['field_' + i] = values[i];
        }
        return {
            fields: fields,
            results: [result]
        };
    },

    setupTemplate: function() {
        // simple debug helper
        Handlebars.registerHelper('whatis', function(param) {
            console.debug(param);
        });

        Handlebars.registerHelper('display_row_number', function(settings, context, options) {
            // context = row
            var value = context && context.pos;
            return (settings.displayRowNumbers) ? 
                    "<td class='pos'>" + format_decimal(value) + "</td>" : "";
        });

        Handlebars.registerHelper('table_highlight_class', function(settings, context, options) {
            // context = null
            switch (settings.drilldown) {
                case 'all':
                    return 'table-hover-cell';
                    break;
                case 'row':
                    return 'table-hover-row';
                    break;
                default:
                    return '';
            }
        });

        Handlebars.registerHelper('display_value', function(settings, context, options) {
            // context = row.value
            var value = context && context.value,
                type = context && context.type,
                i, len;
            if ($.isArray(value)) {                
                for (i = 0, len = value.length; i < len; i++) {
                    value[i] = Splunk.util.escapeHtml(value[i]);
                }
                if (type == 'sparkline') {
                    // do not display pre-canvas values until sparkline is rendered to avoid numbers from showing
                    return "<span class='sparkline' style='visibility:hidden;'>" + value.join(',') + "</span>";
                } else {
                    return "<div class='mv'>" + value.join("</div><div class='mv'>") + "</div>";
                }
            } else {
                if (type == 'datetime') {
                    //var date_time_format = new DateTimeFormat(value, _i18n_locale);
                    return format_datetime_microseconds(value);
                } else if (type == 'loading') {
                    return "<div class='loading'></div>";
                } else {
                    return Splunk.util.escapeHtml(value);
                }
            }
        });

        Handlebars.registerHelper('display_status', function(context, options) {
            var type = context && context.type,
                msg = '';
            if (type == 'waiting-data') {
                msg = _('Waiting for data...');
            } else if (type == 'waiting-search') {
                msg = _('Waiting for search to complete...');
            } else if (type == 'nodata') {
                msg = _('No results found.');
                if (context.sid) {
                    var clickHandlerStr = "Splunk.window.openJobInspector('" + context.sid + "');return false;";
                    clickHandlerStr = clickHandlerStr.replace(/"/g, "&quot;"); // to make it html attribute safe
                    msg += " <span class='resultStatusHelp'>" +
                                "<a href='#' onclick=\"" + clickHandlerStr + "\" class='resultStatusHelpLink'>" +
                                    _('Inspect ...') +
                                "</a>" +
                           "</span>";
                }
            } else {
                var typeEscaped = Splunk.util.escapeHtml(type);
                msg = _("(unknown search state: " + typeEscaped + ")");
            }
            return msg;
        });

        this.tableTemplateSource =
            "<table class='table {{{table_highlight_class settings}}} table-striped'>" +
                "<thead>" +
                    "<tr> " +
                        "{{#if settings.displayRowNumbers}}<th class='pos'></th>{{/if}}" +
                        "{{#cols}}<th><a class='field' data-field='{{field}}' data-order='{{order}}'>" +
                            "<span>{{field}}</span><span class='colSort colSort{{order}}'>{{index}}</span>" +
                        "</th>{{/cols}}" +
                    "</tr>" +
                "</thead>" +
                "<tbody>" +
                    "{{#rows}}" +
                        "<tr>" +
                            "{{{display_row_number ../settings this}}}" +
                            "{{#values}}<td class='val'>{{{display_value ../settings this}}}</td>{{/values}}" +
                        "</tr>" +
                    "{{/rows}}" +
                "</tbody>" +
            "</table>";

        this.statusTemplateSource =
            "<p class='statusMessage'>" +
                "{{{display_status this}}}" +
            "</p>";

        this.tableTemplate = Handlebars.compile(this.tableTemplateSource);
        this.statusTemplate = Handlebars.compile(this.statusTemplateSource);
    },

    updateParams: function() {
        // fill in context passed fields in local cached params
        // override load params if both specified
        var i, len, key, form, postprocess,
            context = this.getContext(),
            search = context.get("search"),
            sid = search.job.getSID();
        
        if (!sid) {
            this.logger.error(this.moduleType, "sid unavailable");
            throw "sid unavailable";
        }

        // set sid param
        this.params.sid = sid;

        // get intermediate preview results whenever possible
        // preview is enabled for real-time searches
        if (search.job.isPreviewable()) {
            this.params.entity_name = 'results_preview';
        }

        // update params with upstream context
        form = context.get(this._CONTEXT_NAMESPACE);
        if (form) {
            // if context results namespace passed in object literal format
            for (i=0, len=this._CONTEXT_FIELDS.length; i < len; i++) {
                key = this._CONTEXT_FIELDS[i];
                if (form.hasOwnProperty(key)) {
                    if (this.loadParams[key] !== null) {
                        if ($.inArray(key, this._CONTEXT_IGNORE_ON_COLLISION) !== -1) { continue; }
                        if ($.inArray(key, this._CONTEXT_WARN_ON_COLLISION) !== -1) {
                            this.logger.warn(this.moduleType, key +
                                " is specified as load param and upstream context. Load param will be ignored.");
                        }
                    }
                    this.params[key] = form[key];
                }
            }
        } else {
            // if context results namespace passed in dot notation format (old way)
            for (i=0, len=this._CONTEXT_FIELDS.length; i < len; i++) {
                key = this._CONTEXT_FIELDS[i];
                var namespacedKey = this._CONTEXT_NAMESPACE + "." + key;
                if (context.has(namespacedKey)) {
                    if (this.loadParams[key] !== null) {
                        if ($.inArray(key, this._CONTEXT_IGNORE_ON_COLLISION) !== -1) { continue; }
                        if ($.inArray(key, this._CONTEXT_WARN_ON_COLLISION) !== -1) {
                            this.logger.warn(this.moduleType, key +
                                " is specified as load param and upstream context. Load param will be ignored.");
                        }
                    }
                    this.params[key] = context.get(namespacedKey);
                }
            }
        }
        for (i=0, len=this._CONTEXT_INTEGER_FIELDS.length; i < len; i++) {
            key = this._CONTEXT_INTEGER_FIELDS[i];
            this.params[key] = parseInt(this.params[key], 10);
        }

        // override postprocess string if set in search (likely by upstream)
        postprocess = search.getPostProcess() || "";
        // append sorting to postprocess string
        if (this.settings.sortFields.length > 0) {
            var sortClause = " | sort ";
            // add sort count to limit number of results to sort to current page count
            var sortCount = this.params.count + this.params.offset;
            if (Splunk.util.isInt(sortCount)) {
                sortClause += sortCount + " ";
            }
            // append all sort by field clauses.
            // Note: each field goes inside double quotes, so we escape any double quote chars
            // with literal 2-character value \", and before that, we have to lift all other
            // existing backslash literals up a level, by replacing all \  with \
            for (i=0, len=this.settings.sortFields.length; i < len; i++) {
                sortClause += ((this.settings.sortOrders[i] == 'Desc') ? '-' : '+') + "\"" +
                                this.settings.sortFields[i].replace(/\\/g, '\\\\').replace(/\"/g, '\\\"') + "\" ";
            }
            postprocess += sortClause;
        }
        if (postprocess !== "") {
            this.params.postprocess = postprocess;
        } else {
            this.params.postprocess = this.loadParams.postprocess;
            // delete postprocess only if not set by module load param
            if (! this.params.postprocess) {
                delete this.params.postprocess;
            }
        }
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * User interactions
     * ///////////////////////////////////////////////////////////////////
     */

    onCellMouseOver: function(event) {
        if (this.settings.drilldown != 'all') {
            return true;
        }

        var $target = $(event.target);
        var $cell = this.getTableDataCell($target);
        if ($cell.length === 0) {
            return false;
        }
        this.getFirstRowCell($cell).addClass('highlight');
        this.getColHeader($cell).addClass('highlight');
    },

    onCellMouseOut: function(event) {
        if (this.settings.drilldown != 'all') {
            return true;
        }

        var $target = $(event.target);
        var $cell = this.getTableDataCell($target);
        if ($cell.length === 0) {
            return false;
        }

        this.getFirstRowCell($cell).removeClass('highlight');
        this.getColHeader($cell).removeClass('highlight');
    },

    onRowClick: function(event) {
        var $target = $(event.target);

        // normal link clicks go through
        if ($target.is('a')) {
            return true;
        }
        
        // skip clicks on row number
        if ($target.is('pos')) {
            return false;
        }

        var old_selection, new_selection;
        // reset old selection
        if (this._selection) {
            old_selection = this._selection;
            this._selection.element.removeClass('selected');
            this._selection = null;
        }
        // set new selection
        new_selection = this.getSelection(event);
        if (new_selection &&
            (!old_selection || (old_selection && (new_selection.element[0] !== old_selection.element[0])))) {
            this._selection = new_selection;
            this._selection.element.addClass('selected');
        }

        // selection state will be put onto the context
        // via getModifiedContext. Just push context.
        this.pushContextToChildren();
    },

    onColHeaderClick: function(event) {
        event.preventDefault();

        var $target = $(event.target),
            $el = $target.closest('a.field');

        // target element must be within column field
        if ($el.length === 0) {
            return false;
        }

        var field = $el.data('field'),
            order = $el.data('order');

        // target element must be sortable
        if (! order) {
            return false;
        }

        // sequence of sort order selection upon sort click is:
        // 'Desc' -> 'Asc' -> None (i.e. removed from sort), and so on
        var idx = $.inArray(field, this.settings.sortFields);
        if (idx !== -1) {
            order = this.settings.sortOrders[idx];
            if (order == 'Desc') {
                this.settings.sortOrders[idx] = 'Asc';
            } else if (order == 'Asc') {
                // remove field from sort settings
                this.settings.sortFields.splice(idx, 1);
                this.settings.sortOrders.splice(idx, 1);
            }
        } else {
            // multi-column sorting only applies with alt+click
            if (! event.altKey) {
                // reset list of columns to sort with regular click
                this.settings.sortFields = [];
                this.settings.sortOrders = [];
            }
            this.settings.sortFields.push(field);
            this.settings.sortOrders.push('Desc');
        }
        this.getResults();
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * Helper functions
     * ///////////////////////////////////////////////////////////////////
     */

    getTableDataCell: function($el) {
        var $cell = $el.closest('td.val');
        return $cell;
    },

    isTableDataCell: function($cell) {
        if (! $cell.is('td.val')) {
            console.warn("[UnixResultsTable] internal error traversing table");
            return false;
        }
        return true;
    },

    getFirstRowCell: function($cell) {
        if (! this.isTableDataCell($cell)) { return false; }
        return $cell.parent().find('td.val:first');
    },

    getFirstRowCellValue: function($cell) {
        if (! this.isTableDataCell($cell)) { return false; }
        return this.getFirstRowCell($cell).text();
    },

    getColHeader: function($cell) {
        if (! this.isTableDataCell($cell)) { return false; }
        var cellColIdx = $cell.index();
        return $('table thead tr', this.resultsContainer).find('th:nth-child(' + (cellColIdx+1) + ')');
    },

    getColHeaderName: function($cell) {
        if (! this.isTableDataCell($cell)) { return false; }
        return this.getColHeader($cell).text();
    },

    getFirstColHeader: function() {
        return $('table thead tr', this.resultsContainer).find('th:not(".pos"):first');
    },

    getFirstColHeaderName: function() {
        return this.getFirstColHeader().text();
    },

    getSelection: function(event) {
        var $target = $(event.target),
            $cell = this.getTableDataCell($target),
            selection = {};

        if ($cell.length === 0) {
            return false;
        }

        if (this.settings.drilldown == 'none') {
            return false;

        } else if (this.settings.drilldown == 'all') {
            selection.element = $target;

            selection.name = this.getFirstColHeaderName();
            selection.value = this.getFirstRowCellValue($cell);

            selection.name2 = this.getColHeaderName($cell);
            selection.value2 = $target.text();

        } else if (this.settings.drilldown == 'row') {
            selection.element = $cell.closest('tr');

            selection.name = this.getFirstColHeaderName();
            selection.value = this.getFirstRowCellValue($cell);

            selection.name2 = selection.name;
            selection.value2 = selection.value;
        }

        if (selection.name == "_time") {
            var $rowCell = this.getFirstRowCell($cell);
            selection.timeRange = this.getTimeRangeFromCell($rowCell);
        }

        return selection;
    },

    /** 
     * Look for timerange attributes on the given tablecell
     * and return a Splunk.TimeRange instance.
     *  
     * @param {Object} element A jQuery cell element reference.
     * @type Object
     * @return an instance of Splunk.TimeRange
     */     
    getTimeRangeFromCell: function($rowCell) {
        var startTime   = $rowCell.attr("startTime");
        var endTime     = $rowCell.attr("endTime");
        // if we only have one _time value, then we throw away the milliseconds and return a timeRange around
        // that single second.
        if (!endTime) {
            startTime = parseInt(startTime, 10);
            endTime = startTime + 1;
        }
        return new Splunk.TimeRange(startTime, endTime);
    },

    getFieldFormat: function(fieldName, type) {
        var fieldFormats = this.settings.fieldFormats;
        var tryFields = [fieldName, '*'];
        for (var i=0, len=tryFields.length; i<len; i++) {
            if (fieldFormats[tryFields[i]]) {
                match = $.grep(fieldFormats[tryFields[i]], function(entry) {
                    return entry.type == type;
                });
                if (match) {
                    return match[0];
                }
            }
        }
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * Hook ups to module system
     * ///////////////////////////////////////////////////////////////////
     */

    /**
     * If currently holding a _selection state, Table module will pass on
     * that selection details to downstream modules.
     */
    getModifiedContext: function() {
        var context = this.getContext(),
            namespace = this.settings.drilldownPrefix,
            form = context.get(namespace) || {};

        if (this._selection) {
            for (key in this._selection) {
                form[key] =  this._selection[key];
            }
            context.set(namespace, form);
            
            var search = context.get("search");
            var searchRange = search.getTimeRange();
            
            var searchModified = false;
            // if the selection itself has a timeRange (ie this is a timechart or an event click)
            // then we use that.
            if (this._selection.timeRange) {
                search.setTimeRange(this._selection.timeRange);
                searchModified = true;
            // otherwise, if this is a relative or realtime search.
            // then we take the current absolute-time snapshot FROM THE JOB
            // and use that as the drilldown timerange.
            } else if (!searchRange.isAbsolute() && !searchRange.isAllTime()) {
                var job = this.getContext().get("search").job;
                search.setTimeRange(job.getTimeRange());
                searchModified = true;
            }

            // push the modified search back into the context.
            if (searchModified) {
                context.set("search", search);
            }
        }

        // Since Tables can be paged, and can now contain child modules, and
        // those child modules can themselves be paged,  it's important to
        // clear out offset information, as well as the call back for the
        // master/slave paginator logic.
        context.set("results.offset", 0);
        context.set("results.upstreamPaginator", null);
        
        return context;
    },

    getResultParams: function($super) {
        var params = $super();
        // include updated fresh copy of params
        this.updateParams();
        $.extend(params, this.params);
        return params;
    },

    onContextChange: function() {
        var context = this.getContext(),
            search = context.get("search"),
            sid = search.job.getSID(),
            count = Number(context.get('results.count')),
            offset = Number(context.get('results.offset'));

        // handle a new search
        if (sid != this._previousSID) {
            // reset sort by fields settings
            this.settings.sortFields = [];
            this.settings.sortOrders = [];
            // reset ui
            this.resetUI();
            this._previousSID = sid;
        }

        if (count && isNaN(count) === false) {
            this.params['count'] = count;
        }

        if (offset && isNaN(offset) === false) {
            this.params['offset'] = offset;
        }

        // if job done or running with some results ready, call getResults right away
        if (search.isJobDispatched() && (search.job.isDone() || (search.job.getEventCount() > 0))) {
            this.getResults();
        }
    },

    onJobProgress: function(event) {
        var context = this.getContext(),
            search = context.get("search");

        if (!search.job.isPreviewable() && !search.job.isDone()) {
            this.renderStatusMsg('waiting-search');
        } else {
            this.getResults();
        }
    },

    onJobDone: function(event) {
        this.getResults(); 
    },

    resetUI: function() {
        // if placeholder response specified, use it as reset state
        if (this.settings.initResponse) {
            this.renderResults(this.settings.initResponse, {responseType : 'PLACEHOLDER_RESPONSE'});
        } else {
            this.resultsContainer.html("");
        }
    },

    getDataTypeValue: function(data, field) {
        var type, value,
            i, len;
        if ($.isArray(data)) {
            if ((typeof data[0] !== undefined) && (data[0] == this._SPARKLINE_IDENTIFIER)) {
                type = "sparkline";
                data.shift();
            } else {
                type = "mv";
            }
        } else {
            if (field && field == this._TIME_FIELD) {
                type = "datetime";
                var date = new Date(data);
                data = new DateTime(date);
                // TODO: Remove when SPL-67077 fixed
                data.microsecond = date.getMilliseconds() * 1000;
            } else if (data == this._LOADING_IDENTIFIER ) {
                type = "loading";
                data = '';
            } else {
                type = "string";
            }
        }
        return {
            type: type,
            value: data
        };
    },

    renderStatusMsg: function(type, sid) {
        var htmlFragment;
        if ((this.settings.statusMsgLevel === 0) ||
            (this.settings.statusMsgLevel === 1 && type =='nodata')) {
            htmlFragment = this.statusTemplate({type: type, sid: sid});
            this.resultsContainer.html(htmlFragment);
        }
    },

    renderResults: function(response, options) {
        if (!response) {
            this.logger.error(this.moduleType, "search results unavailable");
            return false;
        }
        // cache copy of results
        this._results = $.extend(true, {}, response);

        var fields = response && response.fields;
        var results = response && response.results;
        var cols = [], rows = [];
        var field, idx, i, j, len;

        // deal with empty results
        if (!results || results.length === 0) {
            var context = this.getContext(),
                search = context.get("search"),
                job = search.job,
                sid = job.getSID();

            if (job.isPreviewable()) {
                this.renderStatusMsg('waiting-data', sid);
            } else {
                this.renderStatusMsg('nodata', sid);
            }
            this.onResultsRendered(options);
            return;
        }

        // collect table column headers data
        for (i=0, len=fields.length; i < len; i++) {
            field = fields[i];
            idx = $.inArray(field, this.settings.sortFields);
            cols.push({
                field: fields[i],
                order: (idx !== -1) ? this.settings.sortOrders[idx] : 'None',
                index: (idx !== -1 && this.settings.sortOrders.length > 1) ? idx+1 : ''
            });
        }
        // collect table row data
        for (i=0, len=results.length; i < len; i++) {
            var result = results[i],
                values = [];
            for (j=0; j < fields.length; j++) {
                field = fields[j];
                values.push(this.getDataTypeValue(result[field], field));
            }
            rows.push({
                pos: this.params.offset + i + 1,
                values: values
            });
        }
        var data = {
            settings: this.settings,
            cols: cols,
            rows: rows
        };

        var htmlFragment = this.tableTemplate(data);
        this.resultsContainer.html(htmlFragment);
        
        // draw sparklines when table is rendered
        var $sl = $('span.sparkline', this.resultsContainer),
            that = this;
        $sl.each(function() {
            var $el = $(this),
                $cell = that.getTableDataCell($el),
                fieldName = that.getColHeaderName($cell),
                fieldFormat = that.getFieldFormat(fieldName, 'sparkline'),
                sparklineSettings = fieldFormat ? fieldFormat.options : that._SPARKLINE_DEFAULT_SETTINGS;

            $el.sparkline('html', sparklineSettings).css('visibility','');
        });

        // make table head float
        if (this.settings.floatHead) {
            $('table', this.resultsContainer).floatHead();
        }

        // extend width of top scrollbar as soon as browser had
        // the chance to render table + sparklines to have the right width
        if (this.settings.displayTopScrollbar) {
            window.setTimeout(function(){
                var containerWidth = that.resultsContainer.width(),
                    tableWidth = that.resultsContainer.find('table').width();
                if (tableWidth > containerWidth) {
                    that.doubleScrollbar.find('div')
                        .width(tableWidth)
                        .show();
                }
            }, 1); 
        }

        this.onResultsRendered(options);
    },

    // callback to override for post results rendering
    onResultsRendered: function() {
        return true;
    }
});
