(function($, _){

window.SpiderPlot = function(moduleId, width, height, labelsOn, storage){
    var svg,
        numArcSegments,
        PI2 = Math.PI * 2.0,
        PI = Math.PI,
        HALFPI = Math.PI/2.0,
        RAD2DEG = 180/Math.PI,
        DEG2RAD = Math.PI/180,
        arcSize,
        colors,
        arc,
        radius,
        scale,
        reverseScale,
        max,
        isReady = false,
        gridMarkerRadii = [],
        groupArc,
        grad,
        hostSlices = [],
        peaks = [],
        peakDuration = 10000,
        colorPicker,
        moduleIdSel = "#"+moduleId,
        $wrapper = $(moduleIdSel),
        arcTweenArc,
        /*
        We have to store unique IDs for groups so we can go back and select them later
        There's probably a better way of doing this but this is fine for how
        my elements are organized now.
        */
        groupElementIds = {}, 
        groupKey = "group",
        circleGradContainer = 'circleGradContainer'
        groupAngles = [];

    if(width < height){
        radius = width / 1.8;
    } else {
        radius = height / 2.4;
    }

    /*
    plot should be called first
    we could do this in the constructor, but then there is no way to instantiate the graph and draw it later.
    Could do it in constructor and provide the user with a parameter for initial rendering.
    */
    this.plot = function(data, min, max){
        var currentAngle = 0,
            numHosts = 0,
            bgData = [radius],
            prevGroupSize = 0;

        resetScale(data, min, max);
        isReady = true;

        numArcSegments = modelUtil.countItems(data);

        // in radians
        arcSize = PI / numArcSegments;

        arcTweenArc = d3.svg.arc()
            .innerRadius(0)
            .startAngle(0)
            .endAngle(arcSize);

        svg = d3.select(moduleIdSel + ' svg g.wrapper');

        // Background
        /////////////////////
        svg.selectAll('bg')
            .data(bgData).enter()
                .append('path')
                .attr('d', function(d){
                    arc = d3.svg.arc()
                        .innerRadius(0)
                        .startAngle(0)
                        .outerRadius(d)
                        .endAngle(PI);
                    return arc();
                })
                .attr('class', 'bg');

        // Temp. grad circles
        /////////////////////

        // var tempCircleData = [radius, radius-100, radius-200];
        var tempCircleData = [radius, radius-100, radius-200];
        var tempCircleGroup = svg.append('defs')
            .attr('class','gradCircle')
            .attr('clip-path', 'url(#tempClipPath)');
            
        tempCircleGroup.selectAll('bgCircle')
            .data(tempCircleData).enter()
                .append('circle')
                .attr('r', function(d){
                    return d;
                })
                .attr('fill', function(d, i){
                    if(d === radius){
                        return '#D9B1DE';
                    } else if(d === radius-100){
                        return '#B1BADE';
                    } else {
                        return '#B1DEDE';
                    }
                })
                .attr('id', function(d,i){
                    return "bgCircle-"+i;
                })
                .attr('class', 'tempCircle');

        var tempClipGroup = svg
            .append('clippath')
                .attr('id', 'tempClipPath')

        // Draw Hosts, Groups, Peaks
        ///////////////////////////////
        _.each(data, function(group, j){
            var group_name = group.name.replace(/[ #\.]/g, '_'), 
                currentGroup = svg.append('g')
                .attr('transform', function(){
                    var currentGroupAngle = arcSize * prevGroupSize;
                    groupAngles.push(currentGroupAngle);
                    return buildRotate(currentGroupAngle * RAD2DEG, 0, 0);
                })
                // .attr('id', moduleId + '-' +group.name)
                .attr('id', function(d,i){
                    var id = _.uniqueId('group-');
                    groupElementIds[group.name] = id;
                    return id;
                })
                .attr('class', 'group');

            hostGroup = currentGroup.selectAll('hostGroup')
                .data(group.data).enter()
                    // .append('g')
                    .append('g')
                        .attr('transform', function(d,i){
                            return buildRotate(arcSize*i*RAD2DEG,0,0);
                        })
                        .attr('class', 'hostGroup')
                        .on('click', function(d){
                            console.debug('go', d);
                        });

            // this lines separates groups
            currentGroup
                .append('line')
                    .attr('x1', 0)
                    .attr('y1', 0)
                    .attr('x2', 0)
                    .attr('y2', -(radius+50))
                    .attr('class', 'groupMarker');
            
            peaks[j] = hostGroup.append('path')
                .attr('class', 'peak')
                .each(function(d) {
                    var peak = this;
                    this._highest = d.metric;

                    this._resetTimer = window.setInterval(function(){
                        (function(peak){
                            resetPeak(peak);
                        })(peak);
                    }, peakDuration);
                });

            /* 
                this will eventually turn into an arc
                via update() => arctween()

                we animate the clipping paths so the gradient
                does not scale. See setupHostBackground() for more info.
            */
            hostSlices[j] = hostGroup.append('g')
                .append('clipPath')
                    .attr('id', function(d,i){
                        var id = moduleId+"-hostClip-"+group_name+"-"+i;
                        return id;
                    })
                    .append('path')
                        // this may be used in the future
                        // .attr('fill', function(d,i){
                        //     return "hsl("+150+","+(i*10+20)+"%,"+((i*10+30)-15) +"%)";
                        // })
                        .each(function(d) { this._current = d.metric; })
                        .attr('id', function(d,i){
                            var id = moduleId+"-hostClipPath-"+group_name+"-"+i;
                            return id;
                        })

            // tempClipGroup.selectAll('path')
            //     .data(group.data).enter()
            //         .append('use')
            //             .attr('xlinkhref', function(d,i){
            //                 var id = '#'+moduleId+"-hostClipPath-"+group.name+"-"+i;
            //                 return id;
            //             })
            //             // .each(function(d) { this._current = d.metric; });

            // $("use[xlinkhref]").each(function(){
            //     var val = $(this).attr('xlinkhref');
            //     $(this).attr('xlink:href', val);
            //     $(this).removeAttr('xlinkhref');
            // })

            var circleGradContainer = currentGroup.selectAll('circleGradContainer');

            setupHostBackground(hostGroup, group_name, j);
            prevGroupSize += group.data.length;
        });

        // Draw Gradients
        //////////////////////
        grad = new Grad(svg, moduleId + '-hostBg', circleGradContainer, radius);
        $(".logGrad").on('click', function(){
            grad.logGrad();
        });

        // Gradients must be assigned
        svg.selectAll('path.slice')
            .style("fill", function(d,i){
                return "url(#"+moduleId+"-hostBg)";
            });
 
        this.update(data);

        drawGridMarkers(4);
        drawHostMarkers(data);
        drawGroupMarkers(data, groupAngles);

        // This goes last because it depends upon a complete dom
        colorPicker = new Color(svg, grad, [0, max], [0,radius], ["#ff5405", "#ffb76b"], moduleId, radius, storage);

        $wrapper.find(".loadTest").on("click", function(){
            colorPicker.load();
        });

        $wrapper.find(".clearTest").on("click", function(){
            colorPicker.clearDisplay();
        });
    };

    this.update = function(newData){
        if(!isReady){
            throw "Must run plot() first";
        }

        removeGroupMarkers();
        drawGroupMarkers(newData, groupAngles);

        _.each(newData, function(group, i){
            hostSlices[i].data(group.data);
            hostSlices[i].transition()
                .duration(500)
                // .duration(onlyAnimateChanged)
                .attrTween("d", arcTween);
            peaks[i].data(group.data);
            peaks[i].transition().duration(400).attrTween("d", peakTween);
            // peaks[i].transition().duration(onlyAnimateHigherPeaks).attrTween("d", peakTween);
        });
    };

    this.destroy = function(){
        if(svg !== undefined){
            $(svg.node()).empty();
        }

        if(colorPicker !== undefined){
            colorPicker.destroy();
        }
    };

    function resetScale(data, min, max){
        scale = d3.scale.linear()
            .domain([0, max])
            .range([0, radius]);

        // This allows us to draw the y-axis values
        // we have to translate from the circle's units to the domain values
        reverseScale = scale.invert;
    }

    // Other arc animation
    ////////////////////////////

    function onlyAnimateChanged(d,i){
        if(d.metric === d._current){
            return false;
        } else {
            return 500;
        }
    }

    // Peak Animation
    ////////////////////////////
    function onlyAnimateHigherPeaks(d,i){
        if(d.metric > this.highest){
            return 400;
        } else {
            return 0;
        }
    }

    function arcTween(d, i) {
        var interp;

        interp = d3.interpolate(this._current, d.metric);
        this._current = d.metric;

        return function(t) {
            arcTweenArc.outerRadius(function(){
                return scale(interp(t));
            });
            return arcTweenArc();
        };
    }

    function peakTween(d,i){
        var arc, interp, peak;

        peak = this;
        
        arc = d3.svg.arc()
            .startAngle(0)
            .endAngle(arcSize);

        if(d.metric > this._highest){ // new peak
            interp = d3.interpolate(this._highest, d.metric);

            this._highest = d.metric;
            if(this._resetTimer !== undefined || this._resetTimer !== null){
                // must remove the old timer in order to restart the interval
                window.clearTimeout(this._resetTimer);
                this._resetTimer = window.setInterval(function(){
                    (function(peak){
                        resetPeak(peak);
                    })(peak);
                }, peakDuration);
            }
        } else {
            interp = d3.interpolate(this._highest, this._highest);
        }

        return function(t) {
            arc.outerRadius(function(){
                return scale(interp(t));
            });
            arc.innerRadius(function(){
                return scale(interp(t));
            });
            return arc();
        };
    }

    function resetPeak(peak){
        d3.select(peak).transition().duration(700).attrTween("d", tweenToZero);
    }

    function tweenToZero(d){
        var arc, interp;
        
        arc = d3.svg.arc()
            .startAngle(0)
            .endAngle(arcSize);

        interp = d3.interpolate(this._highest, d.metric);
        this._highest = d.metric;

        return function(t) {
            arc.outerRadius(function(){
                return scale(interp(t));
            });
            arc.innerRadius(function(){
                return scale(interp(t));
            });
            return arc();
        };
    }

    /*
    This is clipped by the hosts slices themselves
    We must do this becuase we do not want the gradients to scale
    with the slices. This lets us have real threshhold values
    on the gradient. 
    */
    function setupHostBackground(hostGroup, groupName, j){
        var hostBg, arc,
            gradContainer;

        arc = d3.svg.arc()
            .innerRadius(0)
            .startAngle(0)
            .endAngle(arcSize)
            .outerRadius(radius);

        hostBg = hostGroup.append('path')
            .attr('d', arc)
            .attr('class', 'hostBg');

        /*
        These defer statements ensure that Firefox will render 
        the clipping appropriately. This bug is reproducable in Firefox 23 at least.
        See JIRA: NIX-370
        */
        _.defer(function(){
            hostBg.attr('clip-path', function(d,i){
                return "url(#"+ moduleId +"-hostClip-"+groupName+"-"+i+")";
            });
        });

        gradContainer = hostGroup.append('g')
            .attr('class', 'circleGradContainer');

        _.defer(function(){
            gradContainer.attr('clip-path', function(d,i){
                return "url(#"+ moduleId +"-hostClip-"+groupName+"-"+i+")";
            });
        });
    }

    /*
    These are the concentric circles that show the y-axis
    This also draws the y-axis itself

    If the user changes the scale, we need to animate the scales to new positions
    We may also need to draw new scale markers entirely
    Right now this doesnt do any of that!
    */
    function drawGridMarkers(num){
        var i,
            gridArc,
            markerEnter,
            axisSubgroup,
            line,
            axis,
            grid,
            gapDistance = 80;

        for(i = 0; i < num; i++){
            // we use i+1 here because otherwise we dont get a complete range
            gridMarkerRadii[i] = radius/num * (i+1);
        }

        gridArc = d3.svg.arc()
            .innerRadius(0)
            .outerRadius(function(d,i){
                return d;
            })
            .startAngle(0)
            .endAngle(PI);

        markerEnter = svg.append('g')
            .attr('class', 'axisGroup');
        
        axis = markerEnter.append('g')
            .attr('class', 'axis')
            .attr('transform', buildTranslate(-gapDistance,0))
                .selectAll('gridMarker')
                .data(gridMarkerRadii).enter();


        grid = markerEnter.selectAll('gridMarker')
            .data(gridMarkerRadii).enter();
            
        grid.append('path')
            .attr('d', gridArc)
            .attr('class', 'gridMarker');

        axisSubgroup = axis.append('g')
            .attr('transform', function(d,i){
                return buildTranslate(0, -d);
            });

        axisSubgroup.append('text')
            .text(function(d,i){
                // This gets us nice axis values
                return roundTo(reverseScale(d), 2);
            })
            .attr('text-anchor','right')
            .attr('dy', -3);

        // remove functions if these wind up being correct
        axisSubgroup.append('line')
            .attr('x1', function(d,i){
                return 0;
            })
            .attr('y1', function(d,i){
                return 0;
            })
            .attr('x2', function(d,i){
                return gapDistance;
            })
            .attr('y2', function(d,i){
                return 0;
            });
    }

    /*
    Our data is separated into groups
    Each group contains a bunch of hosts (or whatever you're measuring from)
    This draws markers that indicate where groups start and end

    The problem with drawing these are arcs it that I get less control over the css
    Style must be applied to both the line part and the rounded circle part
    Could be a proble, could be fine. Depends upon our needs.
    */
    function drawGroupMarkers(data, groupAngles){
        var groupArc,
            prevEnd,
            start,
            end,
            byGroup,
            groupMarker,
            halfAngle,
            // we need to store the angles 
            // so we can move the label to the proper position
            // it's easier than parsing the angle from the path's "d" attribute
            angles = [],
            groupSeparator,
            theta = 0,
            prevTheta = 0;

        prevEnd = 0;

        // These are the lines between groups
        groupSeparator = d3.svg.line()
            .x(function(d,i){
                var theta = correctArcAngle(d.count * arcSize);
                return (radius+20) * Math.cos(theta);
            })
            .y(function(d,i){
                var theta = correctArcAngle(d.count * arcSize);
                return (radius+20) * Math.sin(theta);
            });

        byGroup = modelUtil.countByGroup(data, groupKey);

        groupMarker = svg.selectAll('groupMarker')
            .data(data).enter();

        function getAngle(i){
            if(i+1 < groupAngles.length){
                theta = (groupAngles[i] + groupAngles[i+1]) / 2;
            } else {
                // this is hard coded to be half the circle
                // if we experiment with other sizes, this will have to change
                theta = (groupAngles[i] + PI) / 2;
            }
            theta = correctArcAngle(theta);
            return theta;
        }

        groupMarker.append('text')
            .text(function(d){
                return d.name;
            })
            .attr("dx", function(d,i){
                return (radius+10)/2;
            })
            .attr("dy", function(d,i){
                return 0-(radius+10);
            })
            .attr("text-anchor", "left")
            .attr('class', 'groupLabel');
    }

    function removeGroupMarkers(){
        svg.selectAll('.groupLabel').remove();
    }


    /*
    These markers appear around host's slices
    This shows separation from the group

    todo: maybe put this up in plot and integrate it with the current stuff there
    it might make it more flexible for the future.
    this could really go within plot's loops
    */
    function drawHostMarkers(data){
        var theta,
            sliceGroup,
            slope;

        markerArc = d3.svg.arc()
            .innerRadius(0)
            .outerRadius(radius)
            .startAngle(0)
            .endAngle(arcSize);

        _.each(data, function(group, i){
            sliceGroup = svg.selectAll('.group#'+groupElementIds[group.name]+' .hostGroup')
                .data(group.data)
                .append('g');

            sliceGroup
                .append('path')
                    .attr('d', markerArc)
                    .attr('class', 'hostMarker');

            sliceGroup
                .append('g')
                
            // $("defs.gradCircle").children().clone().appendTo($(sliceGroup[0]))

            // d3 bug doesn't allow the colon
            // $("use[xlinkhref]").each(function(){
            //     var val = $(this).attr('xlinkhref');
            //     $(this).attr('xlink:href', val);
            //     $(this).removeAttr('xlinkhref');
            // })

            sliceGroup
                .append('text')
                    .text(function(d){
                        var truncateTo, fittingData;
                        // d.name = "sometingreallyreallyreallylongsometingreallyreallyreallylong"
                       
                        fittingData = getLabelFitting(d.name, radius, arcSize);

                        if(fittingData.x + fittingData.textWidth > radius){
                            truncateTo = Math.round(Math.abs(radius-fittingData.x) / fittingData.fontWidth)-3;
                            return truncateText(d.name, truncateTo);
                        } else {
                            return d.name;
                        }
                    })
                    .attr('class', function(){
                        if(!labelsOn) { return "hidden"; }
                        else { return "hostText"; }
                    })
                    .attr('transform', function(d,i){
                        return buildRotate(-(90 - (arcSize*RAD2DEG/2)), 0, 0);
                    })
                    .attr('dx', function(d,i){
                        var text, fittingData;
                        text = d.name;
                        fittingData = getLabelFitting(text, radius, arcSize);

                        return fittingData.x;
                    })
                    .attr('dy', function(d,i){
                        /*
                        This works because of the rotation
                        once we rotate, Y is now defined the movement along the Y part of the rotated line
                        This basically means it defines how centered the text is within the slice

                        Most importantly, rotation seems to occur after the 'dy' and 'dx' attributes are set

                        The +5 probably has to do with the pixel size of the font
                        */
                        return arcSize/2 + 5;
                    });
        });
        
    }
};

})(UnixjQuery, UnixUnderscore);
