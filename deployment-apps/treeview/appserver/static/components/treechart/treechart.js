//Tree Chart
//View Data in hierarchical structure
//supports zoom in and zoom out feature
//It can build tree upto n levels


// ---expected data format---
//a splunk search must be in tabular form

define(function(require, exports, module) {

    var _ = require('underscore');
    var d3 = require("../d3/d3");
    var SimpleSplunkView = require("splunkjs/mvc/simplesplunkview");
    var dtTotal;
    require("css!./d3style.css");

    var TreeChart = SimpleSplunkView.extend({

        options: {
            "managerid": null,
            "data": "preview",
            "root_label": "root_label not set",
            "height": "auto",
            "has_size": true,
            "initial_open_level": 1

        },

        output_mode: "json",

        initialize: function() {
            _(this.options).extend({
                "height_px": 500
            });

            SimpleSplunkView.prototype.initialize.apply(this, arguments);

            this.settings.on("change:order", this.render, this);

            $(window).resize(this, _.debounce(this._handleResize, 20));
        },

        _handleResize: function(e) {

            e.data.render();
        },

        createView: function() {

            var margin = {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            };
            var availableWidth = parseInt(this.settings.get("width") + 100 || this.$el.width());
            var availableHeight = parseInt(this.settings.get("height") + 100 || this.$el.height());
            var tooltip = d3.select(this.el).append("div")
                .attr("class", "tree-chart-tooltip");
            this.$el.html("");

            var viz = d3.select(this.el)
                .append("svg")
                .attr("width", availableWidth)
                .attr("height", availableHeight)
                .attr("pointer-events", "all");

            return viz;
        },

        formatData: function(data) {

            var height = this.settings.get("height");
            var height_px = this.settings.get("height_px");
            var root_label = this.settings.get("root_label");
            var has_size = this.settings.get("has_size");

            this.settings.set("height_px", height === "auto" ? Math.max(data.length * 30, height_px) : height);

            data = _(data).map(function(row) {
                return _(row).map(function(item, i) {

                    return has_size && i + 1 === row.length ? parseFloat(item) : item;
                });
            });

            var get_sum = function(list) {
                return _(list).pluck(list[0].length - 1).reduce(function(memo, num) {
                    return memo + num;
                }, 0);
            };

            var nest = function(list) {
                var groups = _(list).groupBy(0);

                return _(groups).map(function(value, key) {
                    var children = _(value)
                        .chain()
                        .map(function(v) {
                            return _(v).rest();
                        })
                        .compact()
                        .value();

                    if (has_size) {
                        var sum = get_sum(children);
                        var count = children.length;

                        return children.length == 1 && children[0].length === 1 ? {
                            "name": key,
                            "size": children[0][0]
                        } : {
                            "name": key,
                            "sum": sum,
                            "count": count,
                            "children": nest(children)
                        };
                    } else {
                        return children.length == 1 && children[0].length === 0 ? {
                            "name": key
                        } : {
                            "name": key,
                            "children": nest(children)
                        };
                    }
                });
            };

            var formatted_data = {
                "name": root_label,
                "children": nest(data)
            };

            return formatted_data;
        },
        updateView: function(viz, data) {
            if (JSON.stringify(data) === dtTotal) {
                return;
            }
            dtTotal = JSON.stringify(data);

            var that = this;

            function toggle_children(tree, level) {

                if (tree.children) {
                    _(tree.children).each(function(child) {
                        toggle_children(child, level + 1);
                    });

                    if (level >= initial_open_level) {
                        toggle(tree);
                    }
                }
            }

            var initial_open_level = that.settings.get("initial_open_level");

            if (initial_open_level >= 0) {
                toggle_children(data, 0);
            }

            drawTree(null, data);

            function drawTree(error, treeData) {

                var totalNodes = 0;
                var maxLabelLength = 0;

                var selectedNode = null;
                var draggingNode = null;

                var panSpeed = 200;
                var panBoundary = 20;

                var i = 0;
                var duration = 750;
                var root;
                var tooltip = d3.select("div").attr("class", "tree-chart-tooltip");

                var viewerWidth = viz[0][0].offsetWidth;
                var viewerHeight = viz[0][0].offsetHeight;

                var tree = d3.layout.tree()
                    .size([viewerHeight, viewerWidth]);

                var diagonal = d3.svg.diagonal()
                    .projection(function(d) {
                        return [d.y, d.x];
                    });

                function visit(parent, visitFn, childrenFn) {
                    if (!parent) return;

                    visitFn(parent);

                    var children = childrenFn(parent);
                    if (children) {
                        var count = children.length;
                        for (var i = 0; i < count; i++) {
                            visit(children[i], visitFn, childrenFn);
                        }
                    }
                }

                visit(treeData, function(d) {
                    totalNodes++;
                    maxLabelLength = Math.max(d.name.length, maxLabelLength);

                }, function(d) {
                    return d.children && d.children.length > 0 ? d.children : null;
                });

                function sortTree() {
                    tree.sort(function(a, b) {
                        return b.name.toLowerCase() < a.name.toLowerCase() ? 1 : -1;
                    });
                }

                sortTree();

                function pan(domNode, direction) {
                    var speed = panSpeed;
                    if (panTimer) {
                        clearTimeout(panTimer);
                        translateCoords = d3.transform(svgGroup.attr("transform"));
                        if (direction == 'left' || direction == 'right') {
                            translateX = direction == 'left' ? translateCoords.translate[0] + speed : translateCoords.translate[0] - speed;
                            translateY = translateCoords.translate[1];
                        } else if (direction == 'up' || direction == 'down') {
                            translateX = translateCoords.translate[0];
                            translateY = direction == 'up' ? translateCoords.translate[1] + speed : translateCoords.translate[1] - speed;
                        }
                        scaleX = translateCoords.scale[0];
                        scaleY = translateCoords.scale[1];
                        scale = zoomListener.scale();

                        svgGroup.transition().attr("transform", "translate(" + translateX + "," + translateY + ")scale(" + scale + ")");
                        d3.select(domNode).select('g.node').attr("transform", "translate(" + translateX + "," + translateY + ")");
                        zoomListener.scale(zoomListener.scale());
                        zoomListener.translate([translateX, translateY]);
                        panTimer = setTimeout(function() {
                            pan(domNode, speed, direction);
                        }, 50);
                    }
                }

                function zoom() {
                    svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
                }

                var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);

                function collapse(d) {
                    if (d.children) {
                        d._children = d.children;
                        d._children.forEach(collapse);
                        d.children = null;
                    }
                }

                function expand(d) {
                    if (d._children) {
                        d.children = d._children;
                        d.children.forEach(expand);
                        d._children = null;
                    }
                }

                var overCircle = function(d) {
                    selectedNode = d;
                    updateTempConnector();
                };
                var outCircle = function(d) {
                    selectedNode = null;
                    updateTempConnector();
                };

                var updateTempConnector = function() {
                    var data = [];
                    if (draggingNode !== null && selectedNode !== null) {

                        data = [{
                            source: {
                                x: selectedNode.y0,
                                y: selectedNode.x0
                            },
                            target: {
                                x: draggingNode.y0,
                                y: draggingNode.x0
                            }
                        }];
                    }
                    var link = svgGroup.selectAll(".templink").data(data);

                    link.enter().append("path")
                        .attr("class", "templink")
                        .attr("d", d3.svg.diagonal())
                        .attr('pointer-events', 'none');

                    link.attr("d", d3.svg.diagonal());

                    link.exit().remove();
                };

                function centerNode(source) {
                    scale = zoomListener.scale();
                    x = -source.y0;
                    y = -source.x0;
                    x = x * scale + viewerWidth / 2;
                    y = y * scale + viewerHeight / 2;
                    d3.select('g').transition()
                        .duration(duration)
                        .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
                    zoomListener.scale(scale);
                    zoomListener.translate([x, y]);
                }

                function toggleChildren(d) {
                    if (d.children) {
                        d._children = d.children;
                        d.children = null;
                    } else if (d._children) {
                        d.children = d._children;
                        d._children = null;
                    }
                    return d;
                }

                function click(d) {
                    if (d3.event.defaultPrevented) return;
                    d = toggleChildren(d);
                    update(d);
                    centerNode(d);
                }

                function update(source) {

                    var levelWidth = [1];
                    var childCount = function(level, n) {

                        if (n.children && n.children.length > 0) {
                            if (levelWidth.length <= level + 1) levelWidth.push(0);

                            levelWidth[level + 1] += n.children.length;
                            n.children.forEach(function(d) {

                                if (d.children != null) {
                                    childCount(level + 1, d);
                                }
                            });
                        }
                    };
                    childCount(0, root);
                    var newHeight = d3.max(levelWidth) * 40;
                    tree = tree.size([newHeight, viewerWidth]);

                    var nodes = tree.nodes(root).reverse(),
                        links = tree.links(nodes);

                    nodes.forEach(function(d) {
                        d.y = (d.depth * (maxLabelLength * 10));
                    });

                    node = svgGroup.selectAll("g.node")
                        .data(nodes, function(d) {
                            return d.id || (d.id = ++i);
                        });

                    var nodeEnter = node.enter().append("g")

                    .attr("class", "node")
                        .attr("transform", function(d) {
                            return "translate(" + source.y0 + "," + source.x0 + ")";
                        })
                        .on('click', click);

                    nodeEnter.append("circle")
                        .attr('class', 'nodeCircle')
                        .attr("r", 0)
                        .style("fill", function(d) {
                            return d._children ? "lightsteelblue" : "#fff";
                        });

                    nodeEnter.append("text")

                    .attr("x", function(d) {
                            return d.children || d._children ? -10 : 10;
                        })
                        .attr("dy", ".35em")
                        .attr('class', 'nodeText')
                        .attr("text-anchor", function(d) {
                            return d.children || d._children ? "end" : "start";
                        })
                        .text(function(d) {
                            return d.name;
                        })
                        .style("fill-opacity", 0);

                    node.select('text')
                        .attr("x", function(d) {
                            return d.children || d._children ? -10 : 10;
                        })
                        .attr("text-anchor", function(d) {
                            return d.children || d._children ? "end" : "start";
                        })
                        .text(function(d) {
                            return d.name;
                        });

                    node.select("circle.nodeCircle")
                        .attr("r", 4.5)
                        .style("fill", function(d) {
                            return d._children ? "lightsteelblue" : "#fff";
                        });

                    var nodeUpdate = node.transition()
                        .duration(duration)
                        .attr("transform", function(d) {
                            return "translate(" + d.y + "," + d.x + ")";
                        });

                    nodeUpdate.select("text")
                        .style("fill-opacity", 1);

                    var nodeExit = node.exit().transition()
                        .duration(duration)
                        .attr("transform", function(d) {
                            return "translate(" + source.y + "," + source.x + ")";
                        })
                        .remove();

                    nodeExit.select("circle")
                        .attr("r", 0);

                    nodeExit.select("text")
                        .style("fill-opacity", 0);

                    function doMouseEnter(d, level) {

                        var obj = d3.mouse(that.el);

                        var tmp = d;
                        var path_arr = [d.name];
                        while (typeof(tmp.parent) != "undefined") {
                            tmp = tmp.parent;
                            path_arr.unshift(tmp.name);
                        }

                        tooltip.text(path_arr.join("/"))
                            .style("position", "absolute")
                            .style("opacity", 1)
                            .style("left", (obj[0]) + 50 + "px")
                            .style("top", (obj[1]) + 100 + "px");

                    }

                    function doMouseOut(d, level) {

                        tooltip.style("opacity", 0);

                    }
                    var mouseNodes = viz.selectAll("circle,text");
                    mouseNodes.on("mouseover", doMouseEnter);
                    mouseNodes.on("mousemove", doMouseEnter);
                    mouseNodes.on("mouseout", doMouseOut);

                    var link = svgGroup.selectAll("path.link")
                        .data(links, function(d) {
                            return d.target.id;
                        });

                    link.enter().insert("path", "g")
                        .attr("class", "link")
                        .attr("d", function(d) {
                            var o = {
                                x: source.x0,
                                y: source.y0
                            };
                            return diagonal({
                                source: o,
                                target: o
                            });
                        });

                    link.transition()
                        .duration(duration)
                        .attr("d", diagonal);

                    link.exit().transition()
                        .duration(duration)
                        .attr("d", function(d) {
                            var o = {
                                x: source.x,
                                y: source.y
                            };
                            return diagonal({
                                source: o,
                                target: o
                            });
                        })
                        .remove();

                    nodes.forEach(function(d) {
                        d.x0 = d.x;
                        d.y0 = d.y;
                    });
                }

                var svgGroup = viz.append("g").attr("transform", "translate(" + viewerWidth / 4 + "," + viewerHeight / 8 + ")");

                root = treeData;
                root.x0 = viewerHeight / 2;
                root.y0 = 0;

                update(root);
                centerNode(root);
            };

            function toggle(d) {
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
            }

        }

    });
    return TreeChart;

});