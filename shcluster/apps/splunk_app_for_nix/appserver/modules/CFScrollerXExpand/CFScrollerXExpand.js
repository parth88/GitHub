Splunk.Module.CFScrollerXExpand = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);

        this.hide(this.HIDDEN_MODULE_KEY);
        this.logger = Splunk.Logger.getLogger("cf_scrollerx_expand.js", Splunk.Logger.mode.console);
        this.tracker = {};
        this.base = {
            ps: {
                basesearch: '`alert_detail_ps_basesearch($HOST$)`',
                fields: ['PID', 'pctCPU', 'pctMEM', 'RSZ', 'VSZ']
            },
            netstat: {
                basesearch: '`alert_detail_netstat_basesearch($HOST$)`',
                fields: ['Recv_Q', 'Send_Q']
            },
            lsof: {
                basesearch: '`alert_detail_lsof_basesearch($HOST$)`',
                fields: ['SIZE']
            }
        };
    },

    onContextChange: function($super) {
        var context = this.getContext(),
            data = context.get('cfscroller_data'),
            base = this.base,
            that = this;

        if (!data || data.selection === undefined) {
            return;
        }

        if (data.level === 2) {
            process_cf_data(data);
        }

        function process_cf_data(data) {
            var div = data.selection,
                d = div.data()[0],
                margin = {top: 5, right: 5, bottom: 30, left: 10},
                width = +div.style('width').slice(0, -2),
                //height = 400 - margin.top - margin.bottom;
                height = 420;

            var scaffolds = [
                {id: 'PS',
                    ctype: indentedTree,
                    title: 'PS',
                    config: {
                        source: 'ps',
                        order: ['USER', 'COMMAND', 'PID'],
                        info: ['ARGS'],
                        fields: [{name: 'pctCPU', format: d3.format('.2g')},
                            //'CPUTIME',
                            {name: 'pctMEM', format: d3.format('.2g')},
                            {name: 'RSZ', format: d3.format('.3s')},
                            {name: 'VSZ', format: d3.format('.3s')}
                            //'ELAPSED'
                        ],
                        sort_field: 2,
                        width: width - margin.left - margin.right,
                        height: height,
                        indent: 30,
                        barheight: 20
                    }
                },
                {id: 'Netstat',
                    ctype: indentedTree,
                    title: 'netstat',
                    config: {
                        source: 'netstat',
                        order: ['LocalAddress', 'ForeignAddress', 'Proto', 'State'],
                        info: ['ARGS'],
                        fields: [{name: 'Recv_Q'},
                            {name: 'Send_Q'}],
                        sort_field: 0,
                        width: width / 2 - margin.left - margin.right,
                        height: height,
                        indent: 20,
                        barheight: 20
                    }
                },
                {id: 'lsof',
                    ctype: indentedTree,
                    title: 'lsof',
                    config: {
                        source: 'lsof',
                        order: ['COMMAND', 'PID', 'USER', 'FD', 'TYPE', 'DEVICE', 'NAME'],
                        info: ['NAME', 'DEVICE', 'TYPE', 'FD'],
                        fields: [{name: 'SIZE', format: d3.format('3s')}],
                        sort_field: 0,
                        width: width / 2 - margin.left - margin.right,
                        height: height,
                        indent: 20,
                        barheight: 20
                    }
                }
            ];

            div.append('a')
                .attr('class', 'CFScrollerXExpand button-collapse')
                .attr('href', "javascript:void(0)")
                .attr('data-collapse', '');

            var switcher = div.append('div')
                .attr('class', 'CFScrollerXExpand switcher');

            skeleton();

            get_metrics(d);

            function skeleton() {
                var i;

                for (i = 0; i < scaffolds.length; i++) {
                    var scaf = scaffolds[i],
                        s;
                        
                    s = scaf.ctype(scaf.config)
                        .margin(margin)
                        .title(scaf.title);

                    scaf.chart = s;

                    switcher.append('a')
                        .attr('class', function() {
                            var cls = 'CFScrollerXExpand switcher-link';
                            if (i === 0) {
                                cls = cls + ' selected';
                            }
                            return cls;
                        })
                        .attr('data-switcher-id', scaf.title)
                        .text(function() { return scaf.title; })
                        .on('click', function(d) { 
                            var $elm = d3.select(this),
                                $sib = switcher.selectAll('a'),
                                data_id = $elm.attr('data-switcher-id');
                            $sib.classed('selected', false);
                            $elm.classed('selected', true);
                            div.selectAll("[data-expandchart-id]")
                                .style('display', 'none');
                            div.selectAll("[data-expandchart-id=" + data_id + "]")
                                .style('display', 'block');
                        });
                }

                var oldchart = div.selectAll("[data-expandchart-id]").remove();
                var chart = div.selectAll("[data-expandchart-id]")
                    .data(scaffolds);

                chart
                  .enter().append('div')
                    .attr('data-expandchart-id', function(d) { return d.id; });

                chart
                    .style('width', function(d, i) {
                       return ((d.config.width || width) + margin.left + margin.right) + 'px' || ''; 
                    })
                    .style('height', function(d, i) {
                       return ((d.config.height || height) + margin.top + margin.bottom) + 'px' || '';
                    })
                    .classed('CFScrollerXExpand chart', 1)
                    .style('display', 'none');

                d3.select(chart[0][0]).style('display', 'block'); 
              
                // Renders the specified chart or list.
                function render(d) {
                    d3.select(this).call(d.chart);
                }
                
                // re-rendering everything.
                function renderAll() {
                    chart.each(render);
                }
            }

            function get_metrics(d) {
                d.metrics = d.metrics || {};
                for (var k in base)
                    get_metric(d, k);
            }

            function get_metric(d, stype) {
                if (d.metrics[stype]) {
                    render_metrics(stype);
                    return;
                }

                var spec = base[stype],
                    basesearch = spec.basesearch,
                    fields = spec.fields,
                    timerange = new Splunk.TimeRange((d.date.valueOf()-300000)/1000, d.date.valueOf()/1000);

                that._stealthSearch({'basesearch': basesearch, 'timerange': timerange}, function(response) {
                    var result = response.result;

                    result.forEach(function(d) {
                        d.time = +d.time;
                        d.date = new Date(d.time * 1000);
                    
                        for (i = 0; i < fields.length; i++) {
                            d[fields[i]] = +d[fields[i]];
                        }
                    });
                
                    d.metrics[stype] = result;
                    render_metrics(stype);
                },
                {HOST: d.hosts[0]});
            }

            function render_metrics(type) {
                var scafs = scaffolds.filter(function(s) {
                    return s.config.source === type;
                });

                for (i = 0; i < scafs.length; i++) {
                    var scaf = scafs[i],
                        chart = scaf.chart,
                        data = d.metrics[type];

                    chart.data(data);
                    div.select('[data-expandchart-id=' + scaf.id + ']').call(chart);
                }
            }
        }
    },

    resetUI: function() {
        this.container.empty();
    },

    // TODO: Make this shared code by inheritance
    _stealthSearch: function(sobj, callback, values) {
        var basesearch = sobj && sobj.basesearch,
            timerange = sobj.timerange || new Splunk.TimeRange('0', 'now'),
            that = this;

        if (basesearch === undefined || basesearch === null || basesearch === '') {
            this.logger.error('no search string');
            return;
        }

        if (typeof callback !== 'function') {
            values = callback || {};
            callback = null;
        } else
            values = values || {};

        var search = new Splunk.Search(),
            tokens = Splunk.util.discoverReplacementTokens(basesearch);

        for (var i=0; i<tokens.length; i++) {
            var replacer = new RegExp("\\$" + tokens[i] + "\\$");
            basesearch = Splunk.util.replaceTokens(basesearch, replacer, values[tokens[i]]);
            this.logger.log('token ' + tokens[i] + ' replaced with [' + values[tokens[i]] + ']');
        }

        search.setBaseSearch(basesearch);
        search.setTimeRange(timerange);

        this.logger.debug("stealth search:", search);

        search.dispatchJob(
            function(search) {
                var _getResults = function () {
                    var counter = 0,
                        params = {sid: search.job.getSearchId()},
                        resultUrl = this.getResultURL(params),
                        callingModule = this.moduleId,
                        xhrObject,
                        xhrRetryCount = 10;

                    if (!search.job.isDone()) {
                        if (counter > xhrRetryCount) {
                            xhrObject.abort();
                            xhrObject = null;
                            this.logger.info('XHR in-flight destroyed for module', callingModule, 'for job', job.getSearchId(), 'and replaced with new one');
                        } else {
                            counter++;
                            setTimeout(_getResults, 250);
                        }
                        return;
                    }

                    this.logger.info('XHR clear for takeoff for module', callingModule, search.job.getSearchId());

                    xhrObject = $.ajax({
                        type: "GET",
                        //cache: ($.browser.msie ? false : true),
                        cache: false,
                        url: resultUrl,
                        beforeSend: function(xhr) {
                            xhr.setRequestHeader('X-Splunk-Module', callingModule);
                        },
                        success: function(htmlFragment, textStatus, xhr) {
                            that.logger.debug('->XHR DEBUG: observer: success status:', xhr.status, 'module:', callingModule, 'responseText:', !!(htmlFragment));
                            //JQuery 1.4 bug where success callback is called after an aborted request
                            //NOTE: status 0 means the resource is unreachable
                            if (xhr.status === 0) {
                                return;
                            }

                            that.tracker[search.getBaseSearch()] = true;
                            
                            if (callback)
                                callback.call(this, htmlFragment);
                        }.bind(this),
                        complete: function(xhr, textStatus) { this.xhrObject = null; },
                        error: function(xhr, textStatus, errorThrown) {
                            //xhr = null;
                            if (textStatus == 'abort') {
                                that.logger.debug(that.moduleType, '.getResults() aborted');
                            } else {
                                that.logger.warn(that.moduleType, '.getResults() error; textStatus=' + textStatus + ' errorThrown=' + errorThrown);
                            }
                            this.logger.error(textStatus, errorThrown);
                        }
                    });
                }.bind(this);

                _getResults();
            }.bind(this),

            function(search) {
                that.logger.error(this.moduleType, " Context failed to dispatch job for search=", search.toString());
            }
        );
    }
});
