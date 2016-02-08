/*
Allows the user to specify a gradient
*/

(function($, _){

window.Color = function(svg, grad, range, rangeCircle, defaultColors, moduleId, radius, storage){
    var box,
        picker,
        $picker,
        pickerEl,
        gutterHeight, gutterWidth, gutterPadding, gutterMax, gutterMin, gutterY,
        percentY,
        pickerWidth,
        pickerHeight,
        axisGroup,
        pickerIsActive = false,
        swatchSize = 10,
        numColors = 0,
        drag,
        scaleData,
        thresholdArc,
        scaleCircle,
        scaleToGrad,
        gripperOffset,
        data = [],
        self = this,
        colorModel,
        scaleToGutter,
        moduleIdSel = "#"+moduleId,
        $wrapper = $(moduleIdSel),
        normalizeGutterScale,
        colorPalette,
        colorRouter,
        $paletteEl;

    colorModel = new ColorModel(data, moduleId, storage);

    scaleData = d3.scale.linear()
        // Winds up being reversed with how the dom is set up
        .domain([100, 0])
        .range(range);

    scaleCircle = d3.scale.linear()
        .domain(range)
        .range(rangeCircle);

    gutterWidth = 20; gutterHeight = radius+20;
    gutterY = gutterHeight - 10;
    gutterPadding = 5;
    gutterMax = gutterHeight - gutterPadding;
    gutterMin = 15; // magic number because of how the filter graphic is constructed


    // Scales
    ////////////////////////////

    scaleToGutter = d3.scale.linear()
        .domain([0, 100])
        .range([gutterMin, gutterMax]);

    normalizeGutterScale = scaleToGutter.invert;

    scaleToGrad = d3.scale.linear()
        .domain([gutterMin, gutterMax])
        .range([0,100]);

    function scaleToCircle(x){
        return scaleCircle(scaleData(x));
    }

    // Color Picker Setup
    ////////////////////////////
    

    // these are set in css
    // but these values are a little smaller
    pickerWidth = 150; pickerHeight = 200;

    $paletteEl = $('#'+moduleId + '-palette');

    // We use these two to encapsulate the state behavior as much as possible
    function closeColorPicker(){
        pickerIsActive = false;
    }

    colorPalette = new ColorPalette($paletteEl, function(hex) {
            updateCurrentColor({color:hex});
            self.save();
        }, closeColorPicker);

    function loadDefault(colorA, colorB){    
        grad.clear();
        insertNewThreshold(colorA, 0);
        insertNewThreshold(colorB, 100);
    }

    // this isn't svg, so we use jquery instead of d3
    // otherwise, weird crap happens
    $picker = $('#'+moduleId+'-picker');

    // This fixes annoying image dragging behavior in firefox
    d3.select('#'+moduleId+'-picker').selectAll('rect')
        .attr('draggable', false);

    $wrapper.find(".pickerWrapper").bind("dragstart", function() {
        return false;
    });

    // Cant setup the dom in the html because the color picker lib changes a bunch of junk
    $picker.append("<div class='confirmWrapper'><button class='btn btn-inverse confirm'>Confirm</button></div>");
    $picker.find('.confirm').click(function(){
        closeColorPicker();
        numColors++;
    });

    // We only display the color picker when the user clicks appropriately
    $picker.hide();

    // Threshold grid
    ////////////////////////////

    thresholdArc = d3.svg.arc()
        .startAngle(0)
        .endAngle(Math.PI);

    // todo: better names, more consistent
    function insertGridArc(x){
        var arc, thresholdCircle;

        arc = thresholdArc
            .outerRadius(function(x){
                return scaleToCircle(x);
            })
            .innerRadius(function(x){
                return scaleToCircle(x);
            });

        thresholdCircle = svg.selectAll('thresholdCircle')
            .data([x]).enter()
            .append('path')
                .attr('class','thresholdCircle')
                .attr('d', arc)
                .each(function(d){ this._highest = d; });

        return thresholdCircle;
    }

    function thresholdTween(d){
        var interp;

        interp = d3.interpolate(this._highest, d);

        this._highest = d;

        return function(t) {
            thresholdArc.outerRadius(function(){
                return scaleToCircle(interp(t));
            });
            thresholdArc.innerRadius(function(){
                return scaleToCircle(interp(t));
            });
            return thresholdArc();
        };
    }

    axisGroup = d3.select(moduleIdSel + ' .axisGroup .axis')
        .append('g')
            .attr('id', moduleId +'-pickedColors')
            .attr('transform', buildTranslate(55,-gutterHeight));

    box = svg.select('.axisGroup').insert('rect', ':first-child')
        .attr('x', -30)
        .attr('y', -gutterY)
        .attr('width', gutterWidth)
        .attr('height', gutterHeight)
        .attr('class', 'colorUI')
        .attr("rx", "5")
        .attr('filter', "url(" + moduleIdSel + "-inset-shadow)")

        /*
        Handle inserting new gradient swatches
        */
        .on('click', function(){
            var bounding, y;
            
            bounding = d3.event.target.getBoundingClientRect();
            y = (d3.event.clientY - bounding.top) / gutterHeight * 100;

            if(!pickerIsActive){
                insertNewThreshold("#000000", y);
                self.save();
                colorModel.setToLatest(); // latest being the one we just added via insertNewThreshold
                openColorPicker(d3.event.offsetX, d3.event.offsetY);
            }
            // todo: need an else here to handle requests for new colors when picker already open. Ask Cary
        });

    function updateCurrentColor(updates){
        colorModel.updateCurrent(updates);
        updateGridArc(colorModel.current);
        updateSwatch(colorModel.current);
    }

    // gridData.y should be in the range [0..100]
    // it's scaled later
    function updateGridArc(gridData){
        gridData.gridArc.data([gridData.y])
            .transition().duration()
            .attrTween("d", thresholdTween);
    }

    function updateSwatch(swatchData){
        swatchData.swatch.select('rect').attr('fill', swatchData.color);
        swatchData.swatch.attr('y', swatchData.y/100 * gutterHeight + swatchSize/2);

        grad.moveHardStop(swatchData.gradStop, swatchData.y);
        // grad.updateColor(swatchData.gradStop, swatchData.color);
        grad.updateColor(swatchData.gradStop, swatchData.color);
    }



    /*
    note that the reference to the current gradient is bound in a closure
    this isnt the most flexible way of doing this

    we are also storing references in data[] but they are not used at the moment.
    color, y, gradStop, arc
    */
    function insertSwatch(swatchData){
        var swatch, yGrad,
            y = swatchData.y,
            color = swatchData.color,
            gradStop = swatchData.gradStop,
            gradStopEdge = swatchData.gradStopEdge,
            firstClickTime = null,
            doubleClickTimer,
            drag,
            yGutter,
            gripperStart, gripperEnd, gripperStartY;
    
        drag = d3.behavior.drag()
            // .origin(Object) // this doesnt work but supposedly handles origin dragging
            .on("drag", handleDrag);

        function handleDrag(d){
            var bounding, y, x, el,
                yOffset;
            
            bounding = svg.select('.colorUI').node().getBoundingClientRect();
            x = (d3.event.sourceEvent.clientX - bounding.left - (swatchSize));

            // todo: implement - minor shift when dragging
            // offsetY = d3.event;
            yOffset = 0;
            //todo: this should be outputting scaled data based upon the height of the UI
            yGutter = Math.max(gutterMin, Math.min(gutterMax, d3.event.y));

            // This gives a nice "snapping" behavior when dragging off the swatch
            // The user can drag off the swatch when they want to delete a threshold
            if(Math.abs(x) > 35){
                d3.select(this)
                    .attr('transform', buildTranslate(x, yGutter - yOffset));

                deleteThreshold(swatchData);
                closeColorPicker();
            } else {
                d3.select(this)
                    .attr('transform', buildTranslate(0, yGutter - yOffset));
            }
            
            yGrad = scaleToGrad(yGutter);
            grad.moveStop(gradStop, yGrad);
            // grad.moveHardStop(gradStop, yGrad);
            // grad.moveEdgeStop(gradStopEdge, yGrad);

            swatchData.y = normalizeGutterScale(yGutter);

            updateGridArc({
                gridArc: swatchData.gridArc,
                y: swatchData.y
            });
            self.save();
        }

        // inserting a new swatch
        swatch = axisGroup.append('g')
            .attr('class', 'swatchGroup')
            .attr('transform', buildTranslate(0, scaleToGutter(swatchData.y)) )
            .call(drag)
            .on('click', function(){
                if(firstClickTime === null){
                    firstClickTime = d3.event.timeStamp; 
                } else {
                    if(d3.event.timeStamp - firstClickTime < 600){ // todo: this threshold should be tweaked
                        openColorPicker(d3.event.offsetX, d3.event.offsetY);
                        colorModel.setCurrent(swatchData);

                        firstClickTime = d3.event.timeStamp;
                    } else {
                        firstClickTime = d3.event.timeStamp;
                    }
                }
            });

        swatch.append('rect')
            .attr('class', 'swatchColor')
            .attr('width', swatchSize)
            .attr('height', swatchSize)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('fill', color);
        
        gripperStart = 1;
        gripperEnd = swatchSize - 2;
        gripperStartY = 2;

        swatch.append('line')
            .attr('x1', gripperStart).attr('x2', gripperEnd)
            .attr('y1', gripperStartY).attr('y2', gripperStartY)
            .attr('class', 'gripperMark')
            // this gets nice 1px lines
            // todo: fix these offsets for chrome/firefox; off by one pixel for chrome
            .attr('shape-rendering', "crispEdges");

        swatch.append('line')
            .attr('x1', gripperStart).attr('x2', gripperEnd)
            .attr('y1', gripperStartY+2).attr('y2', gripperStartY+2)
            .attr('class', 'gripperMark')
            .attr('shape-rendering', "crispEdges");

        swatch.append('line')
            .attr('x1', gripperStart).attr('x2', gripperEnd)
            .attr('y1', gripperStartY+4).attr('y2', gripperStartY+4)
            .attr('class', 'gripperMark')
            .attr('shape-rendering', "crispEdges");

        return swatch;
    }

    function buildNewThreshold(color, y){
        var arc, gradStop, swatchData, 
            swatch, gradStopData;

        // TODO: do we still need this? If so, make it a method on grad
        if(numColors === 0){
            // d3.select(grad.getHighest()).remove();
        }
        numColors++;

        arc = insertGridArc(y);
        gradStopData = {
            'color': color,
            'position': y
        };
        // gradStop = grad.insert(gradStopData);

        gradStop = grad.insertHardEdge(gradStopData);
    
        swatchData = {
            'color': color,
            'y': y,
            'gridArc': arc,
            'gradStop': gradStop
        };

        swatch = insertSwatch(swatchData);
        swatchData.swatch = swatch;

        return swatchData;
    }

    function insertNewThreshold(color, y){
        var threshold = buildNewThreshold(color, y);
        colorModel.add(threshold);
    }

    function deleteThreshold(thresholdData){
        grad.remove(thresholdData.gradStop);
        thresholdData.gridArc.remove();
        thresholdData.swatch.remove();
        colorModel.remove(thresholdData);
    }

    function openColorPicker(clickX, clickY){
        pickerIsActive = true;

        var x, y, bounding, wrapperLeft, wrapperTop;

        bounding = d3.select("#" + moduleId + " g.wrapper").node().getBoundingClientRect();

        wrapperLeft = $wrapper.offset().left;
        wrapperTop = $wrapper.offset().top;
        x = bounding.left - pickerWidth - gutterWidth * 4 - wrapperLeft;
        y = bounding.top - wrapperTop;

        x = clickX - pickerWidth - gutterWidth * 5;

        if(wrapperLeft < pickerWidth){
            x = 0;
        }

        y = clickY;

        colorPalette.open();
        colorPalette.$el.css({
            left: x,
            top: clickY
        });
    }

    this.load = function(newData){
        // colorModel.load(function(data){
        //     insertNewThreshold(data.color, data.y);
        // });
        colorModel.load(buildNewThreshold);
    };

    this.save = function(){
        colorModel.save();
    };

    this.clearDisplay = function(){
        grad.clear();
        d3.selectAll(moduleIdSel + '-pickedColors g.swatchGroup').remove();
        svg.selectAll(".thresholdCircle").remove();
        colorModel.reset();
    };

    this.destroy = function(){
        colorPalette.destroy();
    };

    /*
    todo: reoragnize this
    i dont like how this is all the way down here, when it is so important
    */

    this.load();
};

})(UnixjQuery, UnixUnderscore);
