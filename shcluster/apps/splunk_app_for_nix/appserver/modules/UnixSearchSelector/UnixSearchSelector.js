(function($, _){
    Splunk.Module.UnixSearchSelector = $.klass(Splunk.Module.UnixBaseAbstractFactoryFactory, {
        
        initialize: function($super, container){
            var self = this,
                flyout;

            $super(container);

            this.searches = this.convertParams(this.getParam('searches'));
            this.currentIndex = 0;
            this.currentSearch = this.searches[this.currentIndex];
            this.prevSearch = null;
            this.intervalTime = Number(this.getParam('interval')) * 1000;
            this.interval = null;
            this.firstTimeBackoff = 2;
            this.emulateRt = this.getParam('emulateRealtime');
            if(this.emulateRt === 'true') {
                this.emulateRt = true;
            } else {
                this.emulateRt = false;
            }

            this.$container = $("#"+this.moduleId);
            this.$dropdownToggle = this.$container.find(".dropdown-toggle");
            this.$dropdown = this.$container.find(".searchFlyout");
            this.storage = new this.RemoteStorage('Splunk.Module.UnixSearchSelector', this.moduleId, false, this.moduleType);
            this.urlStorage = new this.URLStorage('Splunk.Module.UnixSearchSelector', this.moduleId, false, this.moduleType);
  
            this.setFromStorage();

            //this.initSelector();

            this.pushContextToChildren();
            if(this.emulateRt){
                this.setupRt();
            } 
        },

        getCurrentIndex: function() {
            return this.currentIndex;
        },

        setCurrentIndex: function(val) {
            this.currentIndex = Number(val);
            this.saveToStorage();
            this.setCurrentSearch(this.searches[this.currentIndex]);
        },

        getCurrentSearch: function() {
            return this.currentSearch;
        },

        setCurrentSearch: function(val) {
            this.currentSearch = val;
        },

        setupRt: function() {
            if (this.interval !== null) {
                clearInterval(this.interval);
            }
            // we back off the first time we run to make sure downstream consumers have a chance to render
            this.interval = setInterval(this.pushOnce.bind(this), this.intervalTime*this.firstTimeBackoff);
        },

        pushOnce: function() {
            clearInterval(this.interval);
            this.interval = window.setInterval(
                this.pushContextToChildren.bind(this), 
                this.intervalTime
            );
        },

        convertParams: function(params){
            var converted = [];

            $.each(params, function(i, v){
                $.each(v, function(name, searchVal){
                    converted.push({
                        "name": name,
                        "search": searchVal.search,
                        "earliest": searchVal.earliest,
                        "latest": searchVal.latest,
                        "groupName": searchVal.groupName
                    });
                });
            });

            return converted;
        },

        getModifiedContext: function(){
            context = this.setSearch();
            return context;
        },

        initSelector: function(){
            var self = this,
                currentIndex = this.getCurrentIndex(),
                context,
                flyout;

            this.$dropdownToggle.dropdown();
            flyout = new Flyout(this.searches, currentIndex, this.$dropdown, {
                change: function(i){
                    self.setCurrentIndex(i);
                    self.pushContextToChildren();
                    if (self.emulateRt) {
                        self.setupRt();
                    } 
                }
            });
        },

        setSearch: function(){
            var context = this.getContext(),
                form = context.get('form') || {},
                search = context.get('search'),
                swapSearch,
                newSearch = this.currentSearch.search;

            search.job.setAsAutoCancellable(true);
            search.abandonJob();

            if (this.currentSearch.earliest || this.currentSearch.latest) {
                var range = new Splunk.TimeRange(this.currentSearch.earliest, this.currentSearch.latest);
                search.setTimeRange(range);
            }
            search.setBaseSearch(newSearch);
            this.prevSearch = search;
            context.set('search', search);

            form.searchName = this.currentSearch.name;
            form.groupName = this.currentSearch.groupName;
            context.set('form', form);
            
            return context;
        },

        onContextChange: function() {
            this.pushContextToChildren();
            if (this.emulateRt) {
                this.setupRt();
            }
        },

        setFromStorage: function(){
            var self = this,
                data = this.urlStorage.load();

            if (data !== undefined && !$.isEmptyObject(data)){
                data = JSON.parse(data);
                if (data !== undefined && !$.isEmptyObject(data)){
                    self.setCurrentIndex(data);
                } 
                self.initSelector();
            } else {
                this.storage.load(function(newData){
                    if (newData !== undefined && !$.isEmptyObject(newData)){
                        newData = JSON.parse(newData);
                        if (newData !== undefined ) {
                            self.setCurrentIndex(newData);
                        } 
                    }
                    self.initSelector();
                });
            }
        },

        saveToStorage: function(){
            var currentIndex= this.getCurrentIndex(),
                data;

            data = JSON.stringify(currentIndex);
            this.storage.save(data);
            this.urlStorage.save(data);
        }

    });

})(UnixjQuery, UnixUnderscore);
