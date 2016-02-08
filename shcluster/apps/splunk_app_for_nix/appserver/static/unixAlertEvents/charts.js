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
                div.append('div').text(title);

                svg = div.append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                  .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
                
                svg.append("g")
                    .attr("class", "x axis")
                    .attr("transform", "translate(0," + height + ")")
                    .call(x_axis);
                
                svg.append("g")
                    .attr("class", "y axis")
                    .call(y_axis);
               
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
        color = d3.scale.category20c();

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
                div.append('div').text(title);
                
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
                    .call(y_axis);

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
            color = d3.scale.category20c();

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

                div.append('div').text(title);

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
                    .call(y_axis);

                var legend = svg.selectAll(".stackedArea.legend")
                    .data(color.domain().slice().reverse())
                  .enter().append("g")
                    .attr("class", "stackedArea legend")
                    .attr("transform", function(d, i) { return "translate(0," + i * 10 + ")"; });

                legend.append("rect")
                    .attr("x", width - 8)
                    .attr("width", 8)
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

function indentedTree(options) {
    var config = options || {},
        data = [],
        dispatch = d3.dispatch("sort"),
        margin = config.margin || {top: 10, right: 10, bottom: 20, left: 50},
        order = config.order.map(function(d, i) { return {key: d, pos: i}; }),
        fields = config.fields || [],
        sort_field = config.sort_field,
        indent = config.indent || 20,
        title = config.title || '',
        width = config.width - 30,
        height = config.height,
        barheight = config.barheight,
        barwidth = config.width * 0.8,
        duration = 400,
        root = {},
        format = (sort_field && fields[sort_field].format) || d3.format('.3s'),
        minwidth = 20,
        x_scale = d3.scale.linear()
            .range([minwidth, barwidth]);

    function chart(div) {

        div.each(function() {
            var div = d3.select(this),
                svg = div.select('svg'),
                g = div.select("g"),
                i = 0;

            if (data === undefined || data.length === 0) {
                div.selectAll('*').remove();
                div.append('p')
                    .attr('class', 'nodata')
                    .text(title + ': Data unavailable.');

                return;
            } else {
                div.selectAll('p.nodata').remove();
            }

            var tree = d3.layout.tree()
                .sort(sort_value_desc)
                .children(function(d) { return d.values; })
//                .separation(function(a, b) { return a.parent == b.parent ? 2 : 3; })
                .size([height, indent * order.length]);

            // Create the skeletal chart.
            if (g.empty()) {
                svg = div.append("svg")
                    .attr("overflow", "hidden")
                    .style("overflow", "hidden")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom);
                g = svg.append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                var ctrl = g.append("g")
                    .attr("class", "controls");

                ctrl.append("g")
                    .attr("class", "groups");

                g.append("g")
                    .attr("class", "itree");
            }

            dispatch.on('sort', function() {
                format = fields[sort_field].format || d3.format('.3s');

                nest_data();
                
                // TODO: smooth removal
                g.select("g.itree").selectAll("g.node").remove();

                // reconstruct tree
                i = 0;
                update(root);
            });

            order_groupings();

            nest_data();

            update(root);

            function dft(x, depth, func) {
                var args = Array.prototype.slice.call(arguments).slice(2);

                if (x && x.values) {
                    x.values.forEach(function(d) { dft(d, depth+1, func); });
                    x.values.sort(sort_value_desc);
                    x.value = d3.sum(x.values, function(d) { return d.value; });

                    x.leaves = d3.sum(x.values, function(d) { return d.leaves; });

                    if (x.values.length === 1) {
                        if (x.values[0].key)
                            x.key += (" " + x.values[0].key);
                        x.values = x.values[0].values;
                    } else if (x.values.length > 5) {
                        filtered = x.values.slice(0, 5);
                        var other = x.values.slice(5);
                        filtered.push({key: "(" + other.length +" more...)", values: null, value: d3.sum(other, function(d) { return d.value; })});
                        x.__values = x.values;
                        x.values = filtered;
                    }
                } else {
                    x.leaves = 1;
                    x.value = func(x);
                }

                if (depth === order.length) {
                    if (x.values) {
                        // TODO: does max make the best sense?
                        x.value = d3.max(x.values, function(d) { return d.value; });
                        x.__values = x.values;
                        x.values = null;
                    }
                }
            }

            function sort_value_desc(a, b) { return b.value - a.value; }

            function dragstart() {
              d3.select(this).style("fill", "red");
            }

            function dragmove(d) {
                var div = d3.select(this),
                    text = div.select("text"),
                    rect = div.select("rect"),
                    y = text.attr("y");

                text.attr("x", d3.event.x)
                    .attr("y", y);

                rect.attr("x", d3.event.x - 2)
                    .attr("y", y);

                d.x = d3.event.x;
                d.y = y;
            }

            function dragend(d) {
                d3.select(this).style("fill", null);
                d.y = 0;
                order.sort(function(a, b) { return a.x - b.x; });
                if (order.some(function(d, i) { return d.pos !== i; })) {
                    order.forEach(function(d, i) { d.pos = i; });

                    order_groupings();

                    nest_data();

                    // TODO: smooth removal
                    g.select("g.itree").selectAll("g.node").remove();

                    // reconstruct tree
                    i = 0;
                    update(root);
                }
            }
                
            function order_groupings() {
                var accx = [0];

                var drag = d3.behavior.drag()
                    .origin(function(d) { return d; })
                    .on("dragstart", dragstart)
                    .on("drag", dragmove)
                    .on("dragend", dragend);

                var labels = g.select("g.groups");
                var gnode = g.select("g.itree");

                labels.selectAll('g').remove();
                gnode.selectAll("g.node").remove();

                labels.selectAll("g")
                    .data(order)
                  .enter().append("g")
                    .each(function(d, i) {
                        var div = d3.select(this);

                        var text = div.append("text")
                                .attr("text-anchor", "start")
                                .text(d.key),
                            bbox = text.node().getBBox();

                        text.attr("x", accx[i])
                            .attr("y", 0)
                            .attr("dy", bbox.height);

                        div.datum(function(d) {
                            d.x = +text.attr("x");
                            d.y = +text.attr("y");
                            return d;
                        }); 

                        bbox = text.node().getBBox();

                        accx.push(bbox.x + bbox.width + 10);

                        div.append("rect")
                            .attr("x", bbox.x - 2)
                            .attr("y", bbox.y - 2)
                            .attr("width", bbox.width + 4)
                            .attr("height", bbox.height + 4);
                    })
                    .call(drag);

                var gbox = g.select("g.groups").node().getBBox();

                gnode.attr("transform", "translate(0," + (gbox.height + 25) + ")");
            }

            function nest_data() {
                var n;
                var nest = d3.nest();
                
                order.forEach(function(o) {
                    nest.key(function(d) { return d[o.key]; });
                    nest.sortValues(sort_value_desc);
                });

                n = nest.entries(data);
                n.forEach(function(d) {
                    dft(d, 1, function(x) {
                        return (sort_field === undefined || sort_field === null) ? 
                            1 : x[fields[sort_field].name]; });
                    //d.value = d3.sum(d.values, function(d) { return d.value; });
                });
                
                n.sort(sort_value_desc);

                var ext = d3.extent(n, function(d) { return d.value; }),
                    sum = d3.sum(n, function(d) { return d.value; });

                x_scale.domain([ext[0], sum]);

                root = {
                    key: title,
                    values: n,
                    value: sum,
                    x0: 0,
                    y0: 0
                };
            }

            function update(source) {
                // Compute the flattened node list. TODO use
                // d3.layout.hierarchy.
                var nodes = tree.nodes(root),
                    gnode = g.select("g.itree"),
                    padding = 7,
                    rowheight = padding + barheight,
                    tree_height = rowheight * nodes.length;

                var gbox = g.select("g.groups").node().getBBox();
                svg.attr("height", 50 + tree_height + gbox.height);

                // Compute the "layout"
                nodes.forEach(function(n, i) {
                    n.x = i * rowheight;
                });

                // Update the nodes
                var node = gnode.selectAll("g.node").data(nodes, function(d) {
                    return d.id || (d.id = ++i);
                });

                var nodeEnter= node.enter().append("g")
                    .attr("class", "node")
                    .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
                    .style("opacity", 1e-6);

                // Enter any new nodes at the parent's previous position.
                nodeEnter.append("rect")
                    .attr("y", -rowheight / 2)
                    .attr("height", barheight)
                    .attr("width", function(d) { return x_scale(d.value); })
                    .style("fill", color)
                    .on("click", click);

                nodeEnter.filter(function(d, i) { return d.depth < order.length && d.values; })
                    .append("path")
                    .attr("d", d3.svg.symbol().type("triangle-up"))
                    .attr("fill", "#99BDCD")
                    .on('click', click);

                nodeEnter.append("text")
                    .attr("dy", 3)
                    .attr("dx", function(d) { return x_scale(d.value) + 10; })
                    .text(function(d) {
                        if (sort_field === undefined || sort_field === null)
                            return d.key;
                        else
                            return d.key + " " + format(d.value);
                    });

                // Transition nodes to their new position.
                nodeEnter.transition()
                    .duration(duration)
                    .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })
                    .style("opacity", 1);

                node.transition()
                    .duration(duration)
                    .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })
                    .style("opacity", 1)
                  .select("rect")
                    .style("fill", color);

                node.filter(function(d, i) { return d.depth < order.length; })
                    .select('path')
                    .transition()
                    .attr('transform', function(d) {
                        return "translate(" + (x_scale(d.value) - 10) + ",-2) rotate(" + (d.values ? 180 : 90) + ")" + "scale(0.8, 0.6)";
                    });

                // Transition exiting nodes to the parent's new position.
                node.exit().transition()
                    .duration(duration)
                    .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
                    .style("opacity", 1e-6)
                    .remove();

                // Update the links
                var link = gnode.selectAll("path.link")
                    .data(tree.links(nodes), function(d) { return d.target.id; });

                // Enter any new links at the parent's previous position.
                link.enter().insert("path", "g")
                    .attr("class", "link")
                    .attr("d", function(d) {
                        var o = {x: source.x0, y: source.y0};
                        return elbow({source: o, target: o});
                    })
                  .transition()
                    .duration(duration)
                    .attr("d", elbow);

                // Transition links to their new position.
                link.transition()
                    .duration(duration)
                    .attr("d", elbow);

                // Transition exiting nodes to the parent's new position.
                link.exit().transition()
                    .duration(duration)
                    .attr("d", function(d) {
                        var o = {x: source.x, y: source.y};
                        return elbow({source: o, target: o});
                    })
                    .remove();

                // Stash the old positions for transition.
                nodes.forEach(function(d) {
                    d.x0 = d.x;
                    d.y0 = d.y;
                });
            }

            function elbow(d, i) {
                return "M" + (d.source.y + minwidth/2) + "," + (d.source.x + 4)
                    + "V" + (d.target.x - 3) + "H" + d.target.y;
            }

            // Toggle children on click.
            function click(d) {
                d3.event.stopPropagation();

                if (d.values) {
                    d._values = d.values;
                    d.values = null;
                    d.children = d.values
                } else {
                    d.values = d._values;
                    d._values = null;
                }
                update(d);
            }

            function color(d) {
                return d._values ? "#8DB5D1" : d.values ? "#D1E4F1" : "#FFF";
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

    chart.order = function(_) {
        if (!arguments.length) return order;
        order = _.map(function(d, i) { return {key: d, pos: i}; });
        return chart;
    };

    chart.title = function(_) {
        if (!arguments.length) return title;
        title = _;
        return chart;
    };

    chart.sortby = function(_) {
        if (!arguments.length) return sort_field;
        if (sort_field !== _) {
            sort_field = _;
            dispatch.sort();
        }
        return chart;
    }

    return chart;
}
