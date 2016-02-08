/**
 * floatHead - jQuery plugin to float a table head as user scrolls down the table
 * @author rarsan
 *  
 * Usage: $('table').floatHead()
 *
 */

(function($) {

    // private variables
    var namespace = 'floatHead';
    var defaults = {
        backgroundColor: '#eaeaea', // background color to use for floating head for contrast
        topOffset: 0                // additional offset from top of window
    };

    // public methods
    var methods = {
        init: function(options) {
            var opts =  $.extend({}, defaults, options);

            return this.each( function() {
                var $obj = $(this),
                    $head = $('thead', $obj),
                    $headCopy = null,
                    isFloated = false,
                    isFloatReady = (typeof $obj.data(namespace) != 'undefined');
                
                if ($head.length === 0) {
                    console.warn('[floatHead] could not find thead in current object');
                    return false;
                }

                $head.addClass('float-head').css({
                    'background-color': opts.backgroundColor
                });

                // if plugin already set on current obj, remove previously added node
                if (isFloatReady) { $('float-head-copy', $obj).remove(); }

                $headCopy = $head.clone().removeClass('float-head')
                                 .addClass('float-head-copy float-head-fixed')
                                 .css({top: opts.topOffset + 'px', display: 'none'})
                                 .appendTo($obj);

                // save state & cache object references
                var data = {
                    head: $head,
                    headCopy: $headCopy,
                    headTop: $head.offset().top - opts.topOffset,
                    headBottom: $obj.offset().top + $obj.height() - $head.height(),
                    isFloated: isFloated,
                    settings: opts
                };
                $obj.data(namespace, data);
                $obj.floatHead('_resize', $head, $headCopy);

                if (!isFloatReady) {
                    $(window).bind('scroll', function(event) {
                        $obj.floatHead('_scroll');
                    });
                    $(window).bind('resize', function(event) {
                        $obj.floatHead('_resize');
                    });
                }

                $obj.floatHead('_scroll');
            });
        },

        _resize: function($head, $headCopy) {
            var $obj = $(this),
                data = $obj.data(namespace);

            $head = $head || data.head;
            $headCopy = $headCopy || data.headCopy;

            // sync thead row widths
            $headCopy.width($head.width());

            // sync thead columns widths
            $('> tr:first > th', $head).each(function (i, h){
                var w = $(h).width();
                $headCopy.find('> tr > th:eq('+i+')').width(w);
            });

            return $obj;
        },

        _scroll: function($head, $headCopy) {
            var $obj = $(this);
            if (!$obj.is(':visible')) { return; }

            var data = $obj.data(namespace),
                scrollTop = $(window).scrollTop(),
                headTop = data.headTop,
                headBottom = data.headBottom,
                hasChanged = false;

            $head = $head || data.head;
            $headCopy = $headCopy || data.headCopy;

            // float/unfloat table head
            if (!data.isFloated && (scrollTop > headTop && scrollTop <= headBottom)) {
                $headCopy.show();
                data.isFloated = true;
                hasChanged = true;
            } else if (data.isFloated && (scrollTop <= headTop || scrollTop > headBottom)) {
                $headCopy.hide();
                data.isFloated = false;
                hasChanged = true;
            }

            // update head top & bottom
            var newHeadTop = $head.offset().top - data.settings.topOffset,
                newHeadBottom = $head.offset().top + $obj.height() - $head.height();
            if ((headTop !==  newHeadTop) || (headBottom !== newHeadBottom)) {
                data.headTop = newHeadTop;
                data.headBottom = newHeadBottom;
                hasChanged = true;
            }

            // update state if anything changed
            if (hasChanged) {
                $obj.data(namespace, data);
            }
            return $obj;
        }
    };

    $.fn.floatHead = function(method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' +  method + ' does not exist on jQuery.floatHead');
        }
    };

    // public attributes
    $.fn.floatHead.name = namespace;
    $.fn.floatHead.version = '0.1';
    $.fn.floatHead.defaults = defaults;

})(jQuery);
