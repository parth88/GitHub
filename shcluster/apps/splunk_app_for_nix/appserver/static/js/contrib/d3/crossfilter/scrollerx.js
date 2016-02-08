function scrollerx(options) {
    var color = d3.scale.category20(),
        config = options || {},
        w = config.width,
        h = config.height,
        expwidth = config.expandWidth || '800',
        expheight = config.expandHeight || '480',
        expanded = false,
        simplebox,
        expandbox,
        boxwidth,
        exboxwidth,
        exboxheight,
        data,
        startidx,
        curidx,
        dimension,
        group;

    // FIXME: properly handle width/height
    if (expwidth && expwidth.indexOf('%') == -1 && expwidth.indexOf('px') == -1)
        expwidth = expwidth + "px";
    if (expheight && expheight.indexOf('%') == -1 && expheight.indexOf('px') == -1)
        expheight = expheight + "px";

    expboxwidth = parseInt(expwidth.slice(0, -2), 10);

    function chart(div) {
        var groups = group.all();

        div.each(function() {
            var div = d3.select(this),
                g = div.select("div");

            div.style("width", "100%")
                .style("position", 'relative');

            var cw = +(div.style("width").replace("px", ""));

            if (g.empty()) {
                g = div.append("div")
                    .attr("class", "scrollerx")
                    .style("position", "relative")
                    .style("width", "9999999px")
                    .style("overflow", "hidden");

                // FIXME: hackish, find a better way
                $('.scrollerx').bind('scroll', function(evt){
                    if (!isNaN(evt.position)) {
                        collapse();
                        jump_scroll(evt.position);
                    }
                });

                var controls = div.append("section"),
                    anchor = div.append("mark").attr("id", "anchor");

                controls.append("a")
                    .attr("class", "arrow-prev")
                    .style("position", "absolute")
                    .style("top", (h/2) + "px")
                    .text("Prev")
                    .on('click', function () { collapse(); _scroll(-1); });
                controls.append("a")
                    .attr("class", "arrow-next")
                    .style("position", "absolute")
                    .style("top", (h/2) + "px")
                    .text("Next")
                    .on('click', function () { collapse(); _scroll(1); });
            }

            data = dimension.top(Infinity).sort(function(a, b) { return (Date.parse(a._time) - Date.parse(b._time)); });
            curidx = data.length - 1;

            var oldboxes = g.selectAll("scrollerbox").remove();
            var boxes = g.selectAll("scrollerbox")
                .data(data)
                .style('display', null);
                
            boxes.enter().append("scrollerbox").append('section')
                .attr('class', 'container')
                .attr('data-simplebox', function(d, i) { return i; })
                .style("width", w + "px")
                .style("height", h + "px");

            boxes.exit()
                .style('display', 'none');

            boxwidth = +g.select('scrollerbox').style('width').replace("px", "");

            _scroll();
        });

        function renderbox(d, i) {
            var scrollerx = d3.select(this.parentNode),
                sbox = d3.select(this),
                simple = sbox.select('[data-simplebox]'),
                that = this;

            if (!simple.empty() && simplebox) {
                simple.call(simplebox, sbox);
                if (expandbox) {
                    simple.selectAll('[data-expand]').on('click.expand', function() { expand.call(that, d, i); });
                }
            }
        }

        function jump_scroll(target) {
            _scroll(target - curidx - 1);
        }

        function _scroll(delta) {
            var end = 0;

            if (!isNaN(delta)) {
                curidx += (+delta);
                if (curidx >= data.length) {
                    curidx = data.length - 1;
                    end = 1;
                } else if (curidx < 0) {
                    curidx = 0;
                    end = -1;
                }
            }

            div.selectAll("div.scrollerx")
                .each(function () {
                    var cw = $(this.parentNode.parentNode).width() / 2,
                        boxcount = Math.ceil(cw / boxwidth) + 1,
                        $self = $(this),
                        g = d3.select(this),
                        left = -curidx * boxwidth + cw - 0.5 * (expanded ? expboxwidth: boxwidth);

                    // fetch data for entries that would be visible
                    g.selectAll('scrollerbox').each(function(d, i) {
                        // box in view
                        if (i < curidx + boxcount && i > curidx - boxcount) {
                            if (!d.init) {
                                d.init = true;
                                renderbox.call(this, d, i);
                            }
                        }
                    });

                    // scroll to the right position
                    if (end) {
                        g.transition()
                            .duration(200)
                            .style('left', (left + 50) + "px")
                            .each("end", function() {
                                d3.select(this).transition()
                                    .duration(200)
                                    .style('left', left + "px");
                            });
                    } else {
                        g.transition()
                            .duration(300)
                            .style('left', left + "px");
                    }

                    // update timeline
                    $('div.CFScrollerXTimeline.chart').triggerHandler('scroll', [curidx]);
                });
        }

        function expand(d, i) {
            var sbox = d3.select(this),
                expbox = sbox.selectAll('[data-expandbox]');

            collapse();
            sbox.selectAll('[data-simplebox]').style('display', 'none');
            curidx = i;

            if (expbox.empty()) {
                expbox = sbox.append('div')
                    .attr('class', 'container')
                    .attr('data-expandbox', i)
                    .style('width', expwidth)
                    .style('min-height', expheight)
                    .call(expandbox, sbox);
                expbox.selectAll('[data-collapse]').on('click.collapse', function() { collapse(i); _scroll(); });
            } else
                expbox.style('display', null);

            expanded = true;

            _scroll();
        } 

        function collapse() {
            div.selectAll('[data-expandbox="' + curidx + '"]').style('display', 'none');
            div.selectAll('[data-simplebox="' + curidx + '"]').style('display', null);
            expanded = false;
        }
    }

    chart.dimension = function(_) {
        if (!arguments.length) return dimension;
        dimension = _;
        return chart;
    };

    chart.filter = function(_) {
        if (_) {
            dimension.filter(_);
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

    chart.reset = function(_) {
        if (!arguments.length) return reset;
        reset = _;
        return chart;
    };

    chart.simplebox = function(_) {
        if (!arguments.length) return simplebox;
        simplebox = _;
        return chart;
    };

    chart.expandbox = function(_) {
        if (!arguments.length) return expandbox;
        expandbox = _;
        return chart;
    };

    return chart;
}
