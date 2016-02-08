/*
Handles all gradient interactions, encapsulating DOM operations

Expects a d3 element, container
Container will store all the gradient definitions
*/

// temp workaround
// window.Grad = 0;

(function($, _){

window.Grad = function(container, id){
    var gradientContainer,
        gradient,
        self = this,
        edgeDistance = 1.0;

    gradientContainer = container.append("g");
    // gradient = gradientContainer.append("svg:linearGradient")
    gradient = gradientContainer.append("svg:linearGradient")
        .attr("class", "sliceGradient") // todo: shouldnt be hard coded
        .attr("x1", "0")
        .attr("y1", "0")
        .attr("x2", "100%")
        .attr("y2", "0%")
        .attr("spreadMethod", "pad")
        .attr('gradientTransform', function(d,i){
            // this lines up with the arcs nicely
            return buildRotate(90, 0, 0);
        })
        .attr('id', id);

    function getNumStops(){
        return $(gradient.node()).find("stop").length;
    }

    /*
    colorData: [
        {
            color: "#HEX",
            position: 0, // optional
                         // if not specified, automatically calculates frorm number of colors
                         // If omitted once, it must be omitted for all
            opacity: 1 // defaults to 1
        }, 
        ...
    ]
    */
    this.build = function(colorData){
        var offset;

        if(colorData[0].position === undefined){
            offset = 100 / (colorData.length-1);
        }

        $.each(colorData, function(i,v){
            if(offset !== undefined){
                insertColor(v.color, offset * i, v.opacity || 1);
            } else {
                insertColor(v.color, v.position, v.opacity || 1);
            }
        });
    };

    // colorData is the same format as above
    // When inserting, we must maintain order according to the stop offset
    this.insert = function(colorData){
        var newStop;

        newStop = newColor(colorData.color, colorData.position,colorData.opacity || 1);

        if(getNumStops() === 0){
            $(gradient.node()).append(newStop);
        } else {
            $(gradient.node()).find("stop").each(function(){
                var $stop = $(this);
                offset = percentToNum($stop.attr('offset').substr());
                
                if(colorData.position < offset){
                    $(newStop.node()).insertBefore($stop);
                    return false;
                }
            });
        }
        // self.logGrad();

        return newStop;
    };


    /*
    Strategy for inserting hard edges:
        Two stops are inserted
            1. Right edge - uses the previous (in the svg) color
            2. Left Edge - contains the original color
        The edges are placed close to each other (1% apart) so that they create a hard edge

        The stops move together. Also, the right stop color may change when new colors are added.

        The edges are not saved, but are instead reconstructed when the user reloads the page.
        This just cuts down on the amount of data to send / bloat.
    */
    this.insertHardEdge = function(colorData){
        var $rightEdge,
            leftEdgeData,
            rightEdgeData,
            $leftEdge,
            leftEdge,
            $prev,
            $next,
            $nextLeftEdge,
            prevColor,
            nextColor,
            rightEdge,
            y,
            id = _.uniqueId('stop-group-');

        $leftEdge = $(this.insert(colorData).node());

        rightEdgeData = {
            position: colorData.position - 1,
            color: colorData.color
        };

        rightEdge = newColor(colorData.color, rightEdgeData.position, 1);
        $rightEdge = $(rightEdge.node());
        $rightEdge.insertAfter($leftEdge);

        $rightEdge.attr('stop-group-id', id);
        $leftEdge.attr('stop-group-id', id);
        $rightEdge.attr('class', 'right-edge');
        $leftEdge.attr('class', 'left-edge');
    
        // self.logGrad();

        correctEdges();

        // the rest of the UI doesn't care about the left edge
        // unless the user is moving the stops around
        // in which case the stop is retreieved with teh stop-group-id attr
        return $rightEdge;
    };

    this.remove = function(gradStop){
        var groupID = gradStop.attr('stop-group-id');
        gradStop.siblings("[stop-group-id="+groupID+"]").remove();
        gradStop.remove();
        correctEdges();
    };

    this.clear = function(){
        $(gradient.node()).empty();
    };

    this.getHighest = function(){
        return $(gradient.node()).find('stop')[0];
    };

    /*
    so svg + jquery = bad
    this is kind of a hack to get it working
    i want to do: $(el).nextAll('.left-edge')
    BUT i cant run filters on the gradient stops

    this isnt even a full version of that idea
    */
    function getNext($node, className){
        if(className === undefined) { className = 'left-edge'; }
        var $next = $node.next();

        while($next.length && $next.attr('class') === className){
            $next = $next.next();
        }
        
        return $next;
    }

    // this was originally going to be more complicated like its brother
    function getPrev($node, className){
        return $node.prev().prev();
    }

    

    /*
    correctEdges ensures a hard-edge gradient, as long as there are
    two stops per color. The Right stop takes on the color of the
    previous left stop. This creates a hard edge between stops.
    */
    function correctEdges(){
        var $el, $prev, $next;

        $(gradient.node()).find('stop.right-edge').each(function(){
            $el = $(this);

            $prev = $el.prev();
            $next = $el.next();

            if($next.length){
                $el.attr('stop-color', $next.attr('stop-color'));
            } else {
                // if we are at the end, we simply use the previous edge
                // otherwise we get the wrong color
                $el.attr('stop-color', $prev.attr('stop-color'));
            }
        });
    }

    function correctLeftEdgePos($stop, $leftEdge){
        var $next, $prev, offset;

        offset = percentToNum($stop.attr('offset')) - 1;
        $leftEdge.attr('offset', offset+"%");
    }

    this.moveHardStop = function(stop, pos){
        if(pos > 100){
            throw "Out of range: 100 is the maximum, got "+ pos;
        }

        if(stop !== undefined){
            var $prev, $next, prevOffset, nextOffset, $stop, inOrder,
                $leftEdge, stopGroupID;

            $stop = $(stop);
            stopGroupID = $stop.attr('stop-group-id');
            $leftEdge = $stop.siblings("[stop-group-id="+stopGroupID+"]");

            inOrder = false;

            while(!inOrder){
                $prev = getPrev($stop, 'left-edge');
                $next = getNext($stop);

                if(getNumStops() < 2){
                    inOrder = true;
                    $stop.attr('offset', pos+"%");
                    return false;
                }

                if($prev.length){
                    prevOffset = this.getOffset($prev);
                } else {
                    prevOffset = null;
                }

                if($next.length){
                    nextOffset = this.getOffset($next);
                } else {
                    nextOffset = null;
                }

                if(prevOffset !== null && prevOffset > pos){
                    $stop.insertBefore($prev);
                    $leftEdge.insertBefore($stop);
                } else if(nextOffset !== null && nextOffset < pos) {
                    $stop.insertAfter($next);
                    $leftEdge.insertAfter($next);
                } else {
                    inOrder = true;
                }
                $stop.attr('offset', pos+"%");
                correctEdges();
                correctLeftEdgePos($stop, $leftEdge);
            }
        }
    };

    this.moveStop = function(stop, pos){
        if(pos > 100){
            throw "Out of range: 100 is the maximum, got "+ pos;
        }

        if(stop !== undefined){
            var $prev, $next, prevOffset, nextOffset, $stop, inOrder;

            $stop = $(stop.node());
            inOrder = false;
            
            while(!inOrder){
                $prev = $stop.prev();
                $next = $stop.next();

                if(getNumStops() < 2){
                    inOrder = true;
                    $stop.attr('offset', pos+"%");
                    return false;
                }

                if($prev.length){
                    prevOffset = this.getOffset($prev);
                } else {
                    prevOffset = null;
                }

                if($next.length){
                    nextOffset = this.getOffset($next);
                } else {
                    nextOffset = null;
                }

                if(nextOffset !== null && prevOffset > pos){
                    $stop.insertBefore($prev);
                } else if(nextOffset !== null && nextOffset < pos) {
                    $stop.insertAfter($next);
                } else {
                    inOrder = true;
                }
                $stop.attr('offset', pos+"%");
            }
        }
    };

    this.moveEdgeStop = function(stop, pos){
        this.moveStop(stop, pos+edgeDistance);
    };

    this.updateColor = function(stop, color){
        stop.attr('stop-color', color);
        var groupID = stop.attr('stop-group-id');
        stop.siblings("[stop-group-id="+groupID+"]").attr('stop-color', color);
        correctEdges();
    };

    this.getOffset = function(stop){
        if(stop === undefined) {
            return 0;
        }

        if(stop.jquery){
            stop = stop.get(0);
        }
    
        percent = d3.select(stop).attr('offset');    
        return Number(percent.substr(0, percent.length-1));
    };

    this.logGrad = function(){
        var stop, colorCss;
        $(gradient.node()).find("stop").each(function(i,stop){
            $stop = $(stop);
            colorCss = "color:"+$stop.attr('stop-color');
        });
    };

    function insertColor(color, offset, opacity, $node){
        var newStop = gradient.append("svg:stop")
            .attr("offset", offset + "%")
            .attr("stop-color", color)
            .attr("stop-opacity", opacity);

        if($node !== undefined){
            newStop = $(newStop.node()).insertBefore($node);
            newStop = newStop[0]; // we dont want to deal with jquery anywhere else
        } else {
            newStop = $(newStop.node());
            $(gradient.node()).append(newStop);
            newStop = newStop[0];
        }

        return newStop;
    }

    function newColor(color, offset, opacity){
        var newStop = gradient.append("svg:stop")
            .attr("offset", offset + "%")
            .attr("stop-color", color)
            .attr("stop-opacity", opacity);

        return newStop;
    }

};

})(UnixjQuery, UnixUnderscore);
