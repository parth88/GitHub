(function($, _, undefined) {

Splunk.Module.UnixModuleCloner = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);
        this.hide('HIDDEN MODULE KEY');
        // cast container jQ object into jQ object using passed $ instance
        this.$container = $(this.container);

        this.childEnforcement = Splunk.Module.ALWAYS_REQUIRE;
        this.parentEnforcement = Splunk.Module.ALWAYS_REQUIRE;

        // initialize module params
        this.params = {
            drilldownNamespace: this.getParam("drilldownNamespace"),
            drilldownToken: this.getParam("drilldownToken"),
            pinNamespace: this.getParam("pinNamespace"),
            panelSelector: this.getParam("panelSelector"),
            panelPinSelector: this.getParam("panelPinSelector"),
            clonedPanelClass: this.getParam("clonedPanelClass"),
            positionTopDelta: parseInt(this.getParam("positionTopDelta"), 10) || 10,
            positionLeftDelta: parseInt(this.getParam("positionLeftDelta"), 10) || 10
        };

        // class to add for cloned panels styling
        if (! this.params.clonedPanelClass) {
            this.params.clonedPanelClass = (this.params.panelSelector)
                ? this.params.panelSelector + "Cloned"
                : this.moduleType + "PanelCloned";
        }
        // remove leading dot from class name
        if (this.params.clonedPanelClass.charAt(0) === '.') {
            this.params.clonedPanelClass = this.params.clonedPanelClass.slice(1);
        }

        this.collection = [];       // list of cloned panels
        this.child = undefined;     // ref to single child
        this.$child = undefined;    // ref to single child container
        this.$panelPin = undefined; // ref to single child clone trigger
        this.silentMode = false;    // specifies if internal ops do not trigger events

        this.childName = "";        // keep track of current child name
        this.childPosition = null;  // child original position
        this.childIndex = null;     // child original z-index
        this.childModulesTotalCount = 0;
        this.childModulesRenderedCount = 0;

        // progressive enhancement for some UX:
        // use CSS animations when possible,
        // otherwise use JS based animations,
        // otherwise use simply jQ show/hide
        if (Modernizr.cssanimations && Modernizr.csstransforms) {
            this._use_css_animations = true;
        }

        // setup click handler to be bound on/off
        this.onClonedPanelClickProxy = $.proxy(this.onClonedPanelClick, null, this);
        // setup change handler for any collection or pinned change
        this.$container.bind('change', this.onStateChange.bind(this));
        this.$container.bind('collectionReset', this.resetCollection.bind(this));
        // bind body resize to callback
        $(window).resize(_.debounce(this.onWindowResize.bind(this), 100));
    },

    /*
     * override addChild to cache child attributes upon startup
     */
    addChild: function($super, child) {
        if (this._children.length >= 1) {
            console.error(this.moduleType, ".addChild - Assertion failed. ", this.moduleType, " cannot  have more than one child.");
            return false;
        }
        $super(child);

        // set child
        this.child = this._children && this._children[0];
        if (!this.child) {
            console.error("[UnixModuleCloner:addChild] failed to set child.");
            return false;
        }

        // set child container to clone
        this.$child = (this.params.panelSelector !== null)
            ? $(this.params.panelSelector).first()
            : $(this.child.container);

        // set child zIndex
        this.childIndex = parseInt(this.$child.css('z-index') || 999, 10);
        if (isNaN(this.childIndex)) { this.childIndex = 999; }

        // cache pin button aka child clone trigger
        this.$panelPin = this.$child.find(this.params.panelPinSelector).first();
        // setup event handlers for pin button
        this.$panelPin.on('click', this.onChildPanelPinClick.bind(this));
    },

    /*
     * update child state (plus optionally results)
     * Note: this clones child if pinned
     */
    updateChild: function(name, results) {
        // save previous silent mode
        var _silentMode = this.silentMode;
        // set silent mode so no sub operation triggers a change event
        this.silentMode = true;
        if (!name) {
            // reset name
            this.childName = "";
            // when child unselected it defaults to unpinned
            this.unpinChild();
        } else {
            // clone child only if it was pinned and new name selected
            if (this.isChildPanelPinned() && name !== this.childName) {
                // cannot proceed if child panel still loading
                // to prevent cloning panel in incomplete state
                if (this.isChildPanelRendered()) {
                    // actually clone child and add it to collection
                    this.clonePanel();
                }
            }
            // reset child rendered state
            this.resetChildModulesResultsRendered();
            // update child view if results provided
            if (results) {
                // apply previous results from saved data bag
                this.applyModuleResults(results);
                this.pinChild();
            } else {
                // context push will render results
                // make child unpinned by default unless re-selecting same child
                if (name !== this.childName) {
                    this.$panelPin.hide();
                    this.unpinChild();
                }
            }
            // update child name
            this.childName = name;
        }
        // re-apply previous silent mode
        this.silentMode = _silentMode;
        // finally trigger a change event
        this._triggerChangeEvent();
        return true;
    },

    pinChild: function() {
        this.$panelPin.addClass('pinned');
        this._triggerChangeEvent();
    },

    unpinChild: function() {
        this.$panelPin.removeClass('pinned');
        this._triggerChangeEvent();
    },

    hideChild: function() {
        if (this._use_css_animations) {
            this.$child.removeClass('expand-item').addClass('shrink-item');
        } else {
            this.$child.hide();
        }
        this._triggerChangeEvent();
    },

    showChild: function() {
        // If no browser support for CSS animations, simply show child
        if (! this._use_css_animations) {
            this.$child.show();
        }

        // save child position if not set yet
        // Note: must occur before CSS animation messes with positioning
        if (! this.childPosition) {
            this.setChildPosition();
        }

        // If proper browser support for CSS animations, apply CSS classes
        if (this._use_css_animations) {
            this.$child.removeClass('shrink-item').addClass('expand-item');
        }
        this._triggerChangeEvent();
    },

    /* immediate hide followed by regular show */
    flashChild: function() {
        if (this._use_css_animations) {
            this.$child
                .removeClass('shrink-item expand-item')
                .css('opacity', 0);
            window.setTimeout(function(){
                this.$child.css('opacity', '');
                this.showChild();
            }.bind(this), 100);
        } else {
            this.showChild();
        }
    },

    setChildPosition: function() {
        var childPosition;
        if (this.isChildPanelHidden()) {
            // if child hidden, cannot correctly capture position, so nullify it
            // to force a future setChildPosition() next time child panel is shown
            this.childPosition = null;
            return;
        } else {
            // otherwise, set child position to static to get browser default
            // position  and save it as current child position
            this.$child.css({
                'display': 'block',
                'position': 'static'
            });
            childPosition = this.$child.position();
        }

        // capture current child position only if non-zero
        if ((childPosition.top && childPosition.top !== 0) &&
            (childPosition.left && childPosition.left !== 0)) {
            this.childPosition = childPosition;
        }
    },

    _triggerChangeEvent: function() {
        if (!this.silentMode) {
            this.$container.trigger('change');
        }
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * Event handlers
     * ///////////////////////////////////////////////////////////////////
     */

    onChildPanelPinClick: function(event) {
        event.preventDefault();
        // toggle pin state
        if (this.isChildPanelPinned()) {
            this.unpinChild();
        } else {
            this.pinChild();
        }
    },

    onClonedPanelClick: function(self, event) {
        event.preventDefault();

        var $panel = $(this),
            panelName = $panel.data('name'),
            panel;

        if (!panelName) {
            console.error("[UnixModuleCloner:onClonedPanelClick] failed to retrieve panel name");
            return;
        }

        if ($(event.target).is(self.params.panelPinSelector)) {
            // if clicked on pin button, only remove cloned panel
            panel = self.removePanel(panelName);
            delete panel;
        } else {
            // if clicked anywhere else, switch cloned panel in

            // if user click (vs context triggered click) do
            // not proceed if still loading child panel
            // if (!event.isTrigger && !self.isChildPanelRendered()) {
            //     return;
            // }
            
            // enter silent mode
            self.silentMode = true;
            // 1. remove clicked panel
            panel = self.removePanel(panelName);
            // 2. update child state with clicked panel
            self.updateChild(panelName, panel.results);
            self.showChild();
            // finally trigger change event
            self.silentMode = false;
            self._triggerChangeEvent();
            delete panel;
        }
    },

    /*
     * Passes updated context to parents,
     * such as selected node and pinned nodes
     */
    onStateChange: function(event) {
        // update context with selected + pinned state and push to parents
        var selected = "",
            pinned = _.pluck(this.collection, 'name'),
            context = this.getContext(),
            drilldownContext = context.get(this.params.drilldownNamespace);

        if (this.isChildPanelPinned()) {
            pinned.push(this.childName);
        }
        if (! this.isChildPanelHidden()) {
            selected = this.childName;
        }

        if (pinned.length === 0) pinned = null;
        drilldownContext[this.params.drilldownToken] = selected;
        context.set(this.params.drilldownNamespace, drilldownContext);
        context.set(this.params.pinNamespace, pinned);
        this.passContextToParent(context);
        return true;
    },

    onWindowResize: function(event) {
        // re-capture new child position
        this.setChildPosition();
        if (this.childPosition) {
            // redraw collection with new starting position
            this.repositionCollection();
        }
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * Collection API
     * ///////////////////////////////////////////////////////////////////
     */

    // clone current child and insert it to collection
    clonePanel: function() {
        var newPanel = {
            name: this.childName, // use current child name
            container:  this.cloneContainer(this.$child),
            results: this.copyModuleResults(this.child)
        };
        newPanel.container
            .addClass(this.params.clonedPanelClass)
            .on('click.cards', this.onClonedPanelClickProxy)
            .attr('data-name', this.childName);
        this._addToCollection(newPanel);
        this._triggerChangeEvent();
    },

    // remove specified panel from collection
    removePanel: function(panelName) {
        var panelIdx = this.getPanelIdx(panelName),
            panel;

        if (panelIdx === -1) {
            return false;
        }
        panel = this._removeFromCollection(panelIdx);
        this._triggerChangeEvent();
        return panel;
    },

    // remove all panels from collection
    resetCollection: function() {
        var panel, i, l;
        for (i=0, l=this.collection.length; i < l; i++) {
            panel = this.collection[i];
            // remove panel container from DOM
            panel.container.remove();
            // delete panel object
            delete panel;
        }
        this.collection = [];
        this.repositionCollection();
        // default to unpinned mode
        this.unpinChild();
        this._triggerChangeEvent();
    },

    getPanelIdx: function(panelName) {
        var panel, i, l;
        for (i=0, l=this.collection.length; i < l; i++) {
            panel = this.collection[i];
            if (panel.name == panelName) {
                return i;
            }
        }
        return -1;
    },

    // TODO:
    // data model changes to be decoupled from DOM changes.
    // refactor DOM manipulation into redraw function to be triggered upon 'change' event

    _addToCollection: function(panel) {
        // push panel to top of collection
        this.collection.unshift(panel);
        // insert panel container to DOM
        this.$child.after(panel.container);
        // set container height right after DOM insertion
        panel.container.height(this.$child.height());
        // reposition all panels
        this.repositionCollection();
    },

    _removeFromCollection: function(panelIdx) {
        // splice panel out of the collection
        var panel = this.collection.splice(panelIdx, 1)[0];
        // remove panel container from DOM
        if (this._use_css_animations) {
            panel.container.addClass('shrink-item');
            window.setTimeout(function(){
                panel.container.remove();
                // reposition all panels
                this.repositionCollection(true);
            }.bind(this), 200);
        } else {
            panel.container.remove();
            // reposition all panels
            this.repositionCollection();
        }
        return panel;
    },

    /*
     * call this whenever collection changes
     * can be overriden by user to customize layout
     */
    repositionCollection: function(animate) {
        // create list of child container and all collection containers in reverse order
        var list = _.pluck(this.collection, 'container').reverse().concat(this.$child);
        if (list.length === 0) { return; }

        if (! this.childPosition) {
            console.warn('[UnixModuleCloner:repositionCollection] undefined child starting position to draw');
            return;
        }

        var posTopDelta = this.params.positionTopDelta,
            posLeftDelta = this.params.positionLeftDelta,
            posTop = this.childPosition.top,
            posLeft = this.childPosition.left,
            panelIdx = this.childIndex - (list.length-1),
            $panel;

        // rearrange panel container positions & z-index ordering
        _.each(list, function($el, i) {
            $el.css({
                position: 'absolute',
                'z-index': panelIdx
            });
            if (animate) {
                var curPos = $el.position();
                $el.animate({
                    top: '+=' + (posTop - curPos.top),
                    left: '+=' + (posLeft - curPos.left),
                }, 'fast');
            } else  {
                $el.css({
                    top: posTop + 'px',
                    left: posLeft + 'px',
                });
            }

            panelIdx += 1;
            posTop += posTopDelta;
            posLeft += posLeftDelta;
        });
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * General accessors & utilities
     * ///////////////////////////////////////////////////////////////////
     */

    getTotalCount: function() {
        return (this.collection.length + ((!this.isChildPanelHidden()) ? 1 : 0));
    },

    getTotalPinnedCount: function() {
        return (this.collection.length + ((!this.isChildPanelHidden() && this.isChildPanelPinned()) ? 1 : 0));
    },

    getAllPanelContainers: function() {
        return [this.$child].concat(_.pluck(this.collection, 'container'));
    },

    disableAllPanelContainers: function() {
        var that = this;
        $.each(this.collection, function(i, panel) {
            panel.container
                .off('.cards')
                .css('cursor', 'auto')
                .find(that.params.panelPinSelector).hide();
        });
        this.$panelPin.hide();
    },

    enableAllPanelContainers: function() {
        var that = this;
        $.each(this.collection, function(i, panel) {
            panel.container
                .on('click.cards', that.onClonedPanelClickProxy)
                .find(that.params.panelPinSelector).show();
            if (that.isChildPanelRendered()) {
                panel.container.css('cursor', 'pointer');
            }
        });
        this.$panelPin.show();
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * Hook ups to module system
     * ///////////////////////////////////////////////////////////////////
     */

     onContextChange: function() {
        var context = this.getContext(),
            drilldownNS = context.get(this.params.drilldownNamespace) || null,
            pinned = context.get(this.params.pinNamespace) || null,
            idx, name = "";

        // 1) listen to drilldown changes
        if (drilldownNS && (name = drilldownNS[this.params.drilldownToken])) {
            // if name already in collection, simply switch it in
            if ((idx = this.getPanelIdx(name)) !== -1) {
                // emulate a click on corresponding cloned panel
                this.collection[idx].container.click();
            }
            // otherwise update child
            else {
                this.updateChild(name);
                this.flashChild();
            }
        } else {
            // no name in context, e.g. deselected
            // if any pinned panel underneath, switch that in and make it front child panel
            if (this.collection.length > 0) {
                this.collection[0].container.click();
            } else {
            // otherwise reset & hide front child panel
                this.updateChild();
                this.hideChild();
            }
        }
        
        // 2) listen to pinned removals
        if (pinned && (pinned.length !== this.getTotalPinnedCount())) {
            this.silentMode = true;
            if (pinned.length < this.getTotalPinnedCount) {
                _.each(_.pluck(this.collection, 'name'), function(panelName) {
                    if (pinned.indexOf(panelName) === -1) {
                        this.removePanel(panelName);
                    }
                }, this);
            } else {
                this.pinChild();
            }
            this.silentMode = false;
            // finally trigger a change event
            this._triggerChangeEvent();
        }

        // set resultsRendered callbacks for child panel modules the first time only
        if (this.childModulesTotalCount === 0) {
            this.setModuleRenderedCallbacks(this.child);
        }
    },

    getModifiedContext: function($super) {
        var context = this.getContext(),
            drilldownNS = context.get(this.params.drilldownNamespace) || {},
            name = "";
        // if child already rendered, skip context push to avoid unnecessary sub-modules re-rendering
        // OR if no drilldown name passed down, skip context push e.g. during initial page load
        if (this.isChildPanelRendered() || !(name = drilldownNS[this.params.drilldownToken])) {
            // postpone context push by making module think it's still waiting for context
            this.setLoadState(Splunk.util.moduleLoadStates.WAITING_FOR_CONTEXT, true);
        }
        return $super();
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * Child Panel API + rendering callbacks
     * ///////////////////////////////////////////////////////////////////
     */

    isChildPanelHidden: function() {
        if (this._use_css_animations) {
            return this.$child.hasClass('shrink-item');
        } else {
            return this.$child.is(':hidden');
        }
    },

    isChildPanelPinned: function() {
        return this.$panelPin.hasClass('pinned');
    },

    isChildPanelRendered: function() {
        return (this.childModulesRenderedCount === this.childModulesTotalCount);
    },

    resetChildModulesResultsRendered: function() {
        this.childModulesRenderedCount = 0;
        // $.each(this.collection, function(i, panel) {
        //     panel.container.css('cursor', 'not-allowed');
        // });
    },

    setChildModulesResultsRendered: function() {
        this.childModulesRenderedCount = this.childModulesTotalCount;
        // $.each(this.collection, function(i, panel) {
        //     panel.container.css('cursor', 'pointer');
        // });
    },

    onChildModulesResultsRendered: function(module, options) {
        // do not count towards rendered count if module simply rendering
        // placeholder response (e.g. using initValueList param for UnixResultsTable)
        var isPlaceholderResponse = (options && (options.responseType === 'PLACEHOLDER_RESPONSE')) || false;
        if (isPlaceholderResponse) { return; }

        this.childModulesRenderedCount += 1;
        // if all modules in child panel have rendered their results
        if (this.childModulesRenderedCount === this.childModulesTotalCount) {
            this.$panelPin.show();
            // $.each(this.collection, function(i, panel) {
            //     panel.container.css('cursor', 'pointer');
            // });
        }
    },

    setModuleRenderedCallbacks: function(module) {
        // set onResultsRendered callback for current module
        var self = this;
        $.each([module].concat(module.getDescendants()), function(i, m) {
            if (m.onResultsRendered) {
                m.onResultsRendered = self.onChildModulesResultsRendered.bind(self, m);
                self.childModulesTotalCount += 1;
            }
        });
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * Helpers for module components manipulation
     * ///////////////////////////////////////////////////////////////////
     */

    // enhanced version of jQuery clone
    cloneContainer: function($container) {
        var $clone = $container.clone(false),
            cloneIdx = this.collection.length + 1;

        // avoid id duplication by using clone index as suffix
        $clone.find('*').each(function(index){
            var $elem = $(this),
                elemId = $elem.attr('id');
            if (elemId) {
                $elem.attr('id', elemId + '_clone_' + cloneIdx);
            }
        });
        // support canvas cloning: copy image data
        oldCanvases = $container.find('canvas');
        if (oldCanvases.length > 0) {
            $clone.find('canvas').each(function(index){
                var newCanvas = this,
                    newCanvasCtx = newCanvas.getContext('2d'),
                    oldCanvas = oldCanvases[index];
                newCanvasCtx.drawImage(oldCanvas, 0, 0);
            });
        }
        // remove any potential cosmetic alterations
        if (this._use_css_animations) {
            $clone.removeClass('expand-item shrink-item').css('opacity', 1);            
        }

        return $clone;
    },

    copyModuleResults: function(module) {
        var results = {};

        $.each([module].concat(module.getDescendants()), function(i, m) {
            // copy current results for all child sub-modules
            if (m._results) {
                results[m.moduleId] = m._results;
            }
        });
        return results;
    },

    applyModuleResults: function(results) {
        var module = this.child;

        $.each([module].concat(module.getDescendants()), function(i, m) {
            // cancel all outstanding jobs (if any) for all child sub-modules
            m.resetContext();

            // apply saved results to all child sub-modules
            if (results[m.moduleId]) {
                m.renderResults(results[m.moduleId]);
            }
        });
    }
});

}(UnixjQuery, UnixUnderscore));
