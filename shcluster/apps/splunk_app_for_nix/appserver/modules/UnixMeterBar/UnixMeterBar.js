(function($, undefined) {

Splunk.Module.UnixMeterBar = $.klass(Splunk.Module.DispatchingModule, {

    initialize: function($super, container) {
        var $label;
        $super(container);
        // cast container jQ object into jQ object using passed $ instance
        // (instead of whatever core used for original container jQ object)
        this.$container = $(this.container);

        // initialize module params
        this.params = {
            value: parseInt(this.getParam("value"), 10) || false,
            max: parseInt(this.getParam("max"), 10),
            usePercentageValue: !!(Splunk.util.normalizeBoolean(this.getParam('usePercentageValue'))),
            decimalPointDigits: parseInt(this.getParam('decimalPointDigits'), 10),
            gaugeColors: this.getParam("gaugeColors"),
            rangeValues: this.getParam("rangeValues"),
            label: this.getParam("label"),
            width: this.getParam("width"),
            height: this.getParam("height")
        };

        // set internal state
        this._results = null;

        // parse colors & values ranges:
        this.mapGaugeColors(this.params.gaugeColors);
        this.mapRangeValues(this.params.rangeValues);

        // setup progress bar
        this.$bar = $('.UnixMeterBarContent', this.$container);
        this.$bar.progressbar({
            max: this.params.max,
            value: this.params.value
        });

        // cache needed elements
        this.$barValue = this.$bar.find(".ui-progressbar-value");
        this.$labelLeft = $('.UnixMeterBarLabelLeft', this.$container);
        this.$labelRight = $('.UnixMeterBarLabelRight', this.$container);

        // apply width, height to container when applicable
        this.setHeight(this.params.height);
        this.setWidth(this.params.width);

        // add label if any
        if (this.params.label !== null) {
            this.$labelLeft.append(this.params.label);
        }
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * General utilities mostly from following modules
     * (copied here instead of requiring ~290KB file):
     * Splunk.JSCharting.AbstractGauge,
     * Splunk.JSCharting.MathUtils,
     * Splunk.JSCharting.ParsingUtils
     * ///////////////////////////////////////////////////////////////////
     */

    parseUtils: {
        stringToArray: function(str) {
            var strLen = str.length;

            if(str.charAt(0) !== '[' || str.charAt(strLen - 1) !== ']') {
                return false;
            }
            str = str.substr(1, strLen - 2);
            return Splunk.util.stringToFieldList(str);
        },

        stringToHexArray: function(colorStr) {
            var i, hexColor,
                colors = this.stringToArray(colorStr);

            if(!colors) {
                return false;
            }
            for(i = 0; i < colors.length; i++) {
                hexColor = parseInt(colors[i], 16);
                if(isNaN(hexColor)) {
                    return false;
                }
                colors[i] = hexColor;
            }
            return colors;
        }
    },

    mathUtils: {
        // an extended version of parseFloat that will handle numbers encoded in hex format (i.e. "0xff")
        // and is stricter than that native JavaScript parseFloat for decimal numbers
        parseFloat: function(str) {
            // determine if the string is a hex number by checking if it begins with '0x' or '-0x', in which case delegate to parseInt with a 16 radix
            if(/^( )*(0x|-0x)/.test(str)) {
                return parseInt(str, 16);
            }
            // if the number is not in decimal or scientific format, return NaN explicitly instead of letting JavaScript do its loose parsing
            if(!(/^[-+]?[0-9]*[.]?[0-9]*$/.test(str) || (/^[-+]?[0-9][.]?[0-9]*e[-+]?[1-9][0-9]*$/).test(str))) {
                return NaN;
            }
            return parseFloat(str);
        }
    },

    mapGaugeColors: function(value) {
        if(!value) {
            return;
        }
        var colors = this.parseUtils.stringToHexArray(value);
        if(colors && colors.length > 0) {
            this.colors = colors;
        }
    },

    mapRangeValues: function(value) {
        var i, rangeNumber,
            prevRange = -Infinity,
            unprocessedRanges = this.parseUtils.stringToArray(value),
            ranges = [];

        for(i = 0; i < unprocessedRanges.length; i++) {
            rangeNumber = this.mathUtils.parseFloat(unprocessedRanges[i]);
            if(isNaN(rangeNumber)) {
                // ignore the entire range list if an invalid entry is present
                return;
            }
            // de-dupe the ranges and ensure ascending order
            if(rangeNumber > prevRange) {
                ranges.push(rangeNumber);
                prevRange = rangeNumber;
            }
        }
        // if we couldn't extract at least two valid range numbers, ignore the list altogether
        if(!ranges || ranges.length < 2) {
            return;
        }
        this.ranges = ranges;
        this.rangesCameFromXML = true;
    },

    getFillColor: function(value) {
        var i;
        for(i = 0; i < this.ranges.length - 2; i++) {
            if(value < this.ranges[i + 1]) {
                break;
            }
        }
        return (this.colors) ? this.colors[i % this.colors.length] : 0x000000;
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * Rendering abstraction helpers
     * ///////////////////////////////////////////////////////////////////
     */

    setHeight: function(value) {
        this.$bar.height(value);
    },

    setWidth: function(value) {
        this.$container.width(value);
    },

    setValue: function(value) {
        this.$bar.progressbar("value", value);
    },

    setText: function(text) {
        this.$labelRight.text(text || "");
    },

    setColor: function(hexNum) {
        this.$barValue.css({
            "background": (hexNum ? "#" + hexNum.toString(16) : '')
        });
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * Hook ups to module system
     * ///////////////////////////////////////////////////////////////////
     */

    onContextChange: function() {
        var context = this.getContext(),
            search = context.get("search"),
            sid = search.job.getSID();

        // handle a new search
        if (sid != this._previousSID) {
            // reset ui
            this.resetUI();
            this._previousSID = sid;
        }

        // if job done or running with some results ready, call getResults right away
        if (search.isJobDispatched() && (search.job.isDone() || (search.job.getEventCount() > 0))) {
            this.getResults();
        }
    },

    onJobProgress: function(event) {
        var context = this.getContext(),
            search = context.get("search");

        if (search.job.isPreviewable() || search.job.isDone()) {
            this.getResults();
        }
    },

    onJobDone: function(event) {
        this.getResults(); 
    },

    resetUI: function() {
        this.setValue(false);
        this.setColor();
        this.setText();
    },

    invalidateUI: function() {
        this.setValue(0);
        this.setColor();
        this.setText("N/A");
    },

    getResultParams: function($super) {
        var params = $super(),
            context = this.getContext(),
            search = context.get("search"),
            sid = search.job.getSID();
        
        if (!sid) {
            console.error(this.moduleType, "sid unavailable");
            throw "sid unavailable";
        }

        // set sid param
        params.sid = sid;
        // only looking for 1 result
        params.count = 1;

        // get intermediate preview results whenever possible
        // preview is enabled for real-time searches
        if (search.job.isPreviewable()) {
            params.entity_name = 'results_preview';
        } else {
            params.entity_name = 'results'
        }

        return params;
    },

    // override module URL to point to UnixResultsTable
    getResultURL: function(params) {
        var uri = Splunk.util.make_url('module', 'system', 'Splunk.Module.UnixResultsTable', 'render');
        params = params || {};
        uri += '?' + Splunk.util.propToQueryString(params);
        return uri;
    },

    renderResults: function(response, options) {
        if (!response) {
            console.error(this.moduleType, "search results unavailable");
            return false;
        }
        // cache copy of results
        this._results = $.extend(true, {}, response);

        var fields = response && response.fields;
        var results = response && response.results;

        // deal with empty results
        if (!results || !fields || results.length === 0 || fields.length === 0) {
            var context = this.getContext(),
                search = context.get("search"),
                job = search.job,
                sid = job.getSID();

            if (!job.isPreviewable()) {
                console.warn(this.moduleType, "no results to render: sid =", sid);
                this.invalidateUI();
            }
            this.onResultsRendered(options);
            return;
        }

        // update progress bar value with first result field value
        var value = parseFloat(results[0] && results[0][fields[0]]);
        if (isNaN(value)) {
            console.warn(this.moduleType, "cannot render non-numeric result: sid =", sid);
            this.invalidateUI();
            this.onResultsRendered(options);
            return;
        }
        try {
            value = parseFloat(value.toFixed(this.params.decimalPointDigits));
        } catch (e) {}

        this.setValue(value);
        this.setColor(this.getFillColor(value));
        this.setText((this.params.usePercentageValue) ? value + " %" : value);

        this.onResultsRendered(options);
    },

    // callback to override for post results rendering
    onResultsRendered: function() {
        return true;
    }
});

}(UnixjQuery));