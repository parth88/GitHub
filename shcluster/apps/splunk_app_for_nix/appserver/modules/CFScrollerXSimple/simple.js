function lineChart(options) {
    var config = options || {},
        data = [],
        margin = config.margin || {top: 10, right: 10, bottom: 10, left: 10},
        x = config.x,
        y = config.y,
        x_axis = d3.svg.axis().orient("bottom"),
        y_axis = d3.svg.axis().orient("left"),
        title = config.title || "",
        width,
        height,
        args;

    if (x) x_axis.scale(x);
    if (y) y_axis.scale(y);

    for (func in config.x_axis) {
        args = config.x_axis[func];
        x_axis[func].apply(x_axis[func], args);
    }

    for (func in config.y_axis) {
        args = config.y_axis[func];
        y_axis[func].apply(y_axis[func], args);
    }

    function chart(div) {
        var xdom = config.x_domain,
            ydom = config.y_domain;

        if (x === undefined || y === undefined)
            return;

        width = x.range()[1];
        height = y.range()[0];

        div.each(function() {
            var div = d3.select(this),
                svg = div.select("g"),
                line;

			if (data === undefined || data.length === 0) {
				div.selectAll('*').remove();
				div.append('p')
					.attr('class', 'nodata')
					.text(title + ': Data unavailable.');

				return;
			} else {
				div.selectAll('p.nodata').remove();
			}

            // Create the skeletal chart.
            if (svg.empty()) {
                svg = div.append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                  .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
                
                svg.append("g")
                    .attr("class", "x axis")
                    .attr("transform", "translate(0," + height + ")");
                    //.call(x_axis);
                
                svg.append("g")
                    .attr("class", "y axis")
                    //.call(y_axis)
                  .append("text")
                    .attr("x", 10)
                    .attr("y", 10)
                    .attr("dy", ".71em")
                    .style("text-anchor", "start")
                    .text(title);
               
                svg.append("path")
                    .attr("class", "line");
            }

            line = d3.svg.line()
                .x(function(d) { return x(d[xdom]); })
                .y(function(d) { return y(d[ydom]); });

            x.domain(d3.extent(data, function(d) { return d[xdom]; }));
            y.domain(d3.extent(data, function(d) { return d[ydom]; }));

            svg.select('g.x.axis')
                .call(x_axis);

            svg.select('g.y.axis')
                .call(y_axis);

            svg.selectAll("path.line")
                .datum(data)
                .attr("d", line);
        });
    }

    chart.margin = function(_) {
        if (!arguments.length) return margin;
        margin = _;
        return chart;
    };

    // TODO: apply data and stop relying on explicit render?
    chart.data = function(_) {
        if (!arguments.length) return data;
        data = _;
        return chart;
    };

    chart.x = function(_) {
        if (!arguments.length) return x;
        x = _;
        x_axis.scale(x);
        return chart;
    };

    chart.y = function(_) {
        if (!arguments.length) return y;
        y = _;
        y_axis.scale(y);
        return chart;
    };

    chart.title = function(_) {
        if (!arguments.length) return title;
        title = _;
        return chart;
    };

    chart.width = function(_) {
        if (!arguments.length) return width;
        width = _;
        return chart;
    };

    chart.height = function(_) {
        if (!arguments.length) return height;
        height = _;
        return chart;
    };

    return chart;
}

// TODO: lots of duplicate codes
function stackedBarChart(options) {
    var config = options || {},
        data = [],
        margin = config.margin || {top: 10, right: 10, bottom: 10, left: 10},
        x = config.x,
        y = config.y,
        x_axis = d3.svg.axis().orient("bottom"),
        y_axis = d3.svg.axis().orient("left"),
        title = config.title || "",
        width = config.width,
        height = config.height,
        color = d3.scale.category10();

    if (x) x_axis.scale(x);
    if (y) y_axis.scale(y);

    for (func in config.x_axis) {
        args = config.x_axis[func];
        x_axis[func].apply(x_axis[func], args);
    }

    for (func in config.y_axis) {
        args = config.y_axis[func];
        y_axis[func].apply(y_axis[func], args);
    }

    function chart(div) {
        if (x === undefined || y === undefined)
            return;

        var xdom = config.x_domain,
            ydom = config.y_domain;

        div.each(function() {
            var div = d3.select(this),
                svg = div.select("g");

			if (data === undefined || data.length === 0) {
				div.selectAll('*').remove();
				div.append('p')
					.attr('class', 'nodata')
					.text(title + ': Data unavailable.');

				return;
			} else {
				div.selectAll('p.nodata').remove();
			}

            // Create the skeletal chart.
            if (svg.empty()) {
                svg = div.append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                  .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                color.domain(ydom);

                postdata = data.map(function(d, i) {
                    var y0 = 0,
                        values,
                        total;
                    values = color.domain().map(function(name) { return {name: name, y0: y0, y1: y0 += +d[name]}; });
                    total = values[values.length - 1].y1;

                    return {total: total, values: values, org: d};
                });

                x.domain(postdata.map(function(d) { return d.org[xdom]; }));
                y.domain([0, d3.max(postdata, function(d) { return d.total; })]);
        
                svg.append("g")
                    .attr("class", "x axis")
                    .attr("transform", "translate(0," + height + ")");

                svg.append("g")
                    .attr("class", "y axis")
                    .call(y_axis)
                  .append("text")
                    .attr("y", 6)
                    .attr("dy", ".51em")
                    .style("text-anchor", "start")
                    .text(title);

                var state = svg.selectAll(".state")
                    .data(postdata)
                  .enter().append("g")
                    .attr("class", "g")
                    .attr("transform", function(d) { return "translate(" + x(d.org[xdom]) + ",0)"; });

                state.selectAll("rect")
                    .data(function(d) { return d.values; })
                  .enter().append("rect")
                    .attr("width", x.rangeBand())
                    .attr("y", function(d) { return y(d.y1); })
                    .attr("height", function(d, i) { return y(d.y0) - y(d.y1); })
                    .style("fill", function(d) { return color(d.name); });

                var legend = svg.selectAll(".stackedBarChart.legend")
                    .data(color.domain().slice().reverse())
                  .enter().append("g")
                    .attr("class", "stackedBarChart legend")
                    .attr("transform", function(d, i) { return "translate(0," + i * 10 + ")"; });

                legend.append("rect")
                    .attr("x", width - 18)
                    .attr("width", 18)
                    .attr("height", 8)
                    .style("fill", color);

                legend.append("text")
                    .attr("x", width - 24)
                    .attr("y", 4)
                    .attr("dy", ".15em")
                    .style("text-anchor", "end")
                    .text(function(d) { return d; });
            }

        });
    }

    chart.margin = function(_) {
        if (!arguments.length) return margin;
        margin = _;
        return chart;
    };

    chart.data = function(_) {
        if (!arguments.length) return data;
        data = _;
        return chart;
    };

    chart.x = function(_) {
        if (!arguments.length) return x;
        x = _;
        x_axis.scale(x);
        return chart;
    };

    chart.y = function(_) {
        if (!arguments.length) return y;
        y = _;
        y_axis.scale(y);
        return chart;
    };

    chart.title = function(_) {
        if (!arguments.length) return title;
        title = _;
        return chart;
    };

    chart.width = function(_) {
        if (!arguments.length) return width;
        width = _;
        return chart;
    };

    chart.height = function(_) {
        if (!arguments.length) return height;
        height = _;
        return chart;
    };

    return chart;
}

// TODO: lots of duplicate codes
// TODO: clean up unnecessary options
function stackedArea(options) {
    var config = options || {},
        data = [],
        margin = config.margin || {top: 10, right: 10, bottom: 10, left: 10},
        x = config.x,
        y = config.y,
        x_axis = d3.svg.axis().orient("bottom"),
        y_axis = d3.svg.axis().orient("left"),
        xdom = config.x_domain,
        layers = config.layers,
        title = config.title || '',
        width,
        height;

    if (x) x_axis.scale(x);
    if (y) y_axis.scale(y);

    for (func in config.x_axis) {
        args = config.x_axis[func];
        x_axis[func].apply(x_axis[func], args);
    }

    for (func in config.y_axis) {
        args = config.y_axis[func];
        y_axis[func].apply(y_axis[func], args);
    }

    function chart(div) {
        var xdom = config.x_domain,
            ydom = config.y_domain;
            color = d3.scale.category10();

        if (x === undefined || y === undefined)
            return;

        width = x.range()[1];
        height = y.range()[0];

        div.each(function() {
            var div = d3.select(this),
                svg = div.select("g"),
                values,
                line,
                area;

			if (data === undefined || data.length === 0) {
				div.selectAll('*').remove();
				div.append('p')
					.attr('class', 'nodata')
					.text(title + ': Data unavailable.');

				return;
			} else {
				div.selectAll('p.nodata').remove();
			}

            color.domain(layers);
            values = layers.map(function(k) {
                return {
                    key: k,
                    values: data.map(function(d) {
                        return {x: d[xdom], y: d[k]};
                    })
                };
            });
                
            // Create the skeletal chart.
            if (svg.empty()) {
                var stack = d3.layout.stack()
                    .values(function(d) { return d.values; })
                    .out(function(d, y0, y) { d.y0 = y0; })
                    .order("reverse");

                stack(values);

                x.domain(d3.extent(data, function(d) { return d[xdom]; }));
                y.domain([0, d3.max(values[0].values.map(function(d) { return d.y0 + d.y; }))]);

                svg = div.append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                  .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                line = d3.svg.line()
                    .interpolate("basis")
                    .x(function(d) { return x(d.x); })
                    .y(function(d) { return y(d.y0); });

                area = d3.svg.area()
                    .interpolate("basis")
                    .x(function(d) { return x(d.x); })
                    .y0(function(d) { return y(d.y0); })
                    .y1(function(d) { return y(d.y0+ d.y); });

                var g = svg.selectAll(".layer")
                    .data(values)
                  .enter().append("g")
                    .attr("class", "stackedArea layer");

                g.append("path")
                    .attr("class", "stackedArea area")
                    .attr("d", function(d) { return area(d.values); })
                    .style("fill", function(d) { return color(d.key); })
                    .style("fill-opacity", 1);
                    
                svg.append("g")
                    .attr("class", "stackedArea x axis")
                    .attr("transform", "translate(0," + height + ")")
                    .call(x_axis);
                
                svg.append("g")
                    .attr("class", "stackedArea y axis")
                    .call(y_axis)
                  .append("text")
                    .attr("y", 6)
                    .attr("dy", ".51em")
                    .style("text-anchor", "start")
                    .text(title);

                var legend = svg.selectAll(".stackedArea.legend")
                    .data(color.domain().slice().reverse())
                  .enter().append("g")
                    .attr("class", "stackedArea legend")
                    .attr("transform", function(d, i) { return "translate(0," + i * 10 + ")"; });

                legend.append("rect")
                    .attr("x", width - 18)
                    .attr("width", 18)
                    .attr("height", 8)
                    .style("fill", color);

                legend.append("text")
                    .attr("x", width - 24)
                    .attr("y", 4)
                    .attr("dy", ".15em")
                    .style("text-anchor", "end")
                    .text(function(d) { return d; });
            }
        });
    }

    chart.margin = function(_) {
        if (!arguments.length) return margin;
        margin = _;
        return chart;
    };

    chart.data = function(_) {
        if (!arguments.length) return data;
        data = _;
        return chart;
    };

    chart.x = function(_) {
        if (!arguments.length) return x;
        x = _;
        x_axis.scale(x);
        return chart;
    };

    chart.y = function(_) {
        if (!arguments.length) return y;
        y = _;
        y_axis.scale(y);
        return chart;
    };

    chart.title = function(_) {
        if (!arguments.length) return title;
        title = _;
        return chart;
    };

    chart.width = function(_) {
        if (!arguments.length) return width;
        width = _;
        return chart;
    };

    chart.height = function(_) {
        if (!arguments.length) return height;
        height = _;
        return chart;
    };

    return chart;
}
