/*
Handles all gradient interactions, encapsulating DOM operations

Expects a d3 element, container
Container will store all the gradient definitions
*/

(function($, _){

window.Grad = function(parentContainer, id, containerClass, radius){
    var gradientContainer,
        gradient,
        containers,
        $containers,
        $parentContainer,
        self = this,
        toRadiusScale,
        numColors=0,
        edgeDistance = 1.0;

    containerClass = '.'+containerClass;
    $parentContainer = $(parentContainer.node());
    containers = parentContainer.selectAll(containerClass);
    $containers = $parentContainer.find(containerClass);

    toRadiusScale = d3.scale.linear()
        .domain([100, 0])
        .range([0, radius]);

    function getNumCircles(){
        return $containers.eq(0).find("circle").length;
    }

    function iterateCircles(cb){
        $containers.each(function(){
            $(this).children().each(function(i){
                var $circle = $(this);
                cb($circle, i);
            });
        });
    }

    function correctNewCircleColors(newCircles){
        var $circle,
            $prev,
            prevColor,
            $next;

        _.each(newCircles[0], function(circle){
            $circle = $(circle);
            $prev = $circle.prev();
            $next = $circle.next();

            if($prev !== undefined && $prev.length){
                prevColor = $prev.attr('fill');
                $prev.attr('fill', $circle.attr('fill'));
                if($next.length){
                    $circle.attr('fill', prevColor);                
                }
            }


        });
    }

    // When inserting, we must maintain order according to the stop offset
    this.insert = function(colorData){
        var newColorCircles,
            $container,
            container,
            prevRadius,
            newColorPos,
            found,
            $circle,
            circle,
            currentRadius,
            $this,
            foundIdx;

        if(numColors === 0){
            /*
            These can be inserted all at once because 
            there's no order to enforce yet
            */
            appendNewColorCircle(containers, colorData.color, 0);
            newColorCircles = appendNewColorCircle(containers, colorData.color, colorData.position);

        } else {
            /*
            This assumes that the first container contains identical items
            so we can use it to figure out the proper insertion point
            */
            $container = $containers.eq(0);
            newColorPos = toRadiusScale(colorData.position);
            found = false;

            /*
            Find a spot to insert the new color
            We want to keep the DOM sorted, so everything
            overlaps properly.
            */
            $container.children().each(function(i){
                $circle = $(this);
                currentRadius = Number($circle.attr('r'));

                if(prevRadius === undefined){
                    if(currentRadius < newColorPos){
                        found = true;
                        foundIdx = i;
                        return false;
                    } else {
                        prevRadius = currentRadius;
                    }
                } else {
                    if(prevRadius > newColorPos && newColorPos >= currentRadius){
                        found = true;
                        foundIdx = i;
                        return false;
                    } else {
                        prevRadius = currentRadius;
                    }
                }
            });

            if(found){
                $containers.each(function(){
                    $container = $(this);
                    container = d3.select($container[0]);
                    circle = container.append('circle')
                        .attr('r', toRadiusScale(colorData.position))
                        .attr('fill', colorData.color)
                        // This class is used so we can make a selection later
                        // it's a bit of a hack
                        .attr('class', 'temp__')

                    $circle = $(circle.node());
                    $container.children().eq(foundIdx).before($circle);
                });

                newColorCircles = $containers.find('.temp__');
                newColorCircles = d3.selectAll(newColorCircles);
                newColorCircles.classed('temp__', false);
                correctNewCircleColors(newColorCircles);
            } else {
                /*
                If we didn't find a spot, it means we must insert at the bottom end
                */
                newColorCircles = appendNewColorCircle(containers, colorData.color, colorData.position);
                correctNewCircleColors(newColorCircles);
            }
        }

        numColors++;
        self.logGrad();
        return newColorCircles;
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
        var $circle;

        $circle = this.insert(colorData);
        return $circle;
    };

    this.remove = function(circles){
        var $circle,
            $circles,
            $prev, 
            color;

        $circle = $(circles[0][0]);
        $circles = $(circles);
        color = $circle.attr('fill');

        if(isBottomEnd($circle)){
            $circles.each(function(){
                $prev = $(this).prev();
                color = $prev.prev().attr('fill');
                $prev.attr('fill', color);
            });
        } else {
            /*
            We must fill in the void from removing this circle
            */
            $circles.each(function(){
                $(this).prev().attr('fill', color);
            });
        }

        circles.remove();

        if(isEmpty()){
            $containers.find('circle').attr('fill', 'white');
        }

        numColors--;
    };

    this.clear = function(){
        $containers.find('circle').remove();
    };

    // this.getHighest = function(){
    //     return $containers.find('circle').first();
    // };

    function appendNewColorCircle(containers, color, offset){
        var circles = containers.append('circle')
            .attr('r', toRadiusScale(offset))
            .attr('fill', color);

        return circles;
    }

    // this should work for jQuery or D3 elements 
    function setCirclePos(circle, pos){
        if(_.isString(pos)){
            pos = Number(pos);
        }
        circle.attr('r', toRadiusScale(pos));
    }

    /*
    only works if $a is a higher radius than $b
    the bottom of the elements (what $b might represent)
    has extra elements
    */
    function swapColors($a, $b){
        var $bNext, $bPrev,
            $aNext, $aPrev,
            tempColor;

        $bNext = $b.next();
        $bPrev = $b.prev();
        $aNext = $a.next();
        $aPrev = $a.prev();

        tempColor = $b.attr('fill');
        $b.attr('fill', $a.attr('fill'));
        $a.attr('fill', tempColor);

    }

    /*
    The top end has a two circles
    The very top is actually always the radius of the whole container
    */
    function isTopEnd($circle){
        return $circle.prev().prev().length === 0;
    }

    function isBottomEnd($circle){
        return $circle.next().length === 0;
    }

    function isEmpty(){
        return $containers.eq(0).children().length < 2;
    }

    function copyToAllCircles($copyableContainer){
        var $sources = $copyableContainer.children(),
            $source;

        iterateCircles(function($circle, i){
            $source = $sources.eq(i);
            $circle.attr('fill', $source.attr('fill'));
            $circle.attr('r', $source.attr('r'));
        });
    }

    this.moveHardStop = function(stop, pos){
        if(pos > 100){
            console.error("Out of range: 100 is the maximum, got ", pos);
        }

        if(stop !== undefined){
            stop.attr('r', toRadiusScale(pos));
        } else {
            console.error('Stop is undefined');
        }
    };

    this.moveStop = function(circle, pos){
        if(pos > 100){
            console.error("Out of range: 100 is the maximum, got ", pos);
        }

        if(circle !== undefined){
            var $prev, $next, prevOffset, 
                nextOffset, $circle, inOrder,
                _isTopEnd, currentColor,circleColor,
                formerNextColor, nextColor,
                scaledPos;

            $circle = $(circle.node());
            inOrder = false;
            scaledPos = toRadiusScale(pos);
            // pos = toRadiusScale(pos);
            
            if(!inOrder){
                $prev = $circle.prev();
                $next = $circle.next();

                if(getNumCircles() < 2){
                    inOrder = true;
                    setCirclePos(circle, pos);
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

                /*
                Elements are arranged with the highest radius circle
                at the top and the lowest at the bottom.
                We work element-by-element because the list was sorted
                to begin with.
                */

                // Moving Down
                if(nextOffset !== null && scaledPos < nextOffset){

                    _isTopEnd = isTopEnd($circle);
                    currentColor = $circle.prev().attr('fill');
                    circleColor = $circle.attr('fill');
                    formerNextColor = $circle.next().attr('fill');

                    $circle.insertAfter($next);
                    nextColor = $circle.next().attr('fill');

                    $circle.attr('fill', formerNextColor);
                    $circle.prev().attr('fill', currentColor);
                    $circle.prev().prev().attr('fill', circleColor);

                } else if (prevOffset !== null && scaledPos > prevOffset){
                    // Moving Up
                    currentColor = $circle.prev().attr('fill');
                    circleColor = $circle.attr('fill');

                    $circle.insertBefore($prev);

                    prevColor = $circle.prev().attr('fill');

                    $circle.attr('fill', prevColor);
                    $circle.prev().attr('fill', currentColor);
                    $circle.next().attr('fill', circleColor);
                }

                setCirclePos(circle, pos);
                copyToAllCircles($circle.parent());
            }
        }
    };

    this.updateColor = function(circles, color){
        var $circle,
            $prev,
            $next;

        circles.each(function(d){
            $circle = $(this);
            $prev = $circle.prev();
            $next = $circle.next();

            if($prev.length){
                $prev.attr('fill', color);
            }

            // The last circle actually has
            // two circles sharing the same color:
            //     1. itself
            //     2. the next circle
            // ordinary circles only have the color of the previous swatch
            if($next.length === 0){
                $circle.attr('fill', color);
            }
        });
    };

    this.getOffset = function(stop){
        if(stop === undefined) {
            return 0;
        }

        return Number(stop.attr('r'));
    };

    this.logGrad = function(){
        $containers.eq(0).children().each(function(i){
            var $circle = $(this);
            colorCss = "color:"+$circle.attr('fill');
        });

    };

};

})(UnixjQuery, UnixUnderscore);
