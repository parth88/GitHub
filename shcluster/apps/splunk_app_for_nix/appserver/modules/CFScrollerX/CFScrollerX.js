Splunk.Module.CFScrollerX = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);
       
        this.namespace = this.getParam('namespace');

        this.varname = this.getParam('config');
        // TODO: properly handle existance of 'px' and '%'

        this.params = {
            width: this.getParam('width'),
            height: this.getParam('height'),
            expandWidth: this.getParam('expandWidth'),
            expandHeight: this.getParam('expandHeight')
        };

        this.data = null;

        $('#' + this.moduleId).attr({
            'data-update': '',
            'data-reset': ''
        });
    },

    getModifiedContext: function() {
        var context = this.getContext();

        if (this.data) {
            context.set('cfscroller_data', this.data);
        }

        return context;
    },

    onContextChange: function($super) {
        var that = this,
            context = this.getContext(),
            namespace = context.get('namespace'),
            nsobj = context.get(namespace),
            dataset = context.get('crossfilter'),
            name = this.varname,
            config,
            dimension,
            group;

        var defconfig = {
            dimension: identity
        };

        if (dataset !== undefined && dataset !== null && nsobj) {
            if (name && !nsobj[name]) {
                this.displayInlineErrorMessage(this.moduleId + ": config object " + name + " undefined.");
            } else {
                drawChart();
            }
        }

        function identity(d) { return d; }

        function simplebox(selection) {
            var context = that.getContext(),
                data = {
                    selection: selection,
                    dimension: dimension,
                    group: group,
                    level: 1
                };

            context.set('cfscroller_data', data);
            that.pushContextToChildren(context);
        }

        function expandbox(selection) {
            var context = that.getContext(),
                data = {
                    selection: selection,
                    dimension: dimension,
                    group: group,
                    level: 2
                };

            context.set('cfscroller_data', data);
            that.pushContextToChildren(context);
        }

        function drawChart() {
            var moduleId = "#" + that.moduleId;
            config = name ? nsobj[name] : defconfig;
            dimension = dataset.dimension(config.dimension);
            group = config.group ? dimension.group(config.group) : dimension.group();

            var charts = [
                scrollerx(that.params)
                    .dimension(dimension)
                    .group(group)
                    .simplebox(simplebox)
                    .expandbox(expandbox)
            ];
            
            var oldchart = d3.select(moduleId).selectAll(".chart").remove();
            var chart = d3.select(moduleId).selectAll(".chart")
                    .data(charts)
                  .enter().append('div')
                    .attr('class', 'CFScrollerX chart');

            renderAll();

            // Renders the specified chart or list.
            function render(method) {
                d3.select(this).call(method);
            }
            
            // Whenever the brush moves, re-rendering everything.
            function renderAll() {
                charts[0].filter(null);
                chart.each(render);
            }

            function reset() {
                charts[0].filter(null);
                callout();
            }

            function callout() {
                var $controller = $("#" + context.get(that.namespace + '_controller'));
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
