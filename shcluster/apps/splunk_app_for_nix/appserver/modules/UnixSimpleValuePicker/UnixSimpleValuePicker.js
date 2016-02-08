Splunk.Module.UnixSimpleValuePicker = $.klass(Splunk.Module.UnixBaseAbstractFactoryFactory, {

    initialize: function($super, container) {

        $super(container);

        this.valueList = this.getParam('valueList');
        this.namespace = this.getParam('namespace');
        this.token = this.getParam('token');

        this.currentIndex = null;
        this.currentVal = null;

        this.$button = this.container.find('.btn-group');
        this.$dropdown = this.container.find('.searchFlyout');
        this.$dropdownToggle = this.container.find(".dropdown-toggle");

        this.storage = new this.RemoteStorage('Splunk.Module.UnixSimpleTimeRangePicker', this.moduleId, false, this.moduleType);
        this.urlStorage = new this.URLStorage('Splunk.Module.UnixSimpleTimeRangePicker', this.moduleId, false, this.moduleType);

        this.showLoadingIndicator();
        this.setFromStorage();
    },

    initSelector: function() {
        var self = this,
        idx = this.getCurrentIndex() || 0,
        flyout = new Flyout(false, idx, this.$dropdown, {
            change: function(i){
                self.setCurrentIndex(i);
                self.pushContextToChildren();
            }
        });
        this.container.find('.dropdown-menu').children().eq(idx).trigger('click');
        this.hideLoadingIndicator();
        this.$button.css('visibility', 'visible');
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

    getToken: function() {
        return this.token;
    },

    getCurrentIndex: function() {
        return this.currentIndex;
    },

    setCurrentIndex: function(val) {
        this.currentIndex = Number(val);
        this.setCurrentVal(this.valueList[this.currentIndex]);
        this.saveToStorage();
    },

    getCurrentVal: function() {
        return this.currentVal;
    },

    setCurrentVal: function(val) {
        this.currentVal = val;
    },

    getModifiedContext: function() {
        var context = this.getContext(),
            namespace = context.get(this.namespace) || {},
            token = this.getToken(),
            currentVal = this.getCurrentVal();

        if (currentVal !== null) {
            namespace[token] = currentVal['value'];
            namespace['metrics'] = currentVal['metrics']; 
            context.set(this.namespace, namespace);
        }

        return context;
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

        if (currentIndex !== null) {
            data = JSON.stringify(currentIndex);
            this.storage.save(data);
            this.urlStorage.save(data);
        }
    }

}); 
