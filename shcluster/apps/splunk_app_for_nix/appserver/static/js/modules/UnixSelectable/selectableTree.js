(function($, _){

/*
SelectableTree

This may or may not work with a tree with more than 3 levels.

Two types of nodes:
1)  Folders (interior)
2)  Items (leaves)
These are specified with CSS classes

Only DOM elements with the class "item" are put into the selected list.
Folder elements (marked with class "folder") are designed
to contain folders or items. If a folder is selected (by any means)
then all of that folder's children are also selected.

Any time an item is selected, another lookup is performed to 
find other items with the same name. If another is found, it is
also selected with the "selected" class.

Selections are performed two ways:
1)  Drag select. This is powered by the drag and drop libraries (jquery.event.drag and jquery.event.drop);
    This is never used for de-selecting items. It is only used for selecting items/folders.
2)  Click select. This is used for both selecting and de-selecting items/folders.

The selectedSet object is only used to test for membership and should not be reported to the client.
We opted for a simple callback and not something with jQuery. Register through options.onChange.

*/

/*
jquery does not support rotations out of the box
this is only supported by IE9+ and other modern browsers.
*/
$.fn.animateRotate = function(startAngle, endAngle, duration, easing, complete){
    return this.each(function(){
        var $el = $(this);

        $({deg: startAngle}).animate({deg: endAngle}, {
            duration: duration,
            easing: easing,
            step: function(now){
                $el.css({
                  '-moz-transform':'rotate('+now+'deg)',
                  '-webkit-transform':'rotate('+now+'deg)',
                  '-o-transform':'rotate('+now+'deg)',
                  '-ms-transform':'rotate('+now+'deg)',
                  'transform':'rotate('+now+'deg)'
                });
            },
            complete: complete || $.noop
        });
    });
};

window.SelectableTree = function($root, options){
    var defaults,
        self = this,
        selectedSet = {},
        storage,
        dragEnabled = true,
        callOnChange;

    this.selected = [];

    defaults = {
        'showBounding': true, // whether or not to show the bounding selection box
        'multiSelectable': true,
        'onChange': function(){} // handle any change in the this.select array
    }
    this.options = options || {};
    this.options = _.extend(defaults, this.options);

    storage = options.storage;

    // this is probably not going to work out
    callOnChange = _.throttle(function(){
        self.options.onChange.call(self, self.selected);
    }, 50);

    function addItem(name){
        selectSameName(name);
        selectedSet[name] = true;
        self.selected = _.keys(selectedSet);
        callOnChange();
    }

    /*
    Model Functions
    These are responsible for saving/loading
    the current state of the tree.

    Note that the selectable tree does not own the data itself.
    It works with whatever it is given in the DOM.
    UnixSelectable builds the DOM and this simply manipulates the user's
    /visual/ selection of that data.

    The plural functions (addItems, removeItems, etc) are appropriate for
    batch operations. The onchange callback might not be appropriate for
    a batch operation as it would get called multiple times.
    ***********************************************************************/

    function addItems(names){
        _.each(names, function(name){
            selectedSet[name] = true;
            selectSameName(name);
        });
        self.selected = _.keys(selectedSet);
        save.call(self, self.selected);
        callOnChange();
    }

    function removeItem(name){
        deselectSameName(name);
        delete selectedSet[name];
        self.selected = _.keys(selectedSet);
        save.call(self, self.selected);
        callOnChange();
    }

    function removeItems(names){
        _.each(names, function(name){
            deselectSameName(name);
            delete selectedSet[name];
        });

        self.selected = _.keys(selectedSet);
        save.call(self, self.selected);
        callOnChange();
    }

    function removeAllItems(){
        removeAllMarks();
        selectedSet = {};
        self.selected = [];
        save.call(self, self.selected);
        callOnChange();
    }

    function selectSameName(name){
        $root.find("[item-name='"+getSelectorSafeName(name)+"']").addClass('selectedHighlight');
    }

    function deselectSameName(name){
        $root.find("[item-name='"+getSelectorSafeName(name)+"']").removeClass('selectedHighlight');
    }

    /*
    This supports browsers which cannot use CSS transforms.
    Most importantly this includes IE.
    This simply manipulates the CSS triangle after the transform
    should have completed. This still looks OK.
    */
    function rotateCaretRight($caret){
        $caret.animateRotate(0, -90, 100, 'linear', function(){
            $caret.removeAttr('style');
            $caret.removeClass('caretDown');
            $caret.addClass('caretRight');
        });
    }

    /*
    This supports browsers which cannot use CSS transforms.
    Most importantly this includes IE.
    This simply manipulates the CSS triangle after the transform
    should have completed. This still looks OK.
    */
    function rotateCaretDown($caret){
        $caret.animateRotate(0, 90, 100, 'linear', function(){
            $caret.removeAttr('style');
            $caret.removeClass('caretRight');
            $caret.addClass('caretDown');
        });
    }

    function animateFolderClosing($folder){
        var height,
            fontHeight;

        height = $folder.height();
        fontHeight = $folder.children('.folderTitle').height();
        $folder.css('height', height);

        $folder.animate({
            height: fontHeight
        }, 100, 'linear');
    }

    function animateFolderOpening($folder){
        var height,
            currentHeight;

        currentHeight = $folder.height();
        $folder.css('height', 'auto');

        height = $folder.height();
        $folder.css('height', currentHeight);

        $folder.animate({
            height: height
        }, 100, 'linear', function(){
            $folder.css('height', 'auto');
        });
    }

    function animateFolder($folder, $caret){
        if($folder.hasClass('open')){
            animateFolderClosing($folder);
            rotateCaretRight($caret);
            $folder.removeClass('open');
            $folder.addClass('closed');
        } else {
            animateFolderOpening($folder);
            rotateCaretDown($caret);
            $folder.addClass('open');
            $folder.removeClass('closed');
        }
    }

    function handleCaretClick($caret){
        animateFolder($caret.parent(), $caret);
    }

    function setupBounding(){
        var $selectableContainer;
        // http://threedubmedia.com/code/event/drop/demo/selection
        if(options.$selectableContainer !== undefined){
            $selectableContainer = options.$selectableContainer;
        } else {
            $selectableContainer = $root.find('.selectable_container');
        }

        $selectableContainer
            .drag("start",function( ev, dd ){
                return $('<div class="selectionBoundingBox" />')
                    .css('opacity', .65 )
                    .appendTo( document.body );
            })
            .drag(function( ev, dd ){
                $( dd.proxy ).css({
                    top: Math.min(ev.pageY, dd.startY),
                    left: Math.min(ev.pageX, dd.startX),
                    height: Math.abs(ev.pageY - dd.startY),
                    width: Math.abs(ev.pageX - dd.startX)
                });
            })
            .drag("end",function( ev, dd ){
                $( dd.proxy ).remove();
            });
    }

    function resetAll(){
        resetVisuals();
        resetData();
    }

    function resetVisuals(){
        $root.find('.selectedHighlight').removeClass('selectedHighlight');
    }

    function resetData(){
        selectedSet = {};
        this.selected = {};
        callOnChange();
    }

    // we don't handle de-selections with drags
    function setupSelectionDragger(){
        // http://threedubmedia.com/code/event/drop/demo/selection
        var $this;

        $root.find('.canSelect')
            .drop("start",function(e){
                if(dragEnabled){
                    $this = $(this);
                    $this.addClass("active");
                    resetAll();
                    handleDrag($this, true);
                }
            })
            .drop(function( ev, dd ){
                if(dragEnabled){
                    $this = $(this);
                }
            })
            .drop("end",function(e){
                if(dragEnabled){
                    $this = $(this);
                    $this.removeClass("active");    
                }
            });

        $.drop({ multi: true });
    }

    function isFolder($el){
        return $el.hasClass('folder');
    }

    /*
        Note that this does not recurse through the tree!
        Callbacks:
            => folder
            => item

        This is designed to separate the structure from 
        the stuff we need to do with it.
    */

    function navigate(selector, callbacks){
        var $items,
            $this,
            $children,
            $itemChildren,
            self = this,
            temp;

        if(selector instanceof $){
            $items = selector;
            temp = selector.find('.canSelect');
            $items = $.merge($items, temp);
        } else {
            if(selector === ''){
                $items = $root.find('.canSelect');
            } else {
                $items = $root.find(selector);
            }
        }

        $items.each(function(){
            $this = $(this);
            if($this.hasClass('folder')){
                $children = $this.find('.canSelect');
                $itemChildren = $this.find('.canSelect.item');
                if(callbacks.folder !== undefined){
                    callbacks.folder.call(this, $this, $children, $itemChildren);
                }
            } else {
                if(callbacks.item !== undefined){
                    callbacks.item.call(this, $this, $this.parent('.folder.canSelect'));
                }
            }
        });   
    }

    function applyVisualHighlightClick($el, highlightOnly){
        var removeHighlight;

        navigate($el, {
            item: function($el){
                $el.toggleClass('selectedHighlight');
            },
            folder: function($el){
                $el.toggleClass('selectedHighlight');
            }
        });
    }

    function handleDrag($el, dragEnd){
        var isHighlighted,
            $parent,
            numSelected,
            numSiblings;

        navigate('.active', {
            item: function($el){

                if($el.hasClass('selectedHighlight')){
                    $el.removeClass('selectedHighlight');
                    if(dragEnd){
                        removeItem($el.text());
                    }
                } else {
                    $el.addClass('selectedHighlight');
                    if(dragEnd){
                        addItem($el.text());
                    }
                }
            },
            folder: function($el, $children){
                var numActiveChildren = $children.filter('.active').length;
                if($children.length === numActiveChildren){
                    $el.addClass('selectedHighlight');
                }
            }
        });
    }
    
    function getSelectorSafeName(name) {
        return name.replace(/\*/g, 'starchar').replace(/^_/g, 'uschar');
    }

    function markItems(data){
        var affectedItems = [],
            $el;

        _.each(data, function(item, i){
            if(_.isArray(item) || _.isObject(item)){
                // non-leaves are always objects
                // so in this case i is the key

                markItems(item);
            } else {
                $el = getEltoMark(item);
                affectedItems.push(item);
                markItem($el);
            }
        });
        addItems(affectedItems);
        highlightTree();
    }

    function getEltoMark(name){
        return $("[item-name='"+getSelectorSafeName(name)+"']");
    }

    function markItem($el){
        $el.addClass('selectedHighlight');
    }

    function removeAllMarks(){
        $root.find('.selectedHighlight').removeClass('selectedHighlight');
    }

    /*
    This will use the existing leaf highlights to highlight the parents
    */
    function highlightTree(){
        navigate('', {
            folder: function($el, $children, $itemChildren){
                var numActiveChildren = $itemChildren.filter('.selectedHighlight').length;
                if($itemChildren.length === numActiveChildren){
                    $el.addClass('selectedHighlight');
                } else {
                    $el.removeClass('selectedHighlight');
                }
            }
        });
    }

    function handleClick($el, e){
        var isHighlighted,
            $parent,
            numSelected,
            numSiblings,
            affectedItems = []; // this is used to batch-process the items the user selects/de-selects

        // This should really be refactored to use 'navigate()'
        $children = $el.find('.canSelect');
        isHighlighted = $el.hasClass('selectedHighlight');
        if(isHighlighted){
            if($el.hasClass('item')){
                affectedItems.push($el.text());
            }
            $el.removeClass('selectedHighlight');
            $children.removeClass('selectedHighlight');
            $children.filter('.item').each(function(){
                affectedItems.push($(this).text());
            });
            removeItems(affectedItems);
        } else {
            /*
            in this instance, the user is making a new selection
            they are not simply trying to deselect a single item
            therefore it makes sense to reset the entire tree
            */
            if(!self.options.multiSelectable || (!e.ctrlKey && !e.metaKey)){
                resetAll();
            }
            if($el.hasClass('item')){
                affectedItems.push($el.text());
            }
            $el.addClass('selectedHighlight');

            $children.addClass('selectedHighlight');
            $children.filter('.item').each(function(){
                affectedItems.push($(this).text());
            });
            addItems(affectedItems);
        }

        // We need to run through the tree and make sure the appropriate highlight
        // has been added to all the parents
        // this is much cleaner than checking the parents in a single pass
        highlightTree();
    }

    function load(){
        if(storage !== undefined){
            storage.load(markItems);
        }
    }

    function save(data){
        if(storage !== undefined){
            storage.save(data);
        }
    }

    /*
     *  Interface
     ************************/

    this.init = function(){
        if(this.options.showBounding){
            setupBounding();
        }

        $root.on('click', '.canSelect', function(e){
            e.stopPropagation();
            handleClick($(this), e);
        });

        setupSelectionDragger();
        $root.on('click', '.caret', function(e){
            e.stopPropagation();
            handleCaretClick($(this));
        });

        load();
    };

    this.getSelected = function(){
        return this.selected;
    };

    this.reset = function(){
        removeAllItems();
    };

    this.hardReset = function(){
        self.reset();
        setupSelectionDragger();
    }

    this.select = function(items){
        this.reset();
        markItems(items);
    };

    this.enableDrag = function(){
        dragEnabled = true;
    };

    this.disableDrag = function(){
        dragEnabled = false;
    };
}

})(UnixjQuery, UnixUnderscore);
