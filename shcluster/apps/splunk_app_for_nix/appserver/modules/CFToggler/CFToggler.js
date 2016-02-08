Splunk.Module.CFToggler = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);

        this.width = this.getParam('width');
        this.height = this.getParam('height');
        this.varname = this.getParam('config');
        this.namespace = this.getParam('namespace');

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
            x: function(dim, grp, params) { return d3.scale.linear(); }
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
                moduleId = "#" + that.moduleId;

            // TODO: decide on single-chart-only or not
            var charts = [
                toggler(that.moduleId)
                    .dimension(dimension)
                    .group(group)
                    .reset(reset)
            ];
            
            var oldchart = d3.select(moduleId).selectAll(".chart").remove();
            var chart = d3.select(moduleId).selectAll(".chart")
                    .data(charts)
                  .enter().append('div')
                    .attr('class', 'CFToggler chart');

            chart.each(function(chart) { chart.on("toggle", callout); });

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
                //renderAll();
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
