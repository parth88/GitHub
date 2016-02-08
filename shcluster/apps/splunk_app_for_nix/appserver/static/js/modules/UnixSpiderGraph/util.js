/*
The angles for arcs are a little odd:
    => they start at 90 degrees
    => they run clockwise

0  
|  10
| /
|/______ 90

This contrasts with an ordinary unit circle:

90  
|  80
| /
|/______ 0

So we must subtract PI/2 radians
*/

/*
If these needed _ or $, they would need to be exported
in which case, they would probably go under an umbrella object (util.correctHalfHangle(), etc)
*/

var HALFPI = Math.PI/2.0;

function correctArcAngle(theta){
    return theta - HALFPI;
}

function buildTranslate(x,y){
    return "translate("+x+","+y+")";
}

function buildRotate(theta, centerX, centerY){
    return "rotate("+theta+","+centerX+","+centerY+")";
}

function d3clone(selector) {
    var node;
    if(typeof selector === 'string'){
        node = d3.select(selector).node();
    } else {
        node = selector.node();
    }
    
    return d3.select(node.parentNode.insertBefore(node.cloneNode(true),
           node.nextSibling));
}

function percentToNum(percent){
    return Number(percent.substr(0, percent.length-1));
}

function roundTo(num, place){
    var rounded;
    rounded = num * Math.pow(10, place);
    rounded = Math.round(rounded);
    return rounded / Math.pow(10, place);
}

function truncateText(text, length){
    if(text.length < length){
        return text;
    } else {
        return text.substr(0, length) + "..";
    }
}

function removeFromArray(arr, i){
  var rest = arr.slice(i+1);
  arr.length = i;
  Array.prototype.push.apply(arr, rest);
  return arr;
}

function makeSvgLink(){

}

function escapeCss(){

}

function getLabelFitting(text, radius, arcSize){
    var x,
        minX,
        textWidth,
        fontWidth,
        fontSize,
        padding;

    // This would be more accurate if we copied the text to a temporary DOM node
    // and then measured from there. However, that would be much slower.
    fontSize = 10; // this should grab from the DOM
    fontWidth = fontSize / 1.45; // rough approximation, works for our font
    minX = radius / 2;
    padding = 5;
    textWidth = text.length*fontWidth;

    if(radius - textWidth > minX){
        x = radius - textWidth - padding;
    } else {
        x = minX;
    }

    return {
        x: x,
        textWidth: textWidth,
        fontWidth: fontWidth
    };
}

function toBoolean(str){
    if(str.toLowerCase() === 'true'){
        return true;
    } else {
        return false;
    }
}

function parseQueryString(){
    var queryBreak = window.location.href.indexOf('?');
    if(queryBreak > -1){
        var query = window.location.href.slice(queryBreak);
        return Splunk.util.queryStringToProp(query);
    } else {
        return false;
    }
}
