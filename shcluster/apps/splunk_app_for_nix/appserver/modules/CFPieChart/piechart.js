function pieChart(options) {
    var params = options || {},
        donut = d3.layout.pie().sort(null),
        dispatch = d3.dispatch('piefilter'),
        color = d3.scale.category20(),
        id = params.id,
        use_legend = params.use_legend,
        title,
        filtered = null,
        dimension,
        group;

    function chart(div) {
        var w = params.width-5,                // width and height, natch
            h = params.height,
            r = Math.min(w, h) / 3,        // arc radius
            dur = 750,                     // duration, in milliseconds
            arc = d3.svg.arc().innerRadius(r * params.inner).outerRadius(r * params.outer),
            allgroups = group.all().map(function(d) { return d.key; });
    
        div.each(function() {
            var div = d3.select(this),
                svg = div.select("svg"),
                grps = group.all();
                
            // enable self-filtering (sorta drilldown)
            if (filtered)
                grps = grps.filter(function(d) { return d.key == filtered; });

            if (svg.empty()) {
                div.append("div")
                    .attr("class", "title")
                    .text(title);
                
                svg = div.append("svg:svg")
                    .attr("width", r*2+10).attr("height", h);

                var arc_grp = svg.append("svg:g")
                    .attr("class", "arcGrp")
                    .attr("transform", "translate(" + (r) + "," + (r) + ")");
                    // .attr("transform", "translate(" + (w / 2) + "," + (h / 2) + ")");
                
                var label_group = svg.append("svg:g")
                    .attr("class", "lblGroup")
                    .attr("transform", "translate(" + (r) + "," + (r) + ")");
                    // .attr("transform", "translate(" + (w / 2) + "," + (h / 2) + ")");
                
                // group for center text
                var center_group = svg.append("svg:g")
                    .attr("class", "ctrGroup")
                    .attr("transform", "translate(" + (r) + "," + (r) + ")");
                    // .attr("transform", "translate(" + (w / 2) + "," + (h / 2) + ")");
                
                // center label
                var pieLabel = center_group.append("svg:text")
                    .attr("dy", ".35em").attr("class", "pieLabel")
                    .attr("text-anchor", "middle");

                 // reset link
                center_group.append("svg:text")
                    .attr("dy", "1.65em")
                    .attr("class", "pieLabel reset")
                    .attr("text-anchor", "middle")
                    .text("reset")
                    .style("display", "none")
                    .on('click', function() { dispatch.piefilter.apply(this, null); });

                // legend
                if (use_legend) {
                    div.append("svg")
                        .attr("class", "legendGrp")
                        // .attr("width", w*1)
                        .attr("width", w-(r*2)-20)
                        .attr("height", h);
                }
            }

            svg.selectAll(".arcGrp").selectAll("path").remove();
            svg.selectAll(".lblGroup").selectAll("text").remove();

            // 2 types of empty-records: no data, filtered
            if (group.all().length === 0 || dimension.groupAll().value() === 0) {
                svg.select('text.pieLabel').text('');
                div.selectAll("svg.legendGrp").selectAll("*").remove();
                return;
            }

            // center label
            svg.select("text.pieLabel")
                .text(label())
                .style('font-size', '18px')
                .style('font-weight', 'bold');
                
            // draw arc paths
            var arcs = svg.selectAll(".arcGrp").selectAll("path")
                .data(donut(grps));

            arcs.transition().ease("elastic").duration(dur).attrTween("d", arcTween);

            arcs.enter().append("svg:path")
                .attr("stroke", "white")
                .attr("stroke-width", 0.5)
                .attr("fill", function(d, i) { return color(allgroups.indexOf(d.data.key));})
                .attr("d", arc)
                .on("mouseover", function(d) { 
                     d3.select(this).append('title')
                       .text(d.data.key);
                })
                .on("mouseout", function(d) { 
                     d3.select(this).selectAll('title').remove();
                })
                .each(function(d) { this._current = d; });
            
            // draw slice labels
            var sliceLabel = svg.selectAll(".lblGroup").selectAll("text")
                .data(donut(grps));

            sliceLabel.transition().ease("elastic").duration(dur)
                .attr("transform", function(d) {return "translate(" + arc.centroid(d) + ")"; })
                .style("fill-opacity", function(d) {return d.value === 0 ? 1e-6 : 1;});
    		
            sliceLabel.enter().append("svg:text")
                .attr("class", "arcLabel")
                .attr("transform", function(d) {return "translate(" + arc.centroid(d) + ")"; })
                .attr("text-anchor", "middle")
                .text(slicelabel)
                .on('click', function(d) { dispatch.piefilter.call(this, d.data.key); });

            // draw legends
            if (use_legend) {
                div.selectAll("svg.legendGrp").selectAll("*").remove();
                var legends = div.selectAll("svg.legendGrp").selectAll("text")
                    .data(grps);

                var legendGroups = legends.enter().append('g')
                    .attr('class', 'legendGroup')
                    .attr("transform", function(d, i) { return "translate(10," + (10+25 * i) + ")"; })

                legendGroups.append('text')
                    .attr("class", "legendLabel")
                    .text(function(d) { return d.key; })
                    .attr('transform', "translate(10,0)")       

                legendGroups.append('rect')
                    .attr('width', 12)
                    .attr('height', 12)
                    .attr("fill", function(d, i) { return color(allgroups.indexOf(d.key)); })
                    .attr('transform', "translate(-10,-10)")
            }

            div.select("text.reset").style("display", filtered ? null : "none");
        });

        // Store the currently-displayed angles in this._current.
        // Then, interpolate from this._current to the new angles.
        function arcTween(a) {
            var i = d3.interpolate(this._current, a);
            this._current = i(0);
            return function(t) {
                return arc(i(t));
            };
        }
    }

    dispatch.on('piefilter.chart', function (value) {
        var div = d3.select(this.parentNode.parentNode.parentNode);
        div.select("text.reset").style("display", null);
        dimension.filter(value);
        filtered = value;
    });

    chart.dimension = function(_) {
        if (!arguments.length) return dimension;
        dimension = _;
        return chart;
    };

    chart.filter = function(_) {
        if (_) {
            dimension.filter(_);
            filtered = _;
        } else {
            dimension.filterAll();
            filtered = null;
        }
        return chart;
    };

    chart.group = function(_) {
        if (!arguments.length) return group;
        group = _;
        return chart;
    };

    chart.value = function(_) {
        if (!arguments.length) return donut.value();
        donut.value(_);
        return chart;
    };

    chart.round = function(_) {
        if (!arguments.length) return round;
        round = _;
        return chart;
    };

    chart.axis = function(_) {
        if (!arguments.length) return axis;
        axis = _;
        axis.scale(x);
        return chart;
    };

    chart.y_axis = function(_) {
        if  (!arguments.length) return y_axis;
        y_axis = _;
        y_axis.scale(y);
        return chart;
    };

    chart.label = function(_) {
        if (!arguments.length) return label;
        label = _;
        return chart;
    };

    chart.slicelabel = function(_) {
        if (!arguments.length) return slicelabel;
        slicelabel = _;
        return chart;
    };

    chart.title = function(_) {
        if (!arguments.length) return title;
        title = _;
        return chart;
    };

    return d3.rebind(chart, dispatch, 'on');
}
