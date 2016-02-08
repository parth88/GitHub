function timeline(options) {
    var config = options || {},
        id = config.id,
        data = [],
        margin = config.margin || {top: 10, right: 10, bottom: 40, left: 10},
        width,
        height = +config.height || 100,
        barwidth = (+config.barwidth || 10),
        x,
        title,
        x_axis = d3.svg.axis().orient("bottom"),
        dimension,
        group,
        round,
        stackh = 4,
        color = d3.scale.category10();

    function chart(div) {
        div.each(function() {
            var div = d3.select(this),
                g = div.select("g");

            var dimtop = dimension.top(Infinity),
                group_all = group.all(),
                extent = d3.extent(group_all, function(x) { return x.key; }),
                span = 60,
                now = d3.time.day(new Date()),
                start = d3.time.day.offset(now, 1-span);

            if (start > extent[0]) {
                extent[1] = d3.time.day.offset(extent[1], 1);
                var slots = (extent[1] - extent[0]) / 86400000;
                x.domain([extent[0], extent[1]])
                    .rangeRound([0, barwidth * slots]);
                x_axis.scale(x);
            } else
                extent = x.domain();

            width = x.range()[1];

            // Create the skeletal chart.
            if (g.empty()) {
                g = div.append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                  .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                g.append("g")
                    .attr("class", "axis")
                    .attr("transform", "translate(0," + (height + 8) + ")")
                    .call(x_axis);
            }

            var histo = d3.layout.histogram()
                    .value(function(x) { return d3.time.day(x.date); })
                    .range(extent)
                    .bins(function(e) {
                        return d3.time.day.range(e[0], 
                            d3.time.day.offset(e[1], 1));
                    })(dimtop);

            histo.forEach(function(x, i, ary) { x.cy = i ? ary[i-1].cy + ary[i-1].y : 0; });

            $(div.node()).bind('scroll', function(evt, idx) {
                if (isNaN(idx))
                    return;

                var bar = d3.bisector(function(d) { return d.cy + d.y; }).left(histo, idx);

                g.select('image.pointer')
                    .attr('x', bar * barwidth);

                evt.stopPropagation();
            });

            var wall = g.selectAll('.wall')
                .data(histo);

            wall.enter().append("rect")
                .attr("class", 'wall')
                .attr("x", function(d, i) { return i * barwidth; })
                .attr("width", function(d, i) {
                    return (d.y || (histo[i+1] && histo[i+1].y)) ? barwidth - 1 : barwidth;
                })
                .attr("height", height);

            wall.each(function(d, i) {
                if (d.y === 0)
                    return;
                
                d3.select(this).on('click', function() {
                    // FIXME: do not hardcode; find a better communication
                    // method
                    $('.scrollerx').trigger({type: 'scroll', position: d.cy + d.y});
                    
                    d3.select(this.parentNode)
                        .select('image.pointer')
                        .attr('x', (i * barwidth) + "px");
                });
            });

            wall.exit().remove();

            var bar = g.selectAll("g.bar")
                .data(histo.filter(function(d) { return d.y; }));

            bar.enter().append('g')
                .attr('class', 'bar');

            bar.exit()
                .remove();

            var stacks = bar.selectAll("rect")
                .data(function(d) {
                    var names = {};

                    d.forEach(function(x) { names[x.ss_name] = 1; });

                    return Object.keys(names).sort().map(function(e) { return {x: d.x, name: e}; });
                }, function(d) { return d.name; });

            stacks.enter().append("rect")
              .attr("class", "bar");

            stacks.attr("x", function(d, i) { return x(d.x); })
              .attr("y", function(d, i) { return height - stackh * (i + 1); })
              .attr("width", barwidth - 1)
              .attr("height", stackh)
              .style("fill", function(d, i) { return color(d.name); });

            stacks.exit()
                .remove();

            if (g.select('image').empty()) {
                g.append("image");
            }

            g.select('image')
                .attr('class', 'pointer')
                // FIXME: seperate out path
                .attr("xlink:href", "/modules/CFScrollerXTimeline/images/arrow_up.gif")
                .attr('width', barwidth)
                .attr('height', 10)
                .attr('x', width - barwidth)
                .attr('y', height);
        });
    }

    chart.margin = function(_) {
        if (!arguments.length) return margin;
        margin = _;
        return chart;
    };

    chart.x = function(_) {
        if (!arguments.length) return x;
        x = _;
        x_axis.scale(x);
        return chart;
    };

    chart.dimension = function(_) {
        if (!arguments.length) return dimension;
        dimension = _;
        return chart;
    };

    chart.filter = function(_) {
        if (_) {
            dimension.filterRange(_);
        } else {
            dimension.filterAll();
        }
        return chart;
    };

    chart.group = function(_) {
        if (!arguments.length) return group;
        group = _;
        return chart;
    };

    chart.round = function(_) {
        if (!arguments.length) return round;
        round = _;
        return chart;
    };

    chart.x_axis = function(_) {
        if (!arguments.length) return x_axis;
        x_axis = _;
        x_axis.scale(x);
        return chart;
    };

    chart.title = function(_) {
        if (!arguments.length) return title;
        title = _;
        return chart;
    };

    chart.reset = function(_) {
        if (!arguments.length) return reset;
        reset = _;
        return chart;
    };

    return chart;
}
