Splunk.Module.UnixHeadlines = $.klass(Splunk.Module.DispatchingModule, { 

    initialize: function ($super, container) {
        $super(container);

        this.count = parseInt(this.getParam('count') || '10', 10);
        this.drilldown_view = this.getParam('drilldown_view') || 'alerts';
        this.client_app = this.getParam('client_app') || undefined;

        this.$icons = $('i', this.container);
        this.$button = $('input#manage_headlines');
        this.$message = $('.message', this.container);
        this.$table = $('.splUnixHeadlinesTable', this.container);
        this.$tablebody = $('tbody', this.container);
  
        this.selected = [1,2,3,4,5];
        this.interval = null;
        this.popup = null;
 
        this.$button.bind('click', this.onButtonClick.bind(this));
        this.$icons.bind('click', this.onIconClick.bind(this));

    },

    addSelected: function(classes) {
        var cls = this.getSevFromList(classes),
            selected = this.getSelected();
        if (cls !== null) {
            for (var i=0; i < cls.length; i++) {
                selected.push(cls[i]);
            }
        }
        this.setSelected(selected);
    },

    getSelected: function() {
        return this.selected;
    },

    getSevFromList: function(classes) {
        if ($.inArray('icon-info', classes) >= 0) {
            return [1];
        }
        if ($.inArray('icon-warning', classes) >= 0) {
            return [2,3,4];
        }
        if ($.inArray('icon-critical', classes) >= 0) {
            return [5];
        }
        return null;
    },

    onButtonClick: function(e) {
        var options = {},
            app = this.client_app || encodeURIComponent(Splunk.util.getCurrentApp()),
            path = Splunk.util.make_url("/custom/splunk_app_for_nix/unixheadlines/" + app + "/manage");

        e.preventDefault();
        this.popup = Splunk.Popup.IFramer(path, "", options);
    },

    onContextChange: function() {
        var earliest = this.getContext()
                         .get('search')
                           .getTimeRange()
                             .getEarliestTimeTerms();
        this.earliest = earliest;
        this.interval = setInterval(this.getResults.bind(this), 30000);
        this.getResults();
    },

    onIconClick: function(e) {
        var classes = e.target.className.split(/\s+/),
            $elm = $(e.target);
        
        if ($elm.hasClass('icon-selected') === true) {
            $elm.removeClass('icon-selected');
            this.removeSelected(classes);
        } else {
            $elm.addClass('icon-selected');
            this.addSelected(classes);
        }

        this.getResults();
        
    },

    // override
    getResultURL: function(params) {
        var app = this.client_app || Splunk.util.getCurrentApp(),
            uri = Splunk.util.make_url('custom', 'splunk_app_for_nix', 'unixheadlines', app, 'list');

        params = params || {};
        params['count'] = this.count;
        if (this.earliest !== null) {
            params['earliest'] = this.earliest;
        } 
        if (this.selected.length > 0) {
            params['severity'] = this.selected.join(',');
        }
        params['4IE'] = Math.random();
        uri += '?' + Splunk.util.propToQueryString(params);
        return uri;
    },

    removeSelected: function(classes) {
        var cls = this.getSevFromList(classes),
            idx, 
            selected = this.getSelected();
 
        if (cls !== null) {
            for (var i=0; i < cls.length; i++) {
                idx = $.inArray(cls[i], selected);
                if (idx >= 0) {
                    selected.splice(idx, 1);
                }
            }
        }
        if (selected.length < 1) selected = null;
        this.setSelected(selected);
    },

    renderResults: function (data) {
        if (data === null || data === undefined) {
            this.$table.hide();
            this.$message.text('Waiting for headlines...'); 
            this.$message.show();
        } else if (data.headlines !== null && data.headlines !== undefined) {
            if (data.headlines.length === 0) {
                this.$table.hide();
                this.$message.text('Nothing news-worthy at the moment...');
                this.$message.show();
            } else {
                this.$message.hide();
                this.$tablebody.children().remove();
                this.$table.show();
                this.addTableRows(data.headlines);
            }
        } else if (data.error !== null || data.error !== undefined) {
            this.$message.text(data.error);
            this.$table.hide();
            this.$message.show();
        } 
        this.$button.show();
    },

    setSelected: function(selected) {
        if (selected === null || selected.length === 0) {
            selected = [1,2,3,4,5];
            this.$icons.addClass('icon-selected');
        }
        this.selected = selected;
    },

    addTableRows: function (results) {
        var app = Splunk.util.getCurrentApp(),
            uri = Splunk.util.make_url('app', app, this.drilldown_view),
            $new_row, param, result;

        for (var i = 0; i < Math.min(results.length, this.count); i++) {
            $new_row = $('<tr>');
            result = results[i];
            if (result['message'] !== null && result['message'] !== undefined) {
                $('<td>').text(result['message'])
                    .addClass('headline')
                    .addClass('severity' + result['severity'].toString())
                    .appendTo($new_row);
            }
            if (result['timesince'] !== null && result['timesince'] !== undefined) {
                $('<td>').text(result['timesince'] + ' ago')
                    .addClass('date')
                    .appendTo($new_row);
            }
            (function(i){
                $new_row.children().bind("click", function() { 
                    param = {
                        'alert_sid': results[i]['job_id'],
                        'time_range': 'Last Hour'
                    };
                    uri += '?' + Splunk.util.propToQueryString(param); 
                    window.location = uri;
                }).css('cursor','pointer');
            })(i);
            $new_row.appendTo(this.$tablebody);
        }
    }

});
