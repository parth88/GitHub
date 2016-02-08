Splunk.Module.UnixPrefsReset = $.klass(Splunk.Module.UnixBaseAbstractFactoryFactory, {

    initialize: function($super, container){
        $super(container);
        this.$button = $('button', this.container);
        this.$button.click(this.onButtonClick.bind(this));
        this.storage = new this.RemoteStorage('Splunk.Module.UnixPrefsReset', this.moduleId, false, this.moduleType);
    },
    
    onButtonClick: function() {
        this.storage.delete(function(bool) {
            if (bool === true) {
                window.location = window.location.pathname;
            } else {
                console.error('error: unable to reset storage'); 
            }
        });
    }
});
