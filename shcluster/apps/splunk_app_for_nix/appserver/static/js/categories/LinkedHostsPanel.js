(function($, _){

window.LinkedHostsPanel = function($el, title, categoryModel){
    var self = this,
        $contents = $el.find('.contents'),
        $contentsLeft = $el.find('#hostLeftPanel .contents'),
        $contentsRight = $el.find("#hostRightPanel .contents"),
        $title = $el.find('.panelTitle');

    this.modelData = {};

    function addHost(name){
        categoryModel.appendHost(name);
        self.sortPanels();
        self.updateSiblingCounts();
    }

    function removeHost(name){
        categoryModel.remove(name);
        self.sortPanels();
        self.updateSiblingCounts();
    }

    function bindDraggable() {
        var $children = $el.children().find('.contents');
            
        function togglePanel($e, panel) {
            var name = $e.children('.itemName').text();
            if (panel === 'hostLeftPanel') {
                $e.children('.owner').remove();
                addHost(name);
            } else {
                removeHost(name);
            }
        }

        function onStart(e, info) {
            var $siblings = info.item.siblings(".selectedHighlight");
            $siblings.appendTo(info.item);
        }
 
        function onStop(e, info) {
            var $children = info.item.children(),
                $parent = info.item.parent(),
                panel = $parent.parent().attr('id');

            $children.each(function() {
                var $e = $(this);
                if ($e.hasClass('item') === true) {
                    $e.appendTo($parent); 
                    $e.removeClass('selectedHighlight');
                    togglePanel($e, panel);
                }
            });
 
            togglePanel(info.item, panel);
            $parent.find('.selectedHightlight').removeClass('selectedHighlight');
        }

        $children.sortable({
            connectWith: $children,
            start: onStart,
            stop: onStop 
        });
    }

    function itemClickHandler(e, $item) {
        $item.toggleClass("selectedHighlight");
        if (e.shiftKey === true) {
            $item.prevUntil(".selectedHighlight")
                 .toggleClass("selectedHighlight"); 
        } 
    }

    function renderItem(name, $container){
        var $itemGroup = $("<div class='item'></div>");
            $item = $("<div class='itemName'>"+name+"</div>");

        $itemGroup.attr('data-id', name);
        $itemGroup.append($item);

        $itemGroup.click(function(e) {
            itemClickHandler(e, $(this));
        });
        
        $container.append($itemGroup);
    }

    function renderGroupsOwnersItem(name, owner, $container){
        var $itemGroup = $("<div class='item'></div>"),
            $item = $("<div class='itemName'>"+name+"</div>");

        $itemGroup.attr('data-id', name);
        $itemGroup.append($item);

        if(owner !== undefined){
            var $owner = $("<div class='owner'>"+owner+"</div>");
            $itemGroup.append($owner);
        }

        $itemGroup.click(function(e) {
            itemClickHandler(e, $(this));
        });
        
        $container.append($itemGroup);
    }

    function showLoadingIndicator(){
        $contentsRight.append('<div class="loading">loading</div>');
    }

    function hideLoadingIndicator(){
        $contentsRight.find('.loading').remove();
    }

    function renderData(){
        var title = categoryModel.getTitle();

        _.each(categoryModel.data, function(item, name){
            renderItem(item, $contentsLeft);
        });

        $el.find('.currentLevel').empty().append(title);

        categoryModel.getHostsNotInGroup(function(hosts){
            _.each(hosts, function(host){
                renderGroupsOwnersItem(host.name, host.owner, $contentsRight);
            });
            hideLoadingIndicator();
            bindDraggable();
        }, showLoadingIndicator);        
 
        self.sortPanels();
    }

    function empty(){
        $contentsLeft.empty();
        $contentsRight.empty();
        $title.empty().append('...');
    }

    this.open = function(args){
        if(args !== undefined){
            categoryModel.load(args.modelData);
        } else {
            categoryModel.load();
        }

        this.closeAllNext();
        empty();
        renderData();
    };

    this.close = function(){
        empty();
    };

    this.updateSiblingCounts = function(){
        this.eachSibling(function(panel){
            panel.updateCounts();
        });
    };

    this.sortPanels = function(){
        function sortAlpha(a,b){
            return $(a).attr('data-id').toLowerCase() > $(b).attr('data-id').toLowerCase() ? 1 : -1;
        } 
        _.each([$contentsLeft, $contentsRight], function($elm) {
            $elm.children('.item').sort(sortAlpha).appendTo($elm);
        });
    }
    
    this.updateCounts = function(){
        categoryModel.updateCounts();
    };
};

window.LinkedHostsPanel.prototype = new LinkedBasePanel();

})(UnixjQuery, UnixUnderscore);
