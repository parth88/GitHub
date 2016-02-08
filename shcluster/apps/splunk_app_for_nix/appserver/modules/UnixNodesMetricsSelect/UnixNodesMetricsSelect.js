(function($, undefined) {

Splunk.Module.UnixNodesMetricsSelect = $.klass(Splunk.Module.UnixBaseAbstractFactoryFactory, {

    initialize: function($super, container) {
        $super(container);
        // cast container jQ object into jQ object using passed $ instance
        this.container = $(this.container);

        this.default_option = this.getParam('default_option');
        this.namespace = this.getParam('namespace');
        this.options = this.getParam('options');
        this.options_obj = this.buildObjFromList(this.options);
        this.select = $('select', this.container);
        this.selected = this.default_option;
        this.storage = new this.RemoteStorage('Splunk.Module.UnixNodesMetricsSelect', this.moduleId, false, this.moduleType);
        this.token = this.getParam('token');
        this.urlStorage = new this.URLStorage('Splunk.Module.UnixNodesMetricsSelect', this.moduleId, false, this.moduleType);
        this.width = this.getParam('outer_width');

        this.addOptions();
        if ($.multiselect === undefined) {
            $script(Splunk.util.make_url('/static/app/splunk_app_for_nix/js/contrib/jquery-ui/jquery.multiselect.js'),
                'mselect');
            $script.ready(['mselect'], this.initMultiSelect.bind(this));
        } else {
            this.initMultiSelect();
        }
    },
    
    /*
     * add the specified options to the module's select 
     */
    addOptions: function() {
       var selected = this.getSelected(),
           i, opt, $opt;
       for (i=0; i < this.options.length; i++) {
           // get the first (and only) key name
           opt = Object.keys(this.options[i])[0].toString();
           $opt = $('<option>')
               .attr('value', opt)
               .text(opt);
           if (selected === opt) {
               $opt.attr('selected', 'selected');
           }
           this.select.append($opt);
       }
    },
   
    buildObjFromList: function(list) {
        var output = {},
            i, key;
        for (i=0; i < list.length; i++) {
            key = Object.keys(list[i])[0];
            output[key] = list[i][key];
        }
        return output;
    },

    /*
     * intialize the multiselect
     */ 
    initMultiSelect: function() {
        var that = this;

        // retreive value from storage if it exists
        this.setFromStorage();
        this.select.multiselect({
            multiple: false,
            classes: "UnixNodesMetricsSelectWidget",
            close: function(event, ui) {
                that.button.removeClass('ui-multiselect-hover');
                that.menu.children('ul').first().children().first().show();
            },
            minWidth: this.width,
            open: function(event, ui) {
                that.button.addClass('ui-multiselect-hover');
                that.menu.children('ul').first().css('height','100%').children().first().hide();
            },
            selectedList: 1
        });

        // select button, header and menu
        this.button = $('button.ui-multiselect', this.container).width(this.width);
        this.header = $('#ui-multiselect-header_' + this.moduleId).hide();
        this.menu = $('#ui-multiselect-menu_' + this.moduleId);

        // bind input checkbox click
        this.menu.bind('click', this.onSelect.bind(this));

        // in case a selected mandate has been given
        //this.selectSelected(this.selected);

        // resize inner menu and checkboxes
        this.menu.css({
            height: 'auto'
        }).find('.ui-multiselect-checkboxes').css({
            width: '100%'
        });
    },

    /*
     * override
     * put selected in the form namespace
     */
    getModifiedContext: function() {
        var context = this.getContext(),
            form = context.get('form') || {},
            selected = this.getSelected();

        form[this.token] = selected;
        context.set('form', form);
        context.set(this.namespace, this.options_obj[selected]);
        return context;
    },

    getSelected: function() {
        return this.selected;
    },

    /*
     * override
     * we don't have any intentions, just a namespace 
     */
    getToken: function() {
        return this.token;
    },

    onContextChange: function() {
        var context = this.getContext(),
            form = context.get('form') || {},
            selected = form[this.token] || null;

        if (selected !== null) {
            this.selectSelected(selected);
        }
    },

    /*
     * select callback
     */
    onSelect: function(event) {
        var $target = $(event.target),
            val = $target.val();
        if ($target.is('input')) {
            this.selectSelected(val);
        }
    },

    /*
     * Save currently selected to remote storage
     */
    saveToStorage: function(){
        var self = this,
            selected = {},
            data;
        selected[self.token] = this.getSelected();
        data = JSON.stringify(selected);
        this.storage.save(data);
        this.urlStorage.save(data);
    },

    /*
     * check the checkbox corresponding to the selected value
     */
    selectSelected: function(val) {
        var token = this.getToken(),
            selected = {};
        this.select.children().attr('selected', false);
        this.select.children('option[value="' + val + '"]')
            .attr('selected', 'selected')
            .prependTo(this.select);
        this.setSelected(val);
        // if multiselect attached to select element
        if (this.select.is(':data(echMultiselect)')) {
            this.select.multiselect('close');
        }
        this.pushContextToChildren();
    },

    /*
     * attempt to get selected from storage
     * 1) URL storage
     * 2) User-Prefs
     * 3) Default selected
     * @return array selected
     */
    setFromStorage: function() {
        var self = this,
            token = self.token,
            data;

        data = this.urlStorage.load();

        if(data !== undefined && data.length > 0){
            data = JSON.parse(data);
            if(data !== undefined && data[token] !== undefined && data[token].length > 0){
                self.selectSelected(data[token]);
            }
        } else {
            this.storage.load(function(newData){
                if(newData !== undefined){
                    newData = JSON.parse(newData);
                    if (newData !== undefined && newData[token] !== undefined && newData[token].length > 0){
                        self.selectSelected(newData[token]);
                    } else {
                        self.selectSelected(self.default_option);
                    }
                } else {
                    self.selectSelected(self.default_option);
                }
            });
        }
    },

    setSelected: function(val) {
        this.selected = val;
        this.saveToStorage();
    }

});

}(UnixjQuery));
