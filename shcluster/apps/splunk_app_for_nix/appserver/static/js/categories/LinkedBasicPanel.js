(function($, _){

window.LinkedBasicPanel = function($el, title, categoryModel){
    var data = [],
        self = this,
        $delete, 
        $add,
        rename = {$item: null, $input: null},
        $contents;

    $contents = $el.find('.contents');
    $add = $el.find('.add');
    $delete = $el.find('.delete');

    this.modelData = {};
    this.nextPanel = null;

    /*
    Event Handling
    ******************************/
    $contents.on('click', '.item', function(e){
        var $this = $(this),
            $target,
            name;

        $target = $(e.target);
        if(!$target.hasClass('rename')){
            removeSelected();
            $this.addClass('selected');

            name = $this.find('.itemName').text();

            categoryModel.setCurrent(name);

            self.nextPanel.open({
                modelData: categoryModel
            });
        }

        
    });

    $contents.on('dblclick', '.itemName', function(e){
        var $this = $(this),
            name;

        e.stopPropagation();
        editName($this);
        self.nextPanel.close();
    });

    $delete.on('click', function(){
        var remove = categoryModel.deleteCurrent();
        if (remove === true) {
            $el.find('.selected').remove();
            self.updateSiblingCounts();
            self.closeAllNext();
        }
    });

    $add.on('click', function(){
        var displayData = categoryModel.append(title);
        renderItem(displayData.name, displayData.count);
    });

    $el.on('click', function(){
        if(rename.$input !== null && rename.$item !== null){
            rename.$input.hide();
            rename.$item.show();
            self.nextPanel.close();
            self.nextPanel.open({
                modelData: categoryModel
            });
        }
    });

    $el.on('keypress', 'input.rename', function(e) {
        if (e.which === 13) {
            $(this).trigger('blur');
            rename.$input.hide();
            rename.$item.show();
        } 
    });

    $el.on('blur', 'input.rename', function(e){
        var val = $(this).val();
        rename.$item.text(val);
        rename.$item.parent().attr('name', val);
        categoryModel.update(val);
    });

    $el.on('click', 'input.rename', function(e){
        e.stopPropagation();
        e.preventDefault();
    });

    function editName($el){
        var $rename = $('<input class="rename" type="text"/>');
        $rename.val($el.text());
        $el.parent().append($rename);
        rename.$input = $rename;
        rename.$input.select();
        rename.$item = $el;
        $el.hide();
    }

    function removeSelected(){
        $el.find('.selected').removeClass('selected');
    }

    function renderItem(name, count){
        var $item = $("<div class='item' name='"+name+"'></div>");
        $item.append("<div class='itemName'>"+name+"</div>");
        $item.append("<div class='childrenCount'>"+count+"</div>");
        $contents.append($item);
    }

    function renderData(){
        _.each(categoryModel.data, function(item, name){
            renderItem(name, categoryModel.childrenCounts[name]);
        });
    }

    function renderUpdatedCount(){
        _.each(categoryModel.childrenCounts, function(count, k){
            var $counter = $(".item[name='"+k+"'] .childrenCount");
            $el.find($counter).empty().append(count);
        });
    }

    function empty(){
        $contents.empty();
    }

    this.updateSiblingCounts = function(){
        this.eachSibling(function(panel){
            panel.updateCounts();
        });
    };

    this.updateCounts = function(){
        categoryModel.updateCounts();
        renderUpdatedCount();
    };

    /*
    The "modelData" object contains enough stuff to set
    the model to the current point of the tree.
    We could just pass a reference to the correct part of the tree,
    but this allows us to more easily use the model.

    actually scratch that, it's probably easier to just pass
    down the raw reference...
    */
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
};

window.LinkedBasicPanel.prototype = new LinkedBasePanel();


})(UnixjQuery, UnixUnderscore);
