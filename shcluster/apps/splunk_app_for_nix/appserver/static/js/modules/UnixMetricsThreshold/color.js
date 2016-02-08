/*
Allows the user to specify a gradient
*/

(function($, _){

// window.Color = function(svg, grad, range, defaultColors, moduleId, posData, onSave, remoteStorageFactory){
window.Color = function(args){
    var svg = args.svg,
        grad = args.grad,
        range = args.defaultColors,
        defaultColors = args.defaultColors || [],
        moduleId = args.moduleId,
        posData = args.position,
        onSave = args.onSave,
        onLoad = args.onLoad,
        remoteStorageFactory = args.remoteStorageFactory,
        $picker,
        pickerEl,
        gutterHeight, gutterWidth, gutterPadding, gutterY, // NOTE: make these appropriate for horiz/vertical padding situations
        width,
        height,
        paddingLeft,
        paddingTop,
        pickerWidth,
        pickerHeight,
        axisGroup,
        pickerIsActive = false,
        swatchWidth = 10,
        swatchHeight = posData.height - 4,
        numColors = 0,
        drag,
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

    paddingLeft = posData.paddingLeft;
    width = posData.width;
    height = posData.height;
    paddingTop = posData.paddingTop;

    colorModel = new ColorModel(data, moduleId, remoteStorageFactory, 'leftToRight');

    // Scales
    ////////////////////////////

    scaleToGutter = d3.scale.linear()
        .domain([0, 100])
        .range([paddingLeft, width+paddingLeft]);
    normalizeGutterScale = scaleToGutter.invert;

    scaleToGrad = d3.scale.linear()
        .domain([paddingLeft, width+paddingLeft])
        .range([0,100]);

    // Color Picker Setup
    ////////////////////////////
    

    // these are set in css
    // TODO: set via params
    pickerWidth = 200; pickerHeight = 200;

    // TODO: set via params
    pickerEl = document.getElementById(moduleId + '-picker');
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
    $picker = $(pickerEl);

    // This fixes annoying image dragging behavior in firefox
    d3.select(pickerEl).selectAll('rect')
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

    /*
    Handle inserting new gradient swatches
    */
    axisGroup = svg.select('.thresholdBg')
        .on('click', function(){
            // NOTE: this needs to move left to right instead of top-down
            var bounding, x;
            
            bounding = d3.event.target.getBoundingClientRect();
            x = (d3.event.clientX - bounding.left) / width * 100;

            if(!pickerIsActive){
                insertNewThreshold("#000000", x);
                self.save();
                colorModel.setToLatest(); // latest being the one we just added via insertNewThreshold
                openColorPicker(d3.event.offsetX, d3.event.offsetY);
            }
            // todo: need an else here to handle requests for new colors when picker already open. Ask Cary
        });

    function updateCurrentColor(updates){
        colorModel.updateCurrent(updates);
        // updateGridArc(colorModel.current);
        updateSwatch(colorModel.current);
    }

    function updateSwatch(swatchData){
        swatchData.swatch.select('rect').attr('fill', swatchData.color);
        // swatchData.swatch.attr('x', swatchData.x/100 * gutterHeight + swatchSize/2);

        grad.moveHardStop(swatchData.gradStop, swatchData.x);
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
            x = swatchData.x,
            color = swatchData.color,
            gradStop = swatchData.gradStop,
            gradStopEdge = swatchData.gradStopEdge,
            firstClickTime = null,
            doubleClickTimer,
            drag,
            num,
            yGutter,
            thresholdGroup;
        
        thresholdGroup = svg.select('.thresholdGroup');

        drag = d3.behavior.drag()
            // .origin(Object) // this doesnt work but supposedly handles origin dragging
            .on("drag", handleDrag);

        function handleDrag(d){
            var bounding, y, x, el,
                xGrad,
                yOffset;
            
            bounding = thresholdGroup.node().getBoundingClientRect();
            y = (d3.event.sourceEvent.clientY - bounding.top - (swatchHeight));
            x = (d3.event.sourceEvent.clientX - bounding.left - (swatchWidth));

            // todo: implement - minor shift when dragging
            // offsetY = d3.event;
            yOffset = 0; xOffset = 0;
            //todo: this should be outputting scaled data based upon the height of the UI
            yGutter = Math.max(0, Math.min(width, d3.event.y));
            xGutter = Math.max(paddingLeft, Math.min(width+paddingLeft, d3.event.x));
            xGrad = scaleToGrad(xGutter);

            // This gives a nice "snapping" behavior when dragging off the swatch
            // The user can drag off the swatch when they want to delete a threshold
            if(Math.abs(y) > 35){
                d3.select(this)
                    .attr('transform', buildTranslate(y, xGutter - xOffset));
                deleteThreshold(swatchData);
                closeColorPicker();
            } else {
                d3.select(this)
                    .attr('transform', buildTranslate(xGutter - xOffset-(swatchWidth/2), 2));
            }
            
            // yGrad = scaleToGrad(yGutter);
            grad.moveHardStop(gradStop, xGrad);
            // grad.moveEdgeStop(gradStopEdge, yGrad);

            // swatchData.y = normalizeGutterScale(yGutter);
            swatchData.x = xGrad;

            num = d3.select(this).select('text.pos');
            updateNum(num, xGrad);

            self.save();
        }

        // inserting a new swatch
        swatch = thresholdGroup.append('g')
            .attr('class', 'swatchGroup')
            .attr('transform', buildTranslate(scaleToGutter(swatchData.x)-(swatchWidth/2), 2) )
            .call(drag)
            .on('click', function(){
                if(firstClickTime === null){
                    firstClickTime = d3.event.timeStamp; 
                } else {
                    // handle double click
                    if(d3.event.timeStamp - firstClickTime < 600){ // todo: this threshold should be tweaked
                        openColorPicker(d3.event.offsetX, d3.event.offsetY);
                        colorModel.setCurrent(swatchData);

                        firstClickTime = d3.event.timeStamp;
                    } else {
                        firstClickTime = d3.event.timeStamp;
                    }
                }
            });

        swatch.append('line')
            .attr('x1', swatchWidth/2).attr('x2', swatchWidth/2)
            .attr('y1', -2).attr('y2', height)
            .attr('class', 'gripperMark')
            // this gets nice 1px lines
            // todo: fix these offsets for chrome/firefox; off by one pixel for chrome
            .attr('shape-rendering', "crispEdges");

        swatch.append('rect')
            .attr('class', 'swatchColor')
            .attr('width', swatchWidth)
            .attr('height', swatchHeight)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('fill', color);
        
        swatch.append('line')
            .attr('x1', swatchWidth/2).attr('x2', swatchWidth/2)
            .attr('y1', 4).attr('y2', swatchHeight-4)
            .attr('class', 'gripperMark')        
            .attr('shape-rendering', "crispEdges"); // this gets nice 1px lines

        num = swatch.append('text')
            .attr('class','pos')
            .attr('y', height+paddingTop-2);
        updateNum(num, x);

        return swatch;
    }

    function updateNum(el, num){
        num = Math.round(num);
        if(num === 0 || num === 100){
            el.text('');
        } else {
            el.text(num);
        }
    }

    function buildNewThreshold(color, x){
        var arc, gradStop, swatchData, 
            swatch, gradStopData,
            num;

        //todo: this is a bad way of doing this
        if(numColors === 0){
            d3.select(grad.getHighest()).remove();
        }
        numColors++;

        // arc = insertGridArc(y);
        gradStopData = {
            'color': color,
            'position': x
        };
        // gradStop = grad.insert(gradStopData);

        gradStop = grad.insertHardEdge(gradStopData);
    
        swatchData = {
            'color': color,
            'x': x,
            'gridArc': arc,
            'gradStop': gradStop
        };

        swatch = insertSwatch(swatchData);
        swatchData.swatch = swatch;

        return swatchData;
    }

    function insertNewThreshold(color, x){
        var threshold = buildNewThreshold(color, x);
        colorModel.add(threshold);
    }

    function deleteThreshold(thresholdData){
        grad.remove(thresholdData.gradStop);
        thresholdData.swatch.remove();
        colorModel.remove(thresholdData);
    }

    function openColorPicker(clickX, clickY){
        pickerIsActive = true;

        var x, y, bounding, wrapperLeft, wrapperTop, totalWidth, pageWidth;

        pageWidth = $(document).width();
        totalWidth = $('#'+ moduleId + " svg").width();
        bounding = svg.node().getBoundingClientRect();

        wrapperLeft = $wrapper.offset().left;
        wrapperTop = $wrapper.offset().top;
        x = bounding.left - pickerWidth - gutterWidth * 4 - wrapperLeft;
        y = bounding.top - wrapperTop;

        x = clickX - width;

        if(totalWidth + pickerWidth/2 > pageWidth/2){
            x = -105;
        }

        y = clickY;

        // NOTE: this is fine for horizontal thresholds
        // but won't work for vertical ones
        x = -140;
        y = 5;

        colorPalette.open();
        colorPalette.$el.css({
            left: x,
            top: y
        });
    }

    this.load = function(done){
        colorModel.load(buildNewThreshold, done);
    };

    this.save = function(){
        saveData = colorModel.save();
        onSave.call(self, saveData);
    };

    this.clearDisplay = function(){
        grad.clear();
        d3.selectAll(moduleIdSel + '-pickedColors g.swatchGroup').remove();
        svg.selectAll(".thresholdCircle").remove();
        colorModel.reset();
    };

    /*
    todo: reoragnize this
    i dont like how this is all the way down here, when it is so important
    */

    this.load(onLoad);
};

})(UnixjQuery, UnixUnderscore);
