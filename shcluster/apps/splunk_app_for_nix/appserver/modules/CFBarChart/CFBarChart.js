Splunk.Module.CFBarChart = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);

        this.height = this.convertHeight(this.getParam('height'));
        this.namespace = this.getParam('namespace');
        this.width = this.convertWidth(this.getParam('width'));

        this.varname = this.getParam('config');
        this.params = {title: this.getParam('title') || "",
            width: this.width || 300,
            height: this.height || 100,
            barWidth: parseInt(this.getParam('barWidth'), 10) || 10
        };

        this.chart = null;

        this.container.height(this.height)
            .width(this.width)
            .attr({
              'data-update': '',
              'data-reset': ''
            });
    },

    convertHeight: function(height){
        if(height[height.length-1] === '%'){
            var percent = Number(height.substr(0, height.length-1)) / 100;
            percent = $(document).height() * percent;
            return percent;
        }
        else return Number(height);
    },

    convertWidth: function(width){
        if(width[width.length-1] === '%'){
            var percent = Number(width.substr(0, width.length-1)) / 100;
            percent = $(document).width() * percent;
            return percent;
        }
        else return Number(width);
    },

    onContextChange: function($super) {
        var that = this,
            context = this.getContext(),
            confns = context.get('namespace'),
            dataset = context.get(this.namespace) || null,
            conf = window[confns],
            config = conf[this.varname],
            controller = context.get(this.namespace + '_controller') || null;

        this.params.search = context.get('search');
        config.params = this.params;
        if (dataset !== undefined && dataset !== null) {
            drawChart();
        }
    
        var defconfig =  {},
            $controller = $('#' + controller);

        function identity(d) { return d; }

        defconfig = {
            dimension: identity,
            x: function(dim, grp) { return d3.scale.linear(); }
        };

        function drawChart() {
            var dimension = dataset.dimension(config.dimension),
                group = config.group ? dimension.group(config.group) : dimension.group(),
                title = that.params.title,
                barwidth = that.params.barWidth,
                x = config.x ? config.x(dimension, group) : defconfig.x(),
                moduleId = "#" + that.moduleId;


            x.range([0, that.width]);

            // TODO: decide on single-chart-only or not
            var charts = [
                barChart(that.moduleId, that.width, that.height)
                    .dimension(dimension)
                    .group(group)
                    .reset(reset)
                    .title(title)
                    .x(x)
            ];
            
            var oldcharts = d3.select(moduleId).selectAll(".chart").remove();

            var chart = d3.select(moduleId).selectAll(".chart")
                    .data(charts);

            chart.enter().append('div')
                    .attr('class', 'CFBarChart chart');

            chart.each(function(chart) { chart.on("brush", renderAll).on("brushend", callout); });

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
