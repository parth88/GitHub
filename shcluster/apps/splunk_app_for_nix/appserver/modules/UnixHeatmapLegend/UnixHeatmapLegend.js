Splunk.Module.UnixHeatmapLegend = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);
        this.canvas = d3.select(container).select("g.legend");
        this.current_legend = null;
        this.$legend = $('.LegendContainer', this.container);
        this.namespace = this.getParam('namespace');
    },

    /*
     * destroys all the rect and text in the legend group
     */
    destroyLegend: function() {
        this.canvas.selectAll('rect').remove();
        this.canvas.selectAll('text').remove();
    },

    /*
     * draw shapes and text in legend and show
     */
    drawLegend: function() {
        var filter = "url(#dropShadow)",
            rangemap = this.current_legend['rangemap'],
            stroke = "url(#node_stroke)", 
            i = 0, x = 2, y = 2,
            fill, high, key, low, range, txt;
            
        this.destroyLegend();

        for (i = 0; i < rangemap.length; i++) {
            range = rangemap[i];
            low = range.low || null;
            high = range.high || null;
            if (high !== null) {
                txt = low +  "-" + high;
            } else { 
                txt = low + ">";
            }
            if (range['node_fill'] === 'default') {
                fill = "url(#node_up_fill)";
            } else {
                fill = range['node_fill'];
            }
            this.drawLegendItem(fill, stroke, filter, range['text_fill'], 
                                range['text_offset'], x, y, txt);
            x += 45;
        }

        this.$legend.show();
    },

    /*
     * draw legend rect + text 
     */
    drawLegendItem: function(fill, stroke, filter, text_fill, text_offset, x, y, text) {
        this.canvas.append("rect")
            .attr("fill", fill)
            .attr("stroke", stroke)
            .attr("stroke-width", 1)
            .attr("filter", filter)
            .attr("width", 40)
            .attr("height", 40)
            .attr("x", x)
            .attr("y", y)
            .attr("rx", 6)
            .attr("ry", 6);
        x = x + parseInt(text_offset);
        y = y + 23;
        this.canvas.append("text")
            .attr("x", x)
            .attr("y", y)
            .attr("fill", text_fill)
            .text(text);
    },

    /*
     * hide the legend
     */
    hideLegend: function() {
        this.$legend.hide();
    },

    /*
     * override
     * see if we have actionable information in the new context
     */
    onContextChange: function() {
        var context = this.getContext();

        this.current_legend = context.get(this.namespace) || null;

        if (this.current_legend !== undefined 
          && this.current_legend !== null) {
            this.drawLegend();
        } else {
            this.hideLegend();
        }
    }

});
