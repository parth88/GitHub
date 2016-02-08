(function($, _$, _){
/*
This is missing the ability to load selected items from the user prefs / URL
*/
Splunk.Module.UnixSelectable = $.klass(Splunk.Module.UnixBaseDispatchingFactoryFactory, {
    initialize: function($super, container) {
        // TODO: clean up unused variables
        $super(container);
        this.data = null;
        this.flatData = null;
        this.$list = $('ol#selector', this.container);
        this.$filter = $('input#selector_filter', this.container);
        this.$filterReset = $('#selector_filter_reset', this.container);
        this.$selectableReset = $(".selectable_reset", this.container);
        this.$selectableSelectAll = $(".selectable_select_all", this.container);
        this.namespace = this.getParam('namespace');
        this.scrollable = null;
        this.selector = null;
        this.selected = null;
        this._selected = [];
        this.selectedSet = {};
        this.selectableTree = null;
        this.foldees = null;
        this.spl = [];
        this.token = this.getParam('token');
        // TODO: make configurable
        this.metrics_token = 'metrics';

        this.$filter.bind(
            'change',
            this.onFilterChange.bind(this)
        );
 
        this.$filterReset.bind(
            'click',
            this.onFilterResetClick.bind(this)
        );

        // the options could probably stand some tweaking
        this.fuzzy = new Fuse([]);
    },

    substrSearch: function(substr){
        var results = [],
            match,
            self = this,
            re;

        re = new RegExp(".*"+substr + ".*");

        _.each(this.flatData, function(item){
            match = re.exec(item);
            if(match !== null){
                results.push(item);
            }
        });
        return results;
    },
    
    onFilterChange: function(e) {
        var val = $(e.target).val() || null,
            top = this.$list.offset().top,
            $items = this.container.find('.item'),
            searchResult,
            $exactMatchProbe,
            substrSearchResults,
            self = this;
            
        if (val !== null && val.length > 0) {
            $items.hide();
            $items.addClass('disabled');
            searchResult = this.fuzzy.search(val);

            // Favor more exact matches over fuzzy results
            substrSearchResults = self.substrSearch(val);
            if(substrSearchResults.length){
                _.each(substrSearchResults, function(item){
                    self.container.find("[item-name='"+item+"']").show();
                });
            } else {
                // NOTE: this could be sped up with a better index (instead of DOM searching)
                _.each(searchResult, function(idx){
                    self.container.find("[item-name='"+self.getSelectorSafeName(self.flatData[idx])+"']").show();
                });
            }

        } else {
            $items.show();
            $items.removeClass('disabled');
        }
    },

    onFilterResetClick: function() {
        // this clears the filters, which listen on change
        this.$filter.val('').trigger('change');
    },

    /*
    The $parent can be another folder or the root
    */
    createNewFolder: function(name, $parent){
        var $folder = $("<li class='folder open canSelect' item-name='"+this.getSelectorSafeName(name)+"'><div class='caret caretDown'></div><span class='folderHeader folderTitle'>"+name+"</span></li>");
        $parent.append($folder);
        return $folder;
    },

    // Creates the folder if it does not exist already
    getFolder: function(name, $parent){
        // NOTE: This lookup could use a secondary structure instead of the DOM
        var $folder = $parent.find("[item-name='"+this.getSelectorSafeName(name)+"']");
        if($folder.length === 0){
            $folder = this.createNewFolder(name, $parent);
        }
        return $folder;
    },

    // NB: changes to this function should be mirrored in selectableTree.js:getSelectorSafeName()
    getSelectorSafeName: function(name) {
        return name.replace(/\*/g, 'starchar').replace(/^_/g, 'uschar');
    },

    createItem: function(name, $parent){
        var $item = $("<div class='item ui-widget-content canSelect' item-name='"+this.getSelectorSafeName(name)+"'>"+name+"</div>");
        $parent.append($item);
        return $item;
    },

    buildTree: function(){
        var self = this,
            $groupFolder,
            $dimFolder;

        // this.$list.children().remove();
        $.each(self.data, function(group){
            $groupFolder = self.getFolder(group, self.$list);

            $.each(self.data[group], function(dim){
                $dimFolder = self.getFolder(dim, $groupFolder);

                $.each(self.data[group][dim], function(i, item){
                    self.createItem(item, $dimFolder);
                });
            });
        });
    },

    /*
     * destroy the selectable() 
     */
    resetSelectable: function() {
        if(this.selectableTree !== undefined){
            this.selectableTree.reset();
        }
    },

    /*
     * override
     * insert selected values into our given token and namespace
     */
    getModifiedContext: function() {
        var context = this.getContext(),
            // metrics = this.getFoldees(),
            newContextData = context.get(this.namespace) || {},
            search = context.get('search'),
            selected = this.getSelected();

        search.abandonJob();
        
        if (selected !== null && selected.length > 0) {
            newContextData[this.token] = selected;
            newContextData['cmd'] = this.spl;
        } else {
            newContextData[this.token] = null;
        }

        if(selected !== null && selected.length > 0){
            context.set('hasSelection', true);
        } else {
            context.set('hasSelection', false);
        }
        
        context.set(this.namespace, newContextData);
        context.set('search', search);
        return context;
    },

    /*
     * override
     * provide the sid and token to the controller
     */
    getResultParams: function($super) {
        var params = $super();
        params['sid'] = this.getContext().get('search').job.getSID();
        params['token'] = this.getToken();
        return params;
    },

    getSelected: function() {
        return this.selected;
    },

    /*
     * override
     * we have no intentions, just a token
     */
    getToken: function() {
        return this.token;
    },

    /*
     * initialize the list as a jquery ui selectable 
     */
    initSelectable: function() {
        var self = this;

        // build list from controller data
        this.buildTree();

        this.selectableTree = new SelectableTree($(this.container).find("#selector"), {
            onChange: function(selected){
                self.setSelected(selected);
                self.pushContextToChildren();
            },
            storage: this.storageFactory('Splunk.Module.UnixSelectable'),
            $selectableContainer: $(".selectable_container")
        });
        this.selectableTree.init();

        this.$selectableReset.bind('click', function(e){
            e.preventDefault();
            self.selectableTree.reset();
        });

        this.$selectableSelectAll.bind('click', function(e){
            e.preventDefault();
            self.selectableTree.select(self.flatData);
        });
    },

    /*
    Initialize the jQuery scroller plugin
    */
    // TODO: maybe replace this, probably not neccesary anymore
    initScroller: function(){
        // this.scrollable = _$('.selector_border').jScrollPane({
        //     autoReinitialise: true,
        //     vertical_gutter: 5,
        //     horizontal_gutter: 1
        // });
    },

    /*
     * override
     * grab any selected values from the context 
     */
    onContextChange: function() {
        var context = this.getContext(),
            namespace = context.get(this.namespace) || {},
            selected = namespace[this.token] || null;

        if (selected !== null) {
            // TODO: test me
            this.setSelected(selected);
            this.selectSelected();
        } 
	
    },

    /*
     * get results
     */
    onJobDone: function() {
        this.getResults();
    },
    
    /*
     * override
     * send valid data to selectable 
     */
    renderResults: function(data) {
        if (data !== null && data !== undefined
          && data.tree !== null && data.tree !== undefined) {
            this.data = data.tree;
            this.flatData = data.results;
            if (this.selectableTree === null) {
                this.fuzzy.setList(this.flatData);
                this.initSelectable();
                this.initScroller();
            } else {
                //this.updateSelectable();
                return;
            }
        }
    },

    /*
     * select any items that were given to us in the context
     TODO: implement me
     */
    selectSelected: function() {
        // var selected = this.getSelected(),
        //     child, i, item;

        // // reset selected and remove selected class
        // //this.setSelected(null);
        // this.$list.children().removeClass('ui-selected');

        // for (i=0; i < selected.length; i++) {
        //     item = selected[i];
        //     child = this.$list.find('#' + item);
            
        //     if (child.length > 0) {
        //         $(child[0]).addClass('ui-selected');
        //         this.selectItem(child[0]);
        //     }
        // }
    },

    setSelected: function(selected) {
        this.selected = selected;
    },

    /*
     * update selectable
     // TODO: need this?
     */
    updateSelectable: function() {
        this.buildList();
        this.selector.refresh();
    }

});

})(UnixjQuery, $, UnixUnderscore)

