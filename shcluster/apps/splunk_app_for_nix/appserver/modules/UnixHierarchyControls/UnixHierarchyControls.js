Splunk.Module.UnixHierarchyControls = $.klass(Splunk.Module.UnixBaseAbstractFactoryFactory, {

    initialize: function($super, container) {
        $super(container);

        this.storage = new this.RemoteStorage('Splunk.Module.UnixHierarchyControls', this.moduleId, false, this.moduleType);
        this.urlStorage = new this.URLStorage('Splunk.Module.UnixHierarchyControls', this.moduleId, false, this.moduleType);

        this.defaultVisibility = Splunk.util.normalizeBoolean(this.getParam('default_visibility'));
        this.thisGroup = this.getParam('this_group');
        this.nextGroup = this.getParam('next_group') || null;
        this.prevGroup = this.getParam('prev_group') || null;

        this.visible = null;

        this.$showThis = $(".showThis", container);
        this.$buttonContainer = $('.hierarchy_group', container);
        this.$hide = $('.hideButton', container);
        this.$showNext = $('.showNext', container);

        this.$showThis.bind('click', this.showThis.bind(this));
        if (this.nextGroup !== null) {
            this.$showNext.bind('click', this.onShowNextClick.bind(this));
        }
        this.$hide.bind('click', this.onHideClick.bind(this));

        this.setFromStorage(); 
    },

    initControls: function() {
        if (this.visible === null) {
            this.visible = this.defaultVisibility;
        }
        if (this.visible) {
            this.$buttonContainer.css('display', "");
            this.showDescendants(this.moduleId);
            $("[groupid="+ this.prevGroup +"]").next().children().hide();
        } else {
            this.$buttonContainer.css('display', "none");
            this.hideDescendants(this.moduleId);
        }
    },

    pushContextToChildren: function($super, exContext) {
        if (this.visible === false) {
            this.hideDescendants(this.moduleId);
            return;
        } else {
            $super(exContext);
        }
    },

    onHideClick: function(e) {  
        e.preventDefault();

        this.hideDescendants(this.moduleId);
        this.visible = false;
        this.$buttonContainer.hide();
        $("[groupid="+ this.prevGroup +"]").next().children().show();
        this.saveToStorage();
    },

    onShowNextClick: function(e) {
        $("[groupid="+ this.nextGroup +"].showThis").trigger('click');
        this.$buttonContainer.children().hide();
    },

    showThis: function(){
        this.$buttonContainer.show();
        this.showDescendants(this.moduleId);
        this.visible = true;
        this.pushContextToChildren();
        this.saveToStorage();
    },

    getVisibility: function() {
        return this.visible;
    },

    setVisibility: function(visible) {
        this.visible = visible;
    },

    setFromStorage: function(){
        var self = this,
            data = this.urlStorage.load();

        if (data !== undefined && !$.isEmptyObject(data)){
            data = JSON.parse(data);
            if (data !== undefined && !$.isEmptyObject(data)){
                self.setVisibility(data);
            }
            self.initControls();
        } else {
            this.storage.load(function(newData){
                if (newData !== undefined && !$.isEmptyObject(newData)){
                    newData = JSON.parse(newData);
                    if (newData !== undefined ) {
                        self.setVisibility(newData);
                    }
                }
                self.initControls();
            });
        }
    },

    saveToStorage: function(){
        var visible = this.getVisibility(),
            data;

        if (visible !== null) {
            data = JSON.stringify(visible);
            this.storage.save(data);
            this.urlStorage.save(data);
        }
    }
});
