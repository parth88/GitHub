Splunk.Module.UnixSimpleTimeRangePicker = $.klass(Splunk.Module.UnixBaseAbstractFactoryFactory, {

    initialize: function($super, container) {
        $super(container);

        this.drilldownToken = this.getParam('drilldownToken');

        this.earliest = this.container.find('.selected').attr('earliest');
        this.latest = this.getLatest(this.earliest);
        
        this.storage = new this.RemoteStorage('Splunk.Module.UnixSimpleTimeRangePicker', this.moduleId, false, this.moduleType);
        this.urlStorage = new this.URLStorage('Splunk.Module.UnixSimpleTimeRangePicker', this.moduleId, false, this.drilldownToken);

        this.span = null;

        this.currentIndex = null;
        this.useDropdown = this.getParam('useDropdown');
        this.valueMap = this.getParam('rangeMap');
        
        this.$button = this.container.find('a.dropdown-toggle');
        this.valueList = this.container.find('.dropdown-menu .item');

        if(this.useDropdown === 'True') {
            this.useDropdown = true;
        } else {
            this.useDropdown = false;
        }

        this.showLoadingIndicator();
        this.setFromStorage(); 
    },

    getCurrentIndex: function() {
        return this.currentIndex;
    },

    setCurrentIndex: function(val) {
        this.currentIndex = Number(val);
        if(isNaN(this.currentIndex)){
            this.currentIndex = Number(this.valueMap[val].order-1);
        }
        this.saveToStorage();
    },

    initSelector: function() {
        var self = this,
            currentKey,
            currentIndex = this.getCurrentIndex() || 0,
            flyout,
            selected;

        if(this.useDropdown){
            this.$dropdown = this.container.find('.searchFlyout');
            flyout = new Flyout(false, currentIndex, this.$dropdown, {
                change: function(i){
                    currentKey = self.valueList.eq(i).text().trim();
                    self.span = self.valueMap[currentKey].span;
                    self.setCurrentIndex(i);
                
                    self.earliest = self.valueList.eq(i).attr('earliest');
                    self.latest = self.getLatest(self.earliest);
                    self.pushContextToChildren();
                }
            });


            if (this.getCurrentIndex() !== null) {
                // something from storage; 
                selected = this.$dropdown.find('.dropdown-menu').children().eq(currentIndex);
            } else {
                // the selected value as set in the view 
                selected = this.$dropdown.find('.dropdown-menu').find('.selected');
                if (selected.length === 0) {
                    // nothing from storage and nothing in the view: choose the first item 
                    selected = this.$dropdown.find('.dropdown-menu').children().first();
                }
            }

            this.span = this.valueMap[selected.text().trim()].span;
            selected.trigger('click');
            this.hideLoadingIndicator();
            this.$button.css('visibility', 'visible');

        } else {
            $('.SimpleTimeRange', container).bind('click', function(event) { 
                this.onClick(event);
            }.bind(this));
        }

        this.earliest = this.container.find('.selected').attr('earliest');
        this.latest = this.getLatest(this.earliest);
    },

    getLatest: function(earliest) {
        var latest;
        if (earliest.indexOf('rt') !== -1) {
            latest = 'rt';
        } else {
            latest = 'now';
        }
        return latest;
    },

    onClick: function(event) {
        event.preventDefault();
        $(this.container).find('input.selected').removeClass('selected');
        $(event.target).addClass('selected');
        this.earliest = $(event.target).attr('earliest');
        this.latest = this.getLatest(this.earliest);
        this.pushContextToChildren();
    },

    //onContextChange: function() {
    //    this.pushContextToChildren();
    //},

    getModifiedContext: function() {
        var context = this.getContext(),
            search = context.get('search'),
            range;
            
        if (this.earliest == 'all') {
            range = new Splunk.TimeRange();
        } else {
            range = new Splunk.TimeRange(this.earliest, this.latest);
        }

        search.setTimeRange(range);
        context.set('search', search);
        if(this.useDropdown){
            context.set('span', this.span);
        }
        return context;
    },

    setFromStorage: function(){
        var self = this,
            data = this.urlStorage.load();

        if (data !== undefined && !$.isEmptyObject(data)){
            // data = JSON.parse(data);
            if (data !== undefined && !$.isEmptyObject(data)){
                self.setCurrentIndex(data);
            }
            self.initSelector();
        } else {
            this.storage.load(function(newData){
                if (newData !== undefined && !$.isEmptyObject(newData)){
                    // newData = JSON.parse(newData);
                    if (newData !== undefined ) {
                        self.setCurrentIndex(newData);
                    }
                }
                self.initSelector();
            });
        }
    },

    saveToStorage: function(){
        var currentIndex= this.getCurrentIndex();

        if (currentIndex !== null) {
            this.storage.save(currentIndex);
            this.urlStorage.save(currentIndex);
        }
    }

}); 
