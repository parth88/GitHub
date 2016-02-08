Splunk.Module.UnixReportBuilder = $.klass(Splunk.Module.UnixBaseAbstractFactoryFactory, {

    initialize: function($super, container) {
        $super(container);

        this.storage = new this.RemoteStorage('Splunk.Module.UnixReportBuilder', this.moduleId, false, this.moduleType);
        this.urlStorage = new this.URLStorage('Splunk.Module.UnixReportBuilder', this.moduleId, false, this.moduleType);

        this.namespace = this.getParam('namespace');

        this.commands = null;
        this.data = null;
        this.hosts = null;
        this.metrics = null;
        this.report_search = null;

        this.$stat = $('.stat', this.container);
        this.$split = $('.split', this.container);
        this.$limit = $('.limit', this.container);
        this.$other = $('.other', this.container);
        this.$null = $('.null', this.container);
        this.$field = $('.field', this.container);

        this.$advancedPanel = $('.advancedPanel', this.container);
        this.$controls = $('.UnixReportBuilderContainer', this.container);

        this.$fieldDropdown = this.$field.find('.dropdown-menu');
        this.$splitDropdown = this.$split.find('.dropdown-menu');
        this.$statDropdown = this.$stat.find('.dropdown-menu');

        this.$toggleAdvancedPanel = $('.toggleAdvancedPanel', this.container);

        this.statItems = this.$stat.find('.dropdown-menu .item');
        this.splitItems = this.$split.find('.dropdown-menu .item');

        this.limit = 30;
        this.other = false;
        this.null = false;
        this.field = null;
        this.span = null;
        this.split = this.$split.find('.selected').attr('_val').trim();
        this.stat = this.$stat.find('.selected').attr('_val').trim();
 
        this.fieldFlyout = null;
        this.splitFlyout = null;
        this.statFlyout = null;

        this.setFromStorage();
    },

    initSelector: function() {
        var self = this;

        this.statFlyout = new Flyout(false, 0, this.$stat, {
            change: function(i){
                var val = self.statItems.eq(i).attr('_val');
                if (val !== self.getNull()) {
                    self.setStat(val);
                    self.saveToStorage();
                    self.updateSearch();
                }
            }
        });

        this.fieldFlyout = new Flyout(false, 0, this.$field, {
            change: function(i){
                var fieldItems,
                    val;

                fieldItems = self.getFieldItems();
                var val = fieldItems.eq(i).text().trim();
                if (val !== self.getNull()) {
                    self.setField(val);
                    self.saveToStorage();
                    self.updateSearch();
                }
            }
        });

        this.splitFlyout = new Flyout(false, 0, this.$split, {
            change: function(i){
                var val = self.splitItems.eq(i).attr('_val').trim();
                if (val !== self.getNull()) {
                    self.setSplit(val);
                    self.saveToStorage();
                    self.updateSearch();
                }
            }
        });

        this.$toggleAdvancedPanel.bind('click', this.toggleAdvancedPanel.bind(this));
        this.$limit.bind('change', this.onLimitChange.bind(this));
        
        // click event does not work on these checkbox elements
        this.$other.bind('mousedown', this.onOtherChange.bind(this));
        this.$null.bind('mousedown', this.onNullChange.bind(this));

        this.updateFlyouts();
    },

    getCommands: function() {
        return this.commands;
    },

    getData: function() {
        return this.data;
    },

    getFieldItems: function(){
        return this.$field.find('.dropdown-menu .item');
    },

    getField: function() {
        return this.field;
    },

    getLimit: function() {
        return this.limit;
    },

    getHosts: function() {
        return this.hosts;
    },

    getMetrics: function() {
        return this.metrics;
    },

    getNull: function() {
        return this.null;
    },

    getOther: function() {
        return this.other;
    },
   
    getReportSearch: function() {
        return this.report_search;
    },

    getSplit: function() {
        return this.split;
    },

    getStat: function() {
        return this.stat;
    },

    getSpan: function(){
        return this.span;
    },

    makeReportSearch: function() {
        var split = this.getSplit(),
            split_string = (split === 'none') ? null : ' by ' + split,
            output;

        output = ' timechart ' +
               'minspan='+this.getSpan() + ' ' +
               this.getStat() +
               '(' + this.getField() + ') ';

        if (split_string !== null) {
            output += split_string +
               ' useother=' + this.getOther() +
               ' usenull=' + this.getNull() +
               ' limit=' + this.getLimit();
        }

        return output;
    },

    onLimitChange: function(e) {
        var val = $(e.target).val();
        if (val !== this.getLimit()) {
            this.setLimit(val);
            this.updateSearch();
        }
    },

    onNullChange: function(e) {
        var val = $(e.target).is(':checked');
        this.setNull(val);
        this.updateSearch();
    },
   
    onOtherChange: function(e) {
        var val = $(e.target).is(':checked');
        this.setOther(val);
        this.updateSearch();
    },

    updateFields: function(fields) {
        var selected_field = this.getField() || fields[0],
            $selected_item;

        this.$fieldDropdown.empty();

        for (var i=0; i < fields.length; i++) {
            $('<li class="item">').text(fields[i]).appendTo(this.$fieldDropdown); 
        }

        //find the selected item and sync the flyout
        $selected_item = this.$fieldDropdown.find("li:contains('"+selected_field+"')");
        
        if ($selected_item.length < 1) {
            $selected_item = this.$fieldDropdown.find("li").first();
            selected_field = $selected_item.text().trim();
        }

        $selected_item.addClass('selected');

        this.fieldFlyout.sync();
        this.fieldFlyout.setCurrent($selected_item.index());

        this.setField(selected_field);
    },

    onContextChange: function() {
        var context = this.getContext(),
            namespace = context.get(this.namespace) || {},
            metrics = namespace['metrics'] || null;

        this.span = context.get('span');
 
        this.$controls.show();

        if (metrics !== null) {
            this.updateFields(metrics);
        }

        this.updateSearch();
    },

    getModifiedContext: function() {
        var context = this.getContext(),
            search = context.get('search'),
            base_search = search.getBaseSearch(), 
            report_search = this.getReportSearch();

        if (report_search !== null) {
            search.setBaseSearch(base_search + ' | ' + report_search);
        }

        context.set('search', search);
        return context;
    },

    toggleAdvancedPanel: function(e){
        this.$advancedPanel.toggle('fast', function(){

        })
    },

    setCommands: function(val) {
        this.commands = val;
    },

    setData: function(val) {
        this.data = val;
    },

    setField: function(val) {
        this.field = val;
    },
 
    setHosts: function(val) {
        this.hosts = val;
    },

    setLimit: function(val) {
        this.limit = val;
    },

    setMetrics: function(val) {
        this.metrics = val;
    },

    setNull: function(val) {
        this.null = val;
    },

    setOther: function(val) {
        this.other = val;
    },

    setReportSearch: function(val) {
        this.report_search = val;
    },

    setStat: function(val) {
        this.stat = val;
    },

    setSplit: function(val) {
        this.split = val;
    },

    getSnapshot: function() {
        var data = {},
            field = this.getField(),
            split = this.getSplit(),
            stat = this.getStat();

        if (field !== null) {
            data['field'] = field; 
        }
        if (split !== null) {
            data['split'] = split;
        }
        if (stat !== null) {
            data['stat'] = stat;
        }
        return data;
    },

    updateFlyouts: function() {
        var data = this.getData() || {};

        if (data['field'] !== undefined) {
            if (this.$fieldDropdown.find("li").length > 0) {
                this.$fieldDropdown.find("li:contains('"+data['field']+"')").click();
            } else {
                this.setField(data['field']);
            }
        }
        if (data['stat'] !== undefined) {
            this.$statDropdown.find("li[_val='"+data['stat']+"']").click();
        }
        if (data['split'] !== undefined) {
            this.$splitDropdown.find("li[_val='"+data['split']+"']").click();
        }
    },

    updateSearch: function() {
        this.setReportSearch(this.makeReportSearch());
        this.pushContextToChildren();
    },

    setFromStorage: function(){
        var self = this,
            data = this.urlStorage.load();

        if (data !== undefined && !$.isEmptyObject(data)){
            data = JSON.parse(data);
            if (data !== undefined && !$.isEmptyObject(data)){
                self.setData(data);
            }
            self.initSelector();
        } else {
            this.storage.load(function(newData){
                if (newData !== undefined && !$.isEmptyObject(newData)){
                    newData = JSON.parse(newData);
                    if (newData !== undefined ) {
                        self.setData(newData);
                    }
                }
                self.initSelector();
            });
        }
    },

    saveToStorage: function(){
        var input = this.getSnapshot(),
            data;

        if (!$.isEmptyObject(input)) {
            data = JSON.stringify(input);
            this.storage.save(data);
            this.urlStorage.save(data);
        }
    }

});
