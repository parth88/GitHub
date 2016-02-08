(function($, _, i18n, undefined) {

function MDSortable(arr) {
    this.values = arr;
    this.valueOf = function () {
    }
}

Splunk.Module.CFResultsTable = $.klass(Splunk.Module.UnixBaseAbstractFactoryFactory, {

    initialize: function($super, container) {
        $super(container);
        this.logger = Splunk.Logger.getLogger("sc_results_table.js");
        this.resultsContainer = $('.actual-container', container);
        this.doubleScrollbar = $('.double-scrollbar', container);
        this.iframeContainer = $('.overlay', container);
        this.iframeContainer.bind('click', this.exitModal.bind(this));
        this.modalX = $('.button-collapse', container);
        this.modalX.on('click', this.exitModal.bind(this));
        this.iframe = $('iframe.CFResultsTable', container);
        this.setupIframe();
        this.offset = 0;
        this.drilldownToken = this.getParam("drilldownToken");
        this.urlStorage = new this.URLStorage('Splunk.Module.CFResultsTable', this.moduleId, false, this.drilldownToken);
        this.selectedSid = this.urlStorage.load();

        var field_alias_list = (this.getParam('fieldList') || "").split(","),
            field_list = field_alias_list.map(function(d) {
                var f = d.split(':', 2);
                if (f.length < 2)
                    f.push(f[0]);
                return f;
            });

        // retrieve module load params that are server-bound
        this.loadParams = {
            'count': parseInt(this.getParam('count'), 10),
            'field_list': field_list.map(function(d) { return d[0].trim(); }),
            'th_list': field_list.map(function(d) { return d[1].trim(); })
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
            drilldown: this.getParam("drilldown"),
            drilldownPrefix: this.getParam("drilldownPrefix"),
            initValueList: this.parseList(this.getParam('initValueList')),
            customFields: this.getParam('customFields') || [],
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
        this._CONTEXT_NAMESPACE = 'crossfilter';
        this._CONTEXT_FIELDS = ['count', 'fields'];
        this._CONTEXT_INTEGER_FIELDS = ['count'];
        this._CONTEXT_WARN_ON_COLLISION = ['fields'];

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
        this._TIME_FIELD = 'trigger_time';
        this._HOSTS_FIELD = 'hosts';
        this._RAW_FIELD = '_raw';     

        // setup rendering templates
        this.setupTemplate();
        // add params keys to context so they can be picked up by downstream modules 
        this.mergeLoadParamsIntoContext(this._CONTEXT_NAMESPACE, this._CONTEXT_FIELDS);

        // setup event handlers:
        // when any table header is clicked
        this.resultsContainer.on('click', 'table thead', this.onColHeaderClick.bind(this));
        if (this.settings.drilldown != 'none') {
            this.resultsContainer.on('table tbody', 'click', this.onRowClick.bind(this));
        }
        if (this.settings.drilldown == 'all') {
            this.resultsContainer
                .on('mouseover', 'table tbody', this.onCellMouseOver.bind(this))
                .on('mouseout', 'table tbody', this.onCellMouseOut.bind(this));
        }

        this.container.attr({
            'data-update': '',
            'data-reset': ''
        }).bind('cf.update', this.updateTable.bind(this));

        // simulate top horizontal scrollbar
        this.resultsContainer.scroll(function(){
            this.doubleScrollbar.scrollLeft(this.resultsContainer.scrollLeft());
        }.bind(this));
        this.doubleScrollbar.scroll(function(){
            this.resultsContainer.scrollLeft(this.doubleScrollbar.scrollLeft());
        }.bind(this));

        // render placeholder data if specified
        if (this.settings.initValueList) {
            this.settings.initResponse = this.genPlaceholderReponse(this.settings.initValueList);
            this.settings.statusMsgLevel = 1; // Only show error messages
            this.tableResults();
        }

        if(_.isString(this.selectedSid)){
            this.openModal(this.selectedSid);
        }
    },

    setupIframe: function() {
        var that = this;

        this.iframe.load(function(e) {
            var self = $(this),
                min_width = 400,
                min_height = 200;

            if (self.attr('src') !== undefined) {
                // assumptoin: first 'body > div' wraps around the whole
                // iframed page
                var content = self.contents().find('body > div:first-child'),
                    button = that.modalX,
                    w = $(window).width(),
                    h = $(window).height(),
                    cw = Math.max(content.outerWidth(), min_width),
                    ch = Math.max(content.outerHeight(), min_height),
                    left = Math.max((w-cw)/2, w/4),
                    top = Math.max((h-ch)/2, 20);

                self.css({width: cw, height: ch, left: left, top: top});
                button.css({left: left + cw - 30, top: top + 10});

                self.show();
                button.show();

                if (that.timer !== undefined)
                    window.clearInterval(that.timer);

                that.timer = window.setInterval(function() {
                    cw = Math.max(content.outerWidth(), min_width);
                    ch = Math.max(content.outerHeight(), min_height);

                    if (self.width() !== cw || self.height() !== ch) {
                        left = Math.max((w-cw)/2, w/4);
                        top = Math.max((h-ch)/2, 20);
                        self.css({width: cw, height: ch, left: left, top: top});
                        button.css({left: left + cw - 30, top: top + 10});
                    }
                }, 1000);
            }
        });
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
            return;
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
                    return "<span class='sparkline'>" + value.join(',') + "</span>";
                } else {
                    return "<div class='mv'>" + value.join("</div><div class='mv'>") + "</div>";
                }
            } else {
                if (type == 'datetime') {
                    //var date_time_format = new DateTimeFormat(value, _i18n_locale);
                    return format_datetime(value);
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
                            "<span>{{header}}</span><span class='colSort colSort{{order}}'>{{index}}</span>" +
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
        var i, len, key, form,
            context = this.getContext(),

        // update params with upstream context
        form = context.get(this._CONTEXT_NAMESPACE);
        if (form) {
            // if context results namespace passed in object literal format
            for (i=0, len=this._CONTEXT_FIELDS.length; i < len; i++) {
                key = this._CONTEXT_FIELDS[i];
                if (form.hasOwnProperty(key)) {
                    if (this.loadParams[key] !== null && $.inArray(key, this._CONTEXT_WARN_ON_COLLISION)) {
                        this.logger.warn(this.moduleType, key +
                            " is specified as load param and upstream context. Load param will be ignored.");
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
                    this.params[key] = context.get(namespacedKey);
                }
            }
        }
        for (i=0, len=this._CONTEXT_INTEGER_FIELDS.length; i < len; i++) {
            key = this._CONTEXT_INTEGER_FIELDS[i];
            this.params[key] = parseInt(this.params[key], 10);
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
        this.tableResults();
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
            console.warn("[CFResultsTable] internal error traversing table");
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

        if (selection.name == "trigger_time") {
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
            namespace = context.get('namespace'),
            nsobj = context.get(namespace),
            dataset = context.get('crossfilter'),
            controller = context.get(this.namespace + '_controller');

        this.showLoadingIndicator();
        this.offset = parseInt(context.get('results.offset'), 10);

        if (dataset !== undefined && dataset !== null && nsobj) {
            var count = dataset.groupAll().reduceCount().value();
            this.hideLoadingIndicator();

            this.tableResults({responseType : 'PLACEHOLDER_RESPONSE'});
        } else {
            this.resultsContainer.find('table').remove();
        }
    },

    resetUI: function() {
        // if placeholder response specified, use it as reset state
        if (this.settings.initResponse) {
            this.tableResults({responseType : 'PLACEHOLDER_RESPONSE'});
        }
        //this.resultsContainer.html("");
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
                var date = new Date(Number(data)*1000);
                data = new DateTime(date);
                // TODO: Remove when SPL-67077 fixed
                data.microsecond = date.getMilliseconds() * 1000;
            } else if ( field && field == this._HOSTS_FIELD) {
                var list = data.split(' '),
                    length = list.length-1;
                if (list.length === 0) {
                    data = list[0];
                } else if (list.length > 1) {
                    data = list[0] + ' (and ' + length + ' more hosts)';
                }
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

    tableResults: function() {
        
        var that = this,
            context = this.getContext(),
            namespace = context.get('namespace'),
            nsobj = context.get(namespace),
            dataset = context.get('crossfilter'),
            controller = context.get(this.namespace + '_controller');

        if (dataset !== undefined && dataset !== null && nsobj) {
            if (dataset.groupAll().value() === 0) {
                this.resultsContainer.html('<p class="resultStatusMessage empty_results">No alerts found.</p>');
                return;
            }

            var all_fields = context.get('fields'),
                fields = this.params.field_list,
                headers = this.params.th_list,
                sortfield = (this.settings.sortFields && this.settings.sortFields[0]) || 'trigger_time',
                sortorder = (this.settings.sortOrders && this.settings.sortOrders[0]) || 'Desc',
                dim = dataset.dimension(function(d) { return d[sortfield]; }),
                results = sortorder === 'Desc' ? dim.top(Infinity) : dim.bottom(Infinity),    // TODO: handle multi-sort
                offset = this.offset,
                count = parseInt(context.get('results.count') || this.params['count'], 10),
                cols = [],
                fieldmap = {},
                rows = [],
                field, idx, i, j, len;

            // collect table column headers data
            for (i=0, len=fields.length; i < len; i++) {
                field = fields[i];
                idx = $.inArray(field, this.settings.sortFields);
                fieldmap[field] = cols.length;
                cols.push({
                    field: field,
                    header: headers[i],
                    order: (idx !== -1) ? this.settings.sortOrders[idx] : 'None',
                    index: (idx !== -1 && this.settings.sortOrders.length > 1) ? idx+1 : ''
                });
            }
            // collect table row data
            for (i=offset, len=Math.min(offset+count, results.length); i < len; i++) {
                var result = results[i],
                    values = [];
                for (j=0; j < fields.length; j++) {
                    field = fields[j];
                    values.push(this.getDataTypeValue(result[field], field));
                }
                rows.push({
                    pos: result._offset,
                    values: values
                });
            }

            var data = {
                settings: this.settings,
                fieldmap: fieldmap,
                cols: cols,
                rows: rows
            };
            var htmlFragment = this.tableTemplate(data);
            this.resultsContainer.html(htmlFragment);
            
            // make table head float
            if (this.settings.floatHead) {
                $('table', this.resultsContainer).floatHead();
            }

            // apply custom field styles and cell data manipulations
            this._customizeFields(results, fieldmap);

            dim.remove();

            // extend width of top scrollbar as soon as browser had
            // the chance to render table + sparklines to have the right width
            window.setTimeout(function(){
                var containerWidth = that.resultsContainer.width(),
                    tableWidth = that.resultsContainer.find('table').width();
                if (tableWidth > containerWidth) {
                    that.doubleScrollbar.find('div')
                        .width(tableWidth)
                        .show();
                }
            }, 1);

            this.onResultsRendered();
        }
    },

    _customizeFields: function(results, fieldmap) {
        // apply custom field styles and cell data manipulations

        var module = this,
            custom_fields = this.settings.customFields,
            headers = this.params.th_list,
            fields = this.params.field_list,
            patt = /[^a-zA-Z_0-9]/,
            names = Object.getOwnPropertyNames(custom_fields);

        for (i = 0, len=names.length; i < len; i++) {
            var name = names[i],
                idx = headers.indexOf(name);
            if (idx !== -1) {
                var field = custom_fields[name],
                    field_actions = Object.getOwnPropertyNames(field),
                    selector = "table tbody tr td:nth-child(" + (idx + 1) + ")",
                    nodes = $(selector, this.resultsContainer),
                    app = encodeURIComponent(Splunk.util.getCurrentApp()),
                    clsname = 'CFResultsTable_' + name + '_',
                    offset = module.offset;

                nodes.each(function(node_idx) {
                    var self = $(this),
                        celltext = self.text(),
                        len = field_actions.length;

                    for (j = 0; j < len; j++) {
                        var action = field_actions[j],
                            action_param = field[action],
                            row = results[node_idx+offset];
                        if (action === 'style') {
                            if (!patt.test(name)) {
                                var value = celltext.replace(/ /g, "_");
                                if (action_param !== undefined && action_param !== null) {
                                    self.addClass(action_param);
                                }
                                if (!patt.test(value)) {
                                    self.addClass(clsname + value);
                                }
                            } else {
                                module.logger.error('Illegal field name', name);
                            }
                        } else if (action === 'collapse') {
                            var maxcount = Number(action_param),
                                value = row[fields[idx]],
                                len = value.length,
                                i;

                            if ($.isArray(value) && len > maxcount) {
                                var value_cut = value.slice(0, maxcount);
                                self.html("<div class='mv'>" +
                                        value_cut.join("</div><div class='mv'>") +
                                        "</div><div class='mv'>(and " +
                                        (len - maxcount) + 
                                        " more)</div>");
                            }
                        } else if (action === 'link') {
                            var text = action_param.text || celltext,
                                val = action_param.url.replace(/\$value\$/g, encodeURIComponent(celltext)),
                                mode = action_param.mode || "new",
                                url = action_param.url,
                                val = url,
                                $el,
                                tokens = _.uniq(url.match(/\$([^\$]+)\$/g)),
                                len, i;

                            for (i = 0, len=tokens.length; i < len; i++) {
                                var token = tokens[i],
                                    target = token.slice(1, -1),
                                    colidx = fieldmap[target];
                                if (target === 'value') {
                                    val = val.replace(/\$value\$/g, celltext);
                                } else if (colidx !== undefined) {
                                    val = val.replace(token, row[target], 'g')
                                }
                            }

                            if (!val.match(/^http[s]?:\/\//))
                                val = Splunk.util.make_url(val);

                            if (mode === "new")
                                self.html('<a href="' + val + '" target="_blank">' + text + '</a>');
                            else if (mode === "modal") {
                                self.html('<a href="#">' + text + '</a>');
                                $el = $('a', this).bind('click', function(e) {
                                    var iframe = module.iframe,
                                        overlay = module.iframeContainer;

                                    iframe.attr('src', val);
                                    overlay.show();
                                });
                            } else if (mode === "current")
                                self.html('<a href="' + val + '">' + text + '</a>');
                        }
                    }
                });
            }
        }
    },

    openModal: function(sid){
        var app = Splunk.util.getCurrentApp(),
            url = Splunk.util.make_url('/custom/'+app+'/unixalertevents/'+app+'/id/'+sid);
            
        this.iframe.attr('src', url);
        this.iframeContainer.show();
    },

    // callback to override for post results rendering
    onResultsRendered: function() {
        return true;
    },

    updateTable: function() {
        this.offset = 0;
        this.tableResults();
    },

    exitModal: function() {
        this.iframeContainer.hide();
        this.iframe.hide();
        this.modalX.hide();
        window.clearInterval(this.timer);
        $('>*', this.iframe).remove();
    }
});

}(UnixjQuery, UnixUnderscore, _));
