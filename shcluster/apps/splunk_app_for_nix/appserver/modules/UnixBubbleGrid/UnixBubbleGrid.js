(function($, _){
Splunk.Module.UnixBubbleGrid = $.klass(Splunk.Module.UnixBaseDispatchingFactoryFactory, {

    initialize: function($super, container) {
        $super(container);

        this.availableKey = this.getParam('availableKey');
        if(this.availableKey === null || this.availableKey === undefined){
            this.isAvailable = true;
        } else {
            this.isAvailable = false;
        }

        this.parentDiv = d3.select(container).select("div");

        this.height = this.getParam('height');
        this.width = this.getParam('width');
        this.outerWidth = this.width+'px';
        if(this.width === null || this.width === undefined){
            this.width = this.container.parent().width();
        }
        if(this.height === null || this.height === undefined){
            this.height = this.width * 0.5;
        }

        this.truncateAfter = Number(this.getParam('truncate_after'), 20);

        this.numHosts = 0;
        this.svgH = 0;
        this.svgW = 0;
        this.spanInUnixTime = 0;
        this.leftOffset = 20;
        this.topOffset = 13;
        this.axisTopPadding = 5;
        this.rowHeight = 50;
        this.rowWidth = 33;
        this.colWidth = 28;
        this.bubblePadding = 3;
        this.heatMapHeight = this.height;
        this.minHeatMapLeftPosition = 140;
        this.xDom = [];

        this.search = null;

        this.container.height(this.height).width(this.outerWidth);
        this.container.children().height(Number(this.height)-20).width(this.width);
        this.$loadingContainer = $(".loadingContainer", this.container);
        this.$noHosts = $(".noHosts", this.container);
        this.$noResults = $(".noResults", this.container);
         
        this.svg= d3.select(container).select("svg");
        this.heatMap= this.svg.append("g")
            .attr("class","heatMap");
        this.heatMapStage= this.heatMap.append("g")
            .attr("class","heatMapStage");

        this.xAxis = this.heatMap.append("g")
            .attr("class", "axis x")
            .attr("x", 0)
            .attr("y", 0);

        this.xScale= d3.time.scale();

        this.yAxis = this.heatMap.append("g")
            .attr("class", "axis y")
            .attr("x", 0)
            .attr("y", 0);

        this.yScale= d3.scale.ordinal();

        this.hoverDiv = d3.select(container).append('div')
            .attr('class', 'tooltip')
            .style('opacity', 1e-6);

        this.colorOffset= 1;
        this.colorRange= [this.getParam("lowerColorRange"),
            this.getParam("upperColorRange")];

        this.colorScaleType = this.getParam('colorScale');
        this.colorScale= (this.colorScaleType === "linear") ?
            d3.scale.linear() :
            d3.scale.log();

        this.radiusScale = (this.colorScaleType === "linear") ?
            d3.scale.linear() :
            d3.scale.log();

        this.minRadius = 1;
        this.maxRadius = 16;

        this.radiusRange = []

        this.percentScale = (this.getParam("colorScale") === "linear") ?
            d3.scale.linear() :
            d3.scale.log();

        this.radiusPercentScale = (this.getParam("colorScale") === "linear") ?
            d3.scale.linear() :
            d3.scale.log();

        this.nDrilldownBuckets = 30;
        this.rowLimit = 50;
        this.padding = 25;
    },

    getSID: function() {
        return this.getContext().get("search").job.getSID();
    },

    getResultParams: function($super) {
        var params = $super(),
            sid = this.getSID();
        params.sid = sid;
        return params;
    },

    onContextChange: function() {
        var context = this.getContext(),
            search = context.get("search");

        this.updateThresholdColors(context.get('threshold'));
        this.setAvailable(context);

        if(this.isAvailable){
            this.hideNoSelectionMessage();
            this.hideNoResultsMessage();

            if(this.searchChanged(this.search, search)){
                this.clearPlot();
                this.showLoadingIndicator(this.$loadingContainer);
                this.search = search;
                this.getResults();
            }
        } else {
            this.hidePlot();
            this.hideLoadingIndicator();
            this.hideNoResultsMessage();
            this.showNoSelectionMessage();
        }
    },

    setAvailable: function(context){
        if(this.availableKey !== null && this.availableKey !== undefined){
            var avail = context.get(this.availableKey);

            if(avail !== undefined && avail !== null){
                this.isAvailable = avail;
            } else {
                this.isAvailable = true;
            }
        } else {
            this.isAvailable = true;
        }

    },

    hidePlot: function(){
        this.svg.attr('display', 'none');
    },

    showPlot: function(){
        this.svg.attr('display', 'block');
    },

    hideNoResultsMessage: function(){
        this.$noResults.hide();
    },

    hideNoSelectionMessage: function(){
        this.$noHosts.hide();
    },

    showNoResultsMessage: function(){
        this.$noResults.show();
    },

    showNoSelectionMessage: function(){
        this.$noHosts.show();
    },

    onNewSIDClearPlot: function() {
        var newSID= this.getSID();
        if ((this.sid) && (this.sid !== newSID)){
            this.clearPlot();
        }
        this.sid = newSID;
    },

    onJobProgress: function() {
        this.hidePlot();
    },

    onJobDone: function(){
        this.getResults();
    },

    renderResults: function(data) {
        if (!data.results.length || !data.span || data.span === null){
            this.hideNoSelectionMessage();
            this.showNoResultsMessage();
            this.hideLoadingIndicator();
            return;
        }

        if(this.isAvailable){
            this.hideNoSelectionMessage();
            this.hideNoResultsMessage();
            this.hideLoadingIndicator();
            this.plot(data);
            this.showPlot();
        } else {
            this.showNoSelectionMessage();
        }

    },

    plot: function(data){
        var self = this,
            span = data.span,
            results = data.results,
            range = data.range,
            fields = data.fields,
            currentCols, exits, join;

        this.updateSvgDimensions();
        this.updateSpan(span);

        results.forEach(function (d) { 
            //NIX-496 - Safari barfs when we populate a time scale with NaN 
            var dt = new Date(0);
            dt.setUTCSeconds(d._time); 
            d._time = dt;
        });

        this.numHosts = this.getNumHosts(results);
        this.numCols = results.length;
        this.width = this.numCols*(this.colWidth+this.bubblePadding*2);

        this.heatMapHeight = this.calculateHeatMapHeight();
        this.topOffset = this.calculateTopOffset(this.rowHeight);
        this.leftOffset = this.calculateLeftOffset(this.rowHeight);
 
        this.container.height(this.heatMapHeight+this.padding+5);
        this.container.children('.UnixBubbleGrid').eq(0).height(this.heatMapHeight+this.padding+5);
        this.svg.attr('height',this.heatMapHeight+this.padding+5).attr('width',this.width);

        this.updateYScaleDomain(fields);
        this.updateYScaleSize(this.heatMapHeight);
        this.renderYAxis();

        this.updateXScaleDomain(results);
        this.updateXScaleSize(this.width);
        this.renderXAxis(this.heatMapHeight, this.numCols, this.leftOffset, this.heatMapHeight);

        this.updateColorScale(range);
        this.updateRadiusScale(range);
        this.updateColorPercentScale(range);
        this.updateRadiusPercentScale(range);

        this.updateHeatMapPosition();

        join = this.heatMapStage
                 .selectAll("g.col")
                 .data(results);

        addColumns(join);

        currentCols = this.heatMapStage
                .selectAll("g.col")
                .filter(inRange);

        this.heatMapStage.attr('transform', 'translate('+this.leftOffset+','+this.topOffset+')')

        currentCols.each(updateCircles)
            .call(this.move, this);

        exits = join.exit().filter(function(d){return !inRange(d);});

        if (exits.length > 0 && exits[0] !== undefined && exits[0].length > 0) {
            this.transition(join.exit()
                .filter(function (d) { return !inRange(d); }))
                .attr("opacity", 0)
                .remove();
        }

        function addColumns(d3set) {
            return d3set
                .enter()
                    .insert("g","g.axis")
                    .attr("class", "col")
                    .attr('col', function(d,i){
                        return 'col'+i;
                    })
                    .call(moveIn);
        }

        function updateCircles(colData) {
            var rect = d3.select(this).selectAll("circle"),
                join = rect.data(colData.result, self.getBucket);

            join.enter().insert("circle")
                .on("mouseover", function(d, i){
                    self.showCrosshair.call(self, this, d, i, self.heatMapHeight);
                    d3.select(this).style("fill", "lightblue").classed("selected", true);
                    self.heatMap.select("g.axis.y").selectAll("text").data(d, String).classed("selected",true);
                    self.hoverDiv.transition().duration(300).style('opacity', 0.8);
                })
                .on("mousemove", function(d, i){
                    var left = d3.event.pageX-self.container.offset().left,
                        top = d3.event.pageY-self.container.offset().top+self.padding;
                    self.hoverDiv
                        .style("left", left + "px")
                        .style("top", top + "px")
                        .html(function(){return getTextBox(colData._time,d)})
                        .style("text-align", "left");
                })
                .call(self.place, self)
                .attr('r', toRadius)
                .style("fill", function(d){
                    return self.toColor.call(self, d);
                });

            join.on("mouseout", function(d, i){
                self.hideCrosshair.call(self, this, d, i);
                d3.select(this).style("fill", self.toColor.call(self, d)).classed("selected", false);
                self.heatMap.select("g.axis.y").selectAll("text").data(d, String).classed("selected",false);
                self.hoverDiv.transition().duration(300).style('opacity', 1e-6);
            });

            join.exit().remove();
        }

        function getTextBox(time, data) {
            var timeFormatter = d3.time.format("%B %e %Y %H:%M:%S %Z"),
                output = "Time:&nbsp;&nbsp;"+timeFormatter(time)+"<br/>Host:&nbsp;&nbsp;&nbsp;"+data[0]+"<br/>Value: "+data[1];
            return output;
        }

        function metaTimeToEpoch(metaData){
            var newDate = new Date(metaData.toString());
            return newDate.getTime()/1000.0;
        }

        function parseMetaData(metaData){
            var pattern = /([^\(]+)/,
                time = metaData.split(pattern);
            return time[1];
        }

        function parseFieldFromMetaData(metaData){
            var metaDataArray = metaData.split(";");
            return metaDataArray[1].toString();
        }

        function title(selection, colData) {
            selection.text(function(d) {return colData._time + ";" + d[0] + ";" + d[1];});
        }

        function toRadius(d){
            var val = self.getValue(d);
            return self.safeApplyScale(self.radiusScale, val);
        }

        function inRange(d) {
            return d._time >= self.xDom[0] && d._time <= self.xDom[1];
        }

        function moveIn(selection) {
            selection
                .attr("opacity", 0)
                .attr("transform", function (d) {
                    return "translate(" + (self.xScale(d._time) + self.bucketWidth) + ",0)";
                });
        }
    },

    getNumHosts: function(data){
        var counted = {};
        _.each(data, function(_data){
            _.each(_data.result, function(host){
                counted[host[0]] = 1;
            });
        });
        return _.keys(counted).length;
    },

    toColor: function(d) {
        if(this.thresholdColors === undefined || this.thresholdColors.length === 0){
            return this.colorScale(this.getValue(d) + this.colorOffset);
        } else {
            var x = this.safeApplyScale(this.percentScale, this.getValue(d));
            return this.applyThresholdColors(x);
        }
    },

    showCrosshair: function(el, d, i, height){
        var $el = $(el),
            parent,
            $rowEl,
            bucket,
            j;

        parent = d3.select($el.parent()[0])
            .classed('selected', true)
        
        parent
            .insert('line')
            .attr('x1', -this.rowWidth/2)
            .attr('x2', -this.rowWidth/2)
            .attr('y1', -100)
            .attr('y2', height)
            .attr('class', 'selection')

        parent
            .insert('line')
            .attr('x1', this.rowWidth/2)
            .attr('x2', this.rowWidth/2)
            .attr('y1', -100)
            .attr('y2', height)
            .attr('class', 'selection')

        bucket = this.getBucket(d);

        this.onYAxisMouseOver.call(this, this, d, bucket);
    },

    hideCrosshair: function(el, d,i){
        var $el = $(el),
            parent,
            $rowEl,
            bucket,
            j;

        $el.parent().find('line').remove();

        parent = d3.select($el.parent()[0])
            .selectAll('line').remove();

        bucket = this.getBucket(d);
        
        this.onYAxisMouseOut(this, d, bucket);
    },

    updateSvgDimensions: function(){
        this.svgW = this.parentDiv.node().getBoundingClientRect().width;
        this.svgH = this.parentDiv.node().getBoundingClientRect().height;
    },

    calculateHeatMapHeight: function(){
        return this.rowHeight * this.numHosts;
        return this.svgH-this.padding;
    },

    updateSpan: function(span){
        this.spanInUnixTime = span*1000;
    },

    calculateHeatMapWidth: function(){
        var yAxisBoundingBox= this.heatMap.select("g.axis.y")[0][0].getBoundingClientRect();
        return this.svgW * 0.95 - yAxisBoundingBox.width;
    },

    move: function(selection, self) {
        self.transition(selection)
            .attr("transform", function (d) { return "translate(" + self.xScale(d._time) + ",0)"; })
            .attr("opacity", 1);
    },

    place: function(selection, self) {
        selection
            .attr("cy", function(d, i) {
                return self.yScale(self.getBucket(d));
            });
    },

    transition: function(selection){
        return selection.transition().duration(500).ease("linear");
    },

    updateBucketHeight: function (height){
        this.bucketHeight= height / this.yScale.domain().length;
    },

    updateBucketWidth: function(width) {
        // leave 1 pixel for space between columns
        var nColumns= (this.xDom[1].getTime() - this.xDom[0].getTime()) / (this.spanInUnixTime) / 100;
        this.bucketWidth = (width / nColumns)-1;
    },

    getValue: function (d) {
        return d[1];
    },
    
    clearPlot: function() {
        this.heatMapStage.selectAll("g.col").remove();
    },

    argmax: function(arr) {
        var lengths= arr.map(function (d) { return d.length; });
        return lengths.indexOf(d3.max(lengths));
    },
    
    calculateYDomain: function(data){
        return data.keys()
            .sort(function(a,b) {
               return parseFloat(a.replace(">","").replace("<","")) - parseFloat(b.replace(">","").replace("<",""));
            });
    },

    truncateLabel: function(d) {
        if (d.length > this.truncateAfter) {
            return jQuery.trim(d).substring(0, this.truncateAfter).trim(this) + "...";
        } else {
            return d;
        }
    },

    updateYScaleDomain: function(data){
        var yDom = this.calculateYDomain(d3.map(data));
        this.yScale.domain(yDom);
    },

    updateYScaleSize: function(height){
        this.yScale.rangeBands([height, 0]);
        this.updateBucketHeight(height);
    },

    renderYAxis: function(){
        var self = this,
            yAxis = d3.svg.axis()
            .scale(self.yScale)
            .orient("left")
            .tickSize(6,3,3)
            .tickFormat(function(d){return self.truncateLabel(d);});

        self.transition(self.yAxis)
            .call(yAxis);
    },

    onYAxisMouseOver: function (that, d, bucket) {
        var axis = this.heatMap.select("g.axis.y"),
            selection = axis.selectAll('text')
            .filter(function(d){ return bucket===d ? this : null;});

        selection.classed("selected", true);

        this.heatMap.insert("line","line.threshold")
            .call(this.horizontal, this, this.yScale(bucket))
            .attr("class", "selection");

        this.heatMap.insert("line","line.threshold")
            .call(this.horizontal, this, this.yScale(bucket)+this.bucketHeight)
            .attr("class", "selection");
    },

    onYAxisMouseOut: function (that, d, bucket) {
        var axis = this.heatMap.select("g.axis.y"),
            selection = axis.selectAll('text')
            .filter(function(d){ return bucket===d ? this : null;});
        selection.classed('selected', false);
        that.heatMap.selectAll("line.selection").remove();
    },

    getTimeRange: function() {
        return this.getContext().get("search").getTimeRange();
    },

    updateHeatMapPosition: function() {
        var yAxisBoundingBox= this.heatMap.select("g.axis.y")[0][0].getBoundingClientRect(),
            left = Math.max(yAxisBoundingBox.width*1.1, this.minHeatMapLeftPosition);

        this.transition(this.heatMap)
            .attr("transform", "translate("+left+",0"+")");
    },

    onXAxisMouseOver: function (selection, that, d) {
        d3.select(selection).classed("selected", true);

        that.appendLine(that,
            that.xScale(d._time),
            that.xScale(d._time),
            0,
            that.yScale(""))
            .attr("class", "selection");

        that.appendLine(that,
            that.xScale(d._time) + that.bucketWidth,
            that.xScale(d._time) + that.bucketWidth,
            0,
            that.yScale(""))
            .attr("class", "selection");
    },

    onXAxisMouseOut: function (selection, that, d) {
        d3.select(selection).classed("selected",false);
        that.heatMap.selectAll("line.selection").remove();
    },

    appendLine: function(that, x1,x2,y1,y2) {
        return that.heatMap.insert("line","line.threshold")
            .attr("x1", x1)
            .attr("x2", x2)
            .attr("y1", y1)
            .attr("y2", y2);
    },

    horizontal: function(that, self, y) {
        that.attr("x1", self.xScale(self.xDom[0]))
            .attr("x2", self.xScale(self.xDom[1]))
            .attr("y1", y)
            .attr("y2", y);
    },

    updateXScaleSize: function(width) {
        this.updateBucketWidth(width);
        this.xScale.range([0, width]);
    },

    renderXAxis: function(height, cols, offset, height){
        var self = this,
            xAxis= d3.svg.axis()
            .scale(self.xScale)
            .orient("bottom")
            .ticks(self.xScale.ticks(cols).length)
            .tickSubdivide(4)
            .tickSize(6,3,3);

        self.transition(self.xAxis)
            .attr("transform", "translate("+offset+","+height+")")
            .call(xAxis);
    },

    addTime: function(date, time) {
        return new Date(date.getTime() + time);
    },

    shiftXDomain: function(time) {
        this.xDom[1]= this.addTime(this.xDom[1], time);
        this.xDom[0]= this.addTime(this.xDom[0], time);
    },

    setxDom: function(val) {
        this.xDom = val;
    },

    updateXScaleDomain: function(data){
        var newXDom= d3.extent(data, this.getTime);

        newXDom[1]= this.addTime(newXDom[1], this.spanInUnixTime); 
        this.setxDom(newXDom);
        this.xScale.domain(newXDom);
    },

    updateColorScale: function(data) {
        this.colorScale.domain(data).range(this.colorRange);
    },

    updateRadiusScale: function(data) {
        var min_percentage = (data[1]-data[0])/data[1],
            minRadius = Math.max(this.minRadius, this.maxRadius-(this.maxRadius*min_percentage));
        this.radiusScale.domain(data).range([minRadius, this.maxRadius]);
    },

    updateRadiusPercentScale: function(data) {
        this.radiusPercentScale.domain(data).range([data[0], 100]);
    },

    getColorPercentDomain: function(data, offset) {
        var data_map = d3.map(data),
            min = d3.min(data_map.values(), function(d){return d.min;})+offset,
            max = d3.max(data_map.values(), function(d){return d.max;})+offset;
        return [min, max];
    },

    updateColorPercentScale: function(data){
        this.percentScale.domain(data).range([0,100]);
    },

    updateThresholdColors: function(newColors){
        var self = this;
        this.thresholdColors = newColors;

        this.svg.selectAll("circle")
            .each(function(d, i){
                d3.select(this).style('fill', self.toColor.call(self, d));
            })
    },

    updateThresholdLines: function(){
        var lowerThresholdLine= this.heatMap.selectAll("line.threshold.lower")
                .data(this.lowerThreshold, function (d) {return d;}),
            upperThresholdLine= this.heatMap.selectAll("line.threshold.upper")
                .data(this.upperThreshold, function (d) {return d;}),
            HeatMapPlot= this;

        function placeOver(d) { return HeatMapPlot.yScale(d); }

        lowerThresholdLine.enter().append("line")
            .call(this.horizontal, this, placeOver)
            .classed("threshold lower", true);

        this.transition(lowerThresholdLine)
            .attr({"y1": placeOver,
                "y2": placeOver});

        lowerThresholdLine.exit().remove();

        function placeUnder(d) { return HeatMapPlot.yScale(d) + HeatMapPlot.bucketHeight;}

        upperThresholdLine.enter().append("line")
            .call(this.horizontal, this, placeUnder)
            .classed("threshold upper", true);

        this.transition(upperThresholdLine)
            .attr({"y1": placeUnder,
                "y2": placeUnder});

        upperThresholdLine.exit().remove();
    },

    calculateTopOffset: function(height){
        return height / 2;
    },

    calculateLeftOffset: function(){
        return this.maxRadius*2;
    },

    getTime: function (d) {
        return d._time;
    },

    toTime: function (t){
        var st= t.indexOf("=");
        return (t.substring(st+1));
    },

    getBucketFromStr: function (str){
        var dash= str.indexOf("-");
        return [parseFloat(str.substring(0,dash)), parseFloat(str.substring(dash+1))];
    },

    getBucket: function (d) {
        return d[0];
    },

    isNum: function(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    },

    applyThresholdColors: function(x){
        // this.thresholdColors must be set
        var prev = null,
            color,
            self = this;

        if(x >= this.thresholdColors[this.thresholdColors.length-1].x){
            return this.thresholdColors[this.thresholdColors.length-1].color;
        }
        if(x <= this.thresholdColors[0].x){
            return this.thresholdColors[0].color
        }

        $.each(this.thresholdColors, function(i, thresh){
            if(x >= thresh.x){
                prev = thresh;
            } else {
                color = prev.color;
                return false;
            }
        });
        return color;
    },

    /*
    D3 scales can return NaN when x is 0, which throws off our other calculations
    */
    safeApplyScale: function(scale, x){
        var scaleVal = scale(x);
        if(isNaN(scaleVal)) return 0;
        return scaleVal;
    }
});

})(UnixjQuery, UnixUnderscore);
