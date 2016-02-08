(function($, _){

    window.Flyout = function(items, currentIndex, $container, callbacks){
        var self = this,
            $title, $itemsContainer;

        this.current = currentIndex;
        $itemsContainer = $container.find('.dropdown-menu');
        $title = $container.find('.title');

        setup(items, currentIndex);

        function setCurrentIndicator(index){
            $itemsContainer.find('.check').hide();
            var $current = $itemsContainer.find('item').eq(index);
            $current.find('.check').show();
        }

        function bindItem($item, i){
            $item.on('click', function(){
                self.setCurrent(i, $item);
            });
        }

        function updateTitle(title){
            $title.empty();
            $title.append(title);
        }

        function setup(items, currentIndex){
            self.items = items;
            if(self.items){
                $.each(self.items, function(i, item){
                    if(item.name === undefined){
                        var $item = $("<li class='item'>"+item+"</li>");
                    } else {
                        var $item = $("<li class='item'>"+item.name+"</li>");
                    }
                    if (i === currentIndex) {
                        $item.addClass('selected');
                    }
                    $itemsContainer.append($item);
                    bindItem($item, i);
                });

                if(self.items[currentIndex].name === undefined){
                    updateTitle(self.items[currentIndex]);
                } else {
                    updateTitle(self.items[currentIndex].name);
                }
            } else {
                self.items = [];
                $itemsContainer.find('.item').each(function(i){
                    $item = $(this);
                    self.items.push($item.text().trim());
                    bindItem($item, i);
                });
            }
        }

        this.sync = function(){
            setup(false);
        }

        this.setCurrent = function(index, $item){
            this.current = index;
            callbacks.change.call(this, index);
            setCurrentIndicator(index);
            if(this.items[index].name === undefined){
               updateTitle(this.items[index]);
            } else {
               updateTitle(this.items[index].name);
            }

            if($item !== undefined){
                $container.find('.dropdown-menu li.selected').removeClass('selected');
                $item.addClass('selected'); 
            }  
        };
    }

})(UnixjQuery, UnixUnderscore);
