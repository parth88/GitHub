Splunk.Module.UnixShareLink = $.klass(Splunk.Module, {

    initialize: function($super, container){
        $super(container);
        
        var self = this;

        this.active = false;
        this.$container = this.container;
        this.$button = self.$container.find('.icon-share');
        this.$wrapper = self.$container.find('.UnixShareLinkWrapper');
        this.$contents = self.$container.find('.UnixShareLinkContent');

        // This should handle all URL changes,
        // either applied from pushState or ordinary hash changes
        $(window).bind('hashchange', function(){
            self.updateContents();
        });

        this.$container.hover(function(){
            self.$button.addClass('hover');
        }, function(){
            self.$button.removeClass('hover');
        });

        this.$button.toggle(function(){
            // ensure it's up to date
            self.updateContents();
            self.$wrapper.show();
            self.$contents.select();
        }, function(){
            self.$wrapper.hide();
        });

        // initial contents from URL
        self.updateContents();
    },

    updateContents: function(){
        this.$contents.val(window.location);
    }
});