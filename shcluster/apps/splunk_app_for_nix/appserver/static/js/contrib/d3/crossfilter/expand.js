function indentedTree(options) {
    var config = options || {},
        data = [],
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
        minwidth = 10,
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

            var diagonal = d3.svg.diagonal().projection(function(d) {
                return [d.y, d.x];
            });

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

                ctrl.append("g")
                    .attr("class", "sorts")
                  .append("text")
                    .attr("y", 10)
                    .attr("dx", 3.5)
                    .attr("dy", 5.5)
                    .text("sort by: ");

                g.append("g")
                    .attr("class", "itree");
            }

            var sorts = g.select("g.sorts").selectAll("g")
                .data(fields);

            var acx = g.select("g.sorts").select("text").node().getBBox().width + 10;
            var sortEnter = sorts.enter().append("g")
                .on("click", function(d, i) {
                    if (sort_field === i)
                        return;

                    sort_field = i;
                    format = fields[sort_field].format || d3.format('.3s');
                    g.select("g.sorts").selectAll("text.sorts").classed("active", function(d, i) { return i === sort_field; });

                    nest_data();
                    
                    // TODO: smooth removal
                    g.select("g.itree").selectAll("g.node").remove();

                    // reconstruct tree
                    i = 0;
                    update(root);
                });

            sortEnter.append("text")
                .attr("class", "sorts")
                .attr("y", 10)
                .attr("dx", 3.5)
                .attr("dy", 5.5)
                .classed("active", function(d, i) { return (i === sort_field); })
                .text(function(d) { return d.name; })
                .each(function(d, i) {
                    var div = d3.select(this),
                        bbox = div.node().getBBox();
                    
                    div.attr("x", acx);
                    acx += (bbox.width + 10);
                });

            sortEnter.append("rect")
                .each(function(d, i) {
                    var self = d3.select(this),
                        tbox = d3.select(this.parentNode).select("text.sorts").node().getBBox(),
                        pad = 2;

                    self.attr("x", tbox.x - pad)
                        .attr("y", tbox.y - pad)
                        .attr("width", tbox.width + 2 * pad)
                        .attr("height", tbox.height + 2 * pad);
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

                var gbox = g.select("g.groups").node().getBBox(),
                    sbox = g.select("g.sorts").node().getBBox();

                g.select("g.sorts").attr("transform", "translate(0," + (gbox.height + 5) + ")");

                gnode.attr("transform", "translate(0," + (sbox.height + gbox.height + 25) + ")");
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
                    tree_height = barheight * nodes.length;

                var gbox = g.select("g.groups").node().getBBox();
                svg.attr("height", 50 + tree_height + gbox.height);

                // Compute the "layout"
                nodes.forEach(function(n, i) {
                    n.x = i * barheight;
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
                    .attr("y", -barheight / 2)
                    .attr("height", barheight)
                    .attr("width", function(d) { return x_scale(d.value); })
                    .style("fill", color)
                    .on("click", click);

                nodeEnter.append("text")
                    .attr("dy", 3.5)
                    .attr("dx", 5.5)
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

                // Transition exiting nodes to the parent's new position.
                node.exit().transition()
                    .duration(duration)
                    .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
                    .style("opacity", 1e-6)
                    .remove();

                /* FIXME: links not removed after collapsing
                // Update the links
                var link = gnode.selectAll("path.link")
                    .data(tree.links(nodes), function(d) { return d.target.id; });

                // Enter any new links at the parent's previous position.
                link.enter().insert("path", "g")
                    .attr("class", "link")
                    .attr("d", function(d) {
                        var o = {x: source.x0, y: source.y0};
                        return diagonal({source: o, target: o});
                    })
                  .transition()
                    .duration(duration)
                    .attr("d", diagonal);

                // Transition links to their new position.
                link.transition()
                    .duration(duration)
                    .attr("d", diagonal);

                // Transition exitingnodes to the parent's new position.
                link.transition()
                    .duration(duration)
                    .attr("d", diagonal);

                // Transition exiting nodes to the parent's new position.
                link.exit().transition()
                    .duration(duration)
                    .attr("d", function(d) {
                        var o = {x: source.x, y: source.y};
                        return diagonal({source: o, target: o});
                    })
                    .remove();*/

                // Stash the old positions for transition.
                nodes.forEach(function(d) {
                    d.x0 = d.x;
                    d.y0 = d.y;
                });
            }

            // Toggle children on click.
            function click(d) {
                if (d.values) {
                    d._values = d.values;
                    d.values = null;
                } else {
                    d.values = d._values;
                    d._values = null;
                }
                update(d);
            }

            function color(d) {
                return d._values ? "#3182bd" : d.values ? "#c6dbef" : "#fd8d3c";
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

    return chart;
}
