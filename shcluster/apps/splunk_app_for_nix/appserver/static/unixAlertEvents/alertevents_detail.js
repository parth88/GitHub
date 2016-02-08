(function AlertManager() {
    var am = {},
        params = Splunk.util.queryStringToProp(window.location.search),
        caret_html = '<span class="caret"></span>';

    base = {
        cpu: {
          basesearch: '`alert_detail_cpu_basesearch($HOST$)`',
          fields: ['pctUser', 'pctSystem']
        },
        vmstat: {
          basesearch: '`alert_detail_memory_basesearch($HOST$)`',
          fields: ['memFreePct', 'memUsedPct', 'memFree', 'memUsed']
        },
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

    function toggle_menu(label, menu) {
        var self = d3.select(label),
            open = (menu.style('display').toLowerCase() !== 'none');
        if (open) {
            self.classed('open', false);
            menu.style('display', 'none');
        } else {
            self.classed('open', true);
            menu.style('display', 'block').style('left', '0');
        }
    }

    am.init = function () {
        var container = d3.select('.AlertEventContainer'),
            host_label = d3.select("#host-select > span"),
            host_list = d3.select("#host-select > ul");

        this.alert = {
            sid: container.attr('data-sid'),
            date : new Date(container.attr('data-trigger'))
        };
        
        host_label.on('click', function() {
            toggle_menu(this, host_list);
        });
        host_list.selectAll('li')
            .on('click', function() {
                host_list.style('display', 'none');
                host_label.html($(this).text() + caret_html);
                am.draw();
            });
    }

    am.draw = function() {
        var sel = $("#host-select > span");

        if (sel.length === 0)
            return;

        var  host = sel.text(),
            leftdiv = d3.select('div.AlertEventLeft'),
            rightdiv = d3.select('div.AlertEventRight'),
            container = d3.select('.AlertEventContainer'),
            d = this.alert,
            margin = {top: 10, right: 30, bottom: 20, left: 40},
            left_width = +leftdiv.style('width').slice(0, -2) - margin.left - margin.right,
            left_height = 100 - margin.top - margin.bottom,
            right_width = +rightdiv.style('width').slice(0, -2) - margin.left - margin.right,
            right_height = +rightdiv.style('height').slice(0, -2) - margin.top - margin.bottom;

        var oldie = container.selectAll('[data-chart-id] > *').remove();

        var scaffolds = [
            {id: 'CPU_Usage',
                ctype: stackedArea,
                title: 'CPU Usage',
                config: {
                    source: 'cpu',
                    x: d3.time.scale().range([0, left_width]),
                    y: d3.scale.linear().range([left_height, 0]),
                    x_domain: 'date',
                    layers: ['pctUser', 'pctSystem'],
                    width: left_width,
                    height: left_height,
                    x_axis: {ticks: [6]},
                    y_axis: {ticks: [3]}
                }
            },
            {id: 'Mem_Used_Pct',
                ctype: lineChart,
                title: 'Memory Used %',
                config: {source: 'vmstat',
                    x: d3.time.scale().range([0, left_width]),
                    y: d3.scale.linear().range([left_height, 0]),
                    x_domain: 'date',
                    y_domain: 'memUsedPct',
                    width: left_width,
                    height: left_height,
                    x_axis: {ticks: [6]},
                    y_axis: {ticks: [3]}
                }
            },
            {id: 'Process_Count',
                ctype: lineChart,
                title: 'Process #',
                config: {source: 'vmstat',
                    x: d3.time.scale().range([0, left_width]),
                    y: d3.scale.linear().range([left_height, 0]),
                    x_domain: 'date',
                    y_domain: 'processes',
                    width: left_width,
                    height: left_height,
                    x_axis: {ticks: [6]},
                    y_axis: {ticks: [3]}
                }
            },
            {id: 'Thread_Count',
                ctype: lineChart,
                title: 'Thread #',
                config: {source: 'vmstat',
                    x: d3.time.scale().range([0, left_width]),
                    y: d3.scale.linear().range([left_height, 0]),
                    x_domain: 'date',
                    y_domain: 'threads',
                    width: left_width,
                    height: left_height,
                    x_axis: {ticks: [6]},
                    y_axis: {ticks: [3], tickFormat: [d3.format('s')]}
                }
            },
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
                    width: right_width,
                    height: right_height,
                    indent: 30,
                    barheight: 15
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
                    width: right_width,
                    height: right_height,
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
                    width: right_width,
                    height: right_height,
                    indent: 20,
                    barheight: 20
                }
            }
        ];

        // create chart skeletons
        skeleton();

        // get alert events
        get_metrics(d);

        function display_switch(val ,target) {
            return val === target ? 'block' : 'none';
        }
        
        function switch_sortby(scaf) {
            var sortby_label = rightdiv.select('#sortby > span'),
                sortby_list = rightdiv.select('#sortby > ul'),
                fields = scaf.config.fields;

            sortby_label.html(fields[scaf.config.sort_field].name + caret_html)
                .on('click', function() { toggle_menu(this, sortby_list); });

            var list = sortby_list.selectAll('li')
                .data(fields);

            list.enter()
                .append('li')
                .attr('class', 'dropdown-toggle')
                .text(function(d) { return d.name; })
                .on('click', function(d, i) {
                    sortby_label.html(d.name + caret_html);
                    sortby_list.style('display', 'none');
                    scaf.chart.sortby(i);
                });

            list.text(function(d) { return d.name; });

            list.exit()
                .remove();
        }

        function skeleton() {
            var i,
                all_charts = container.selectAll('[data-chart-id]'),
                switcher = rightdiv.select('#switcher'),
                switcher_label = switcher.select('span'),
                switcher_list = switcher.select('ul'),
                right_charts = rightdiv.selectAll('[data-chart-id]'),
                switched = right_charts[0].map(function (d) {
                    return d3.select(d).attr('data-chart-id');
                }),
                chartorder = all_charts[0].map(function (d) {
                    return d3.select(d).attr('data-chart-id');
                });

            scaffolds.sort(function(a, b) {
                return chartorder.indexOf(a.id) > chartorder.indexOf(b.id);
            });

            for (i = 0; i < scaffolds.length; i++) {
                var scaf = scaffolds[i],
                    s;
                    
                s = scaf.ctype(scaf.config)
                    .margin(margin)
                    .title(scaf.title);

                scaf.chart = s;
            }

            var scaf = scaffolds.filter(function(d) { return switched.indexOf(d.id) >= 0; });

            all_charts.data(scaffolds);

            switcher_label.html(scaf[0].title + caret_html)
                .on('click', function() { toggle_menu(this, switcher_list);} );

            switch_sortby(scaf[0]);

            right_charts.each(function(d) {
                d3.select(this).style('display', display_switch(d.title, scaf[0].title));
            });

            switcher_list.selectAll('li')
                .data(scaf)
                .enter()
                .append('li')
                .attr('class', 'dropdown-toggle')
                .attr('data-switcher-id', function(d) {return d.title;})
                .text(function(d) { return d.title; })
                .on('click', function(d) { 
                    var $elm = d3.select(this),
                        $sib = switcher_list.selectAll('li'),
                        data_id = $elm.attr('data-switcher-id');
                    
                    right_charts.style('display', function(d) {
                        return display_switch(d.title, data_id);
                    });

                    switcher_label.html(data_id + caret_html);
                    switcher_list.style('display', 'none');
                    switch_sortby(d);
                });

            all_charts.each(function(d, i) {
                d3.select(this).classed('AlertEvent chart', 1);
            });

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
            var k;
            for (k in base)
                get_metric(d, host, k);
        }

        function get_metric(d, host, stype) {
            d[host] = d[host] || {};
            var metrics = d[host];

            if (metrics[stype]) {
                render_metrics(host, stype);
                return;
            }

            var spec = base[stype],
                basesearch = spec.basesearch,
                fields = spec.fields,
                s = {'basesearch': basesearch,
                    'earliest': (d.date.valueOf()-300000)/1000,
                    'latest': d.date.valueOf()/1000};

            am._stealthSearch(s, function(response) {
                var results = response.results,
                    sid = response.sid;

                if (results === undefined || sid === undefined) {
                    console.error('bad response');
                    return;
                }

                results.forEach(function(d) {
                    d.time = +d.time;
                    d.date = new Date(d.time * 1000);
                
                    for (i = 0; i < fields.length; i++) {
                        d[fields[i]] = +d[fields[i]];
                    }
                });
            
                metrics[stype] = {data: results, sid: sid};
                render_metrics(host, stype);
            },
            {HOST: host});
        }

        function render_metrics(host, type) {
            var scafs = scaffolds.filter(function(s) {
                return s.config.source === type;
            });

            for (i = 0; i < scafs.length; i++) {
                var scaf = scafs[i],
                    chart = scaf.chart,
                    data = d[host][type].data;

                chart.data(data);
                container.select('[data-chart-id=' + scaf.id + ']')
                    .on('click', function(x) {
                        Splunk.util.redirect_to(['app', app, view].join('/'), {sid: d[host][type].sid}, window.open(null, 'splunk_alert_event_drilldown'));
                    })
                    .call(chart);
            }
        }
    };

    am._stealthSearch = function(sobj, callback, values) {
        var basesearch = sobj && sobj.basesearch;

        if (basesearch === undefined || basesearch === null || basesearch === '') {
            return;
        }

        if (typeof callback !== 'function') {
            values = callback || {};
            callback = null;
        } else
            values = values || {};

        var tokens = Splunk.util.discoverReplacementTokens(basesearch),
            i;

        for (i = 0; i < tokens.length; i++) {
            var replacer = new RegExp("\\$" + tokens[i] + "\\$");
            basesearch = Splunk.util.replaceTokens(basesearch, replacer, values[tokens[i]]);
        }

        sobj.basesearch = basesearch

        $.ajax({
            type: 'POST',
            data: sobj,
            url: Splunk.util.make_url('custom', app, 'unixalertevents', app, 'search'),
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Splunk-Module', this.moduleType);
                xhr.setRequestHeader('X-Splunk-Form-Key', Splunk.util.getConfigValue('FORM_KEY'));
            },
            success: function(data, textStatus, xhr) {
                if (callback) {
                    callback(data);
                }
            },
            error: function(err){
               console.error("error, cant post search to alertevents controller:", err);
            }
        });
    };

    $(document).ready(function() {
        var infodiv = $('#app_info');

        am.init();
        //am.draw();
        app = infodiv.attr('s:app') || "splunk_app_for_nix";
        view = infodiv.attr('s:view') || "unix_flashtimeline";
        window.setTimeout(function() { am.draw(); }, 200);
    });

    return am;
})();
