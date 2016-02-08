Splunk.Module.CFScrollerXSimple = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);

        this.hide(this.HIDDEN_MODULE_KEY);
        this.tracker = {};
        this.base = {
            cpu: {
              basesearch: '`alert_detail_cpu_basesearch($HOST$)`',
              fields: ['pctUser', 'pctSystem']
            },
            vmstat: {
              basesearch: '`alert_detail_memory_basesearch($HOST$)`',
              fields: ['memFreePct', 'memUsedPct', 'memFree', 'memUsed']
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

        if (data.level === 1) {
            process_cf_data(data);
        }

        function process_cf_data(data) {
            var div = data.selection,
                d = div.data()[0],
                colors = d3.scale
                    .category10()
                    .domain(
                      data.group.all().map( 
                          function(x) { 
                            return x.key;
                          }
                      )
                ),
                severity = d.severity,
                tags = d.tags || 'untagged',
                time = new Date(Date.parse(d._time)),
                margin = {top: 5, right: 0, bottom: 30, left: 30},
                width = +div.style('width').slice(0, -2) - margin.left - margin.right,
                height = 80 - margin.top - margin.bottom;

        var scaffolds = [
                {id: 'CPU_Usage',
                    ctype: stackedArea,
                    title: 'CPU Usage',
                    config: {
                        source: 'cpu',
                        x: d3.time.scale()
                            .range([0, width]),
                        y: d3.scale.linear()
                            .range([height, 0]),
                        x_domain: 'date',
                        layers: ['pctUser', 'pctSystem'],
                        width: width,
                        height: height,
                        y_axis: {ticks: [3]}
                    }
                },
                {id: 'Mem_Used_Pct',
                    ctype: lineChart,
                    title: 'Memory Used %',
                    config: {source: 'vmstat',
                        x: d3.time.scale().range([0, width]),
                        y: d3.scale.linear().range([height, 0]),
                        x_domain: 'date',
                        y_domain: 'memUsedPct',
                        y_axis: {ticks: [3]}
                    }
                },
                {id: 'Process_Count',
                    ctype: lineChart,
                    title: 'Process #',
                    config: {source: 'vmstat',
                        x: d3.time.scale().range([0, width]),
                        y: d3.scale.linear().range([height, 0]),
                        x_domain: 'date',
                        y_domain: 'processes',
                        y_axis: {ticks: [3]}
                    }
                },
                {id: 'Thread_Count',
                    ctype: lineChart,
                    title: 'Thread #',
                    config: {source: 'vmstat',
                        x: d3.time.scale().range([0, width]),
                        y: d3.scale.linear().range([height, 0]),
                        x_domain: 'date',
                        y_domain: 'threads',
                        y_axis: {ticks: [3], tickFormat: [d3.format('s')]}
                    }
                }
            ];

            var header = div.append('div')
                .attr('class', 'CFScrollerXSimple excerpt-header')
                .attr('data-expand', '')
                .style('background-color', colors(d.ss_name));

            header.append('div')
                .attr('class', 'CFScrollerXSimple severity severityMedium')
                .text(d.ss_name);

            header.append('div')
                .attr('class', 'CFScrollerXSimple alertinfo')
              .selectAll('div')
                .data([
                    d.hosts[0] + ' (and ' + d.hosts.length + ' more hosts)',
                    d3.time.format("%a %b %e %Y %H:%M:%S")(time) 
              ])
              .enter().append('div')
                .text(function(d) { return d; });

            // content
            var content = div.append('div')
                .attr("class", "CFScrollerXSimple excerpt-content");

            // create chart skeletons
            skeleton();

            // get alert events
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
                }

                var oldchart = content.selectAll(".chart").remove();
                var chart = content.selectAll(".chart")
                    .data(scaffolds)
                  .enter().append('div')
                    .attr('data-simplechart-id', function(d) { return d.id; })
                    .attr('class', 'CFScrollerXSimple chart');

                renderAll();

                // Renders the specified chart or list.
                function render(d) {
                    d3.select(this).call(d.chart);
                }
                
                // re-rendering everything.
                function renderAll() {
                    chart.each(render);
                }

                $(that.moduleId).bind('cf.update', renderAll);
            }

            function get_metrics(d) {
                var k;
               // console.log('d metrics ', d);
                d.metrics = d.metrics || {};
                for (k in base)
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
                    content.select('[data-simplechart-id=' + scaf.id + ']').call(chart);
                }
            }
        }
    },

    resetUI: function() {
        this.container.empty();
    },
    
    _stealthSearch: function(sobj, callback, values) {
        var basesearch = sobj && sobj.basesearch,
            timerange = sobj.timerange || new Splunk.TimeRange('0', 'now'),
            that = this;

        if (basesearch === undefined || basesearch === null || basesearch === '') {
            return;
        }

        if (typeof callback !== 'function') {
            values = callback || {};
            callback = null;
        } else
            values = values || {};

        var search = new Splunk.Search(),
            tokens = Splunk.util.discoverReplacementTokens(basesearch),
            i;

        for (i = 0; i < tokens.length; i++) {
            var replacer = new RegExp("\\$" + tokens[i] + "\\$");
            basesearch = Splunk.util.replaceTokens(basesearch, replacer, values[tokens[i]]);
        }

        search.setBaseSearch(basesearch);
        search.setMinimumStatusBuckets(300);
        search.setRequiredFields(['*']);
        search._searchModeLevel = 'verbose';
        search.namespace = 'SA-nix';
        search.setTimeRange(timerange);


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
                        } else {
                            counter++;
                            setTimeout(_getResults, 250);
                        }
                        return;
                    }


                    xhrObject = $.ajax({
                        type: "GET",
                        //cache: ($.browser.msie ? false : true),
                        cache: false,
                        url: resultUrl,
                        beforeSend: function(xhr) {
                            xhr.setRequestHeader('X-Splunk-Module', callingModule);
                        },
                        success: function(htmlFragment, textStatus, xhr) {
                            //JQuery 1.4 bug where success callback is called after an aborted request
                            //NOTE: status 0 means the resource is unreachable
                            if (xhr.status === 0) {
                                return;
                            }

                            that.tracker[search.getBaseSearch() + "," + search.getTimeRange().toString()] = true;
                            
                            if (callback)
                                callback.call(this, htmlFragment);
                        }.bind(this),
                        complete: function(xhr, textStatus) { this.xhrObject = null; },
                        error: function(xhr, textStatus, errorThrown) {
                            //xhr = null;
                            if (textStatus === 'abort') {
                            } else {
                            }
                        }
                    });
                }.bind(this);

                _getResults();
            }.bind(this),

            function(search) {

            }
        );
    }
});
