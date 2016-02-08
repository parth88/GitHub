Splunk.Module.CFScrollerXTimeline = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);

        this.width = this.getParam('width');
        this.height = this.getParam('height');
        this.varname = this.getParam('config');
        this.params = {
            barwidth: this.getParam('barwidth') || 10
        };

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
                barwidth = that.params.barwidth,
                width = that.width,
                x = config.x ? config.x(dimension, group, that.params) : defconfig.x(),
                moduleId = "#" + that.moduleId;

            var charts = [
                timeline({id: that.moduleId, width: width, height: that.height, barwidth: barwidth})
                    .dimension(dimension)
                    .group(group)
                    .reset(reset)
                  .x(x)
            ];
            
            // TODO: auto get class name?
            var chart = d3.select(moduleId).selectAll(".chart")
                    .data(charts)
                  .enter().append('div')
                    .attr('class', 'CFScrollerXTimeline chart')
                    .style('width', '80%');

            renderAll();

            chart.selectAll('*').classed('CFScrollerXTimeline', 1);

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
                var $controller = $("#" + context.get('controller'));
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
