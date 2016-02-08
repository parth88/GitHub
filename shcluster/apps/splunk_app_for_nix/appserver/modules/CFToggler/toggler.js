function toggler() {
    var color = d3.scale.category10(),
        dispatch = d3.dispatch('toggle'),
        dimension,
        group;

    function chart(div) {
        var groups = group.all();

        div.each(function() {
            var div = d3.select(this),
                that = this;
                ul = div.select("ul");

            if (ul.empty()) {
                var ul = div.append("ul").attr("class", "toggler");

                ul.selectAll("li")
                    .data(groups)
                  .enter().append("li")
                    .attr('class', 'toggler active')
                    .style('color', function(d, i) { return color(i); })
                    .text(function(d) { return d.key; })
                    .on('click', function(d) { dispatch.toggle.call(this, d.key); });
            }
        });
    }

    dispatch.on('toggle.chart', function(value) {
        var li = d3.select(this),
            ul = d3.select(this.parentNode),
            act_li = ul.selectAll('li.active'),
            active = li.classed('active'),
            active_groups = [];

        // safety check: avoid select-none, which could have undesired
        // side-effects
        if (active && act_li[0].length == 1)
            return;

        li.classed('active', !active);

        // TODO: use d3 bound data instead of textContent
        d3.selectAll('li.active').each(function(d) { active_groups.push(this.textContent); });
        
        dimension.filter.apply(this, active_groups);
    });

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

    return d3.rebind(chart, dispatch, "on");
}
