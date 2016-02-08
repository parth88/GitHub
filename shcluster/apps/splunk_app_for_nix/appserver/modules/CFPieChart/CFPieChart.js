Splunk.Module.CFPieChart = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);

        this.namespace = this.getParam('namespace');
        this.varname = this.getParam('config');
        this.height = this.getParam('height');
        this.width = this.getParam('width');
        this.params = {
            id: this.moduleId,
            title: this.getParam('title'),
            width: this.width,
            height: this.height,
            outer: this.getParam('outer'),
            inner: this.getParam('inner'),
            label: this.getParam('label') || "",
            use_legend: /^true$/i.test(this.getParam('use_legend'))
        };

        this.container.height(this.height).width(this.width);

        $('#' + this.moduleId).attr({
            'data-update': '',
            'data-reset': ''
        });
    },

    onContextChange: function($super) {
        var that = this,
            context = this.getContext(),
            namespace = context.get('namespace'),
            nsobj = context.get(namespace),
            dataset = context.get('crossfilter'),
            controller = context.get(this.namespace + '_controller'),
            name = this.varname;

        var defconfig = {
            dimension: identity,
            slicelabel: function(d, i) { return d.value; }
        };

        if (dataset !== undefined && dataset !== null && nsobj) {
            if (name && !nsobj[name]) {
                this.displayInlineErrorMessage(this.moduleId + ": config object " + name + " undefined.");
            } else {
                drawChart();
            }
        }

        function identity(d) { return d; }

        function drawChart() {
            var config = name ? nsobj[name] : defconfig,
                dimension = dataset.dimension(config.dimension),
                group = config.group ? dimension.group(config.group) : dimension.group(),
                slicelabel = config.slicelabel || defconfig.slicelabel,
                params = that.params,
                title = that.params.title,
                barelabel = params.label,
                label = config.label ? config.label(dataset) : function() { return group.all().length; },
                moduleId = "#" + that.moduleId;

            // TODO: decide on single-chart-only or not
            var charts = [
                pieChart(params)
                    .dimension(dimension)
                    .group(group)
                  .label(label)
                  .title(title)
                  .value(function(d) { return d.value; })
                  .slicelabel(slicelabel)
            ];
            
            
            var oldchart = d3.select(moduleId).selectAll(".chart").remove();
            var chart = d3.select(moduleId).selectAll(".chart")
                    .data(charts)
                  .enter().append('div')
                    .attr('class', 'CFPieChart chart');

            chart.each(function(chart) { chart.on("piefilter.piechart", callout); });

            renderAll();

            // Renders the specified chart or list.
            function render(method) {
                d3.select(this).call(method);
            }
            
            // Whenever the brush moves, re-rendering everything.
            function renderAll() {
                chart.each(render);
            }

            function reset() {
                charts[0].filter(null);
                callout();
            }

            function callout() {
                var $controller = $("#" + controller);
                if ($controller) {
                    $controller.triggerHandler('update');
                } else {
                    renderAll();
                }
            }

            $(moduleId).bind('cf.update', renderAll);
        }
    }
});
