Splunk.Module.UnixFullscreen = $.klass(Splunk.Module, {

    initialize: function($super, container){
        $super(container);
        
        var self = this;

        this.active = false;
        this.$container = this.container;
        this.$iframe = this.$container.find('iframe');
        this.$button = this.$container.find('.goFull');

        // URL for the iframe
        this.iframeTarget = this.$iframe.attr('iframeTarget');
        
        this.$iframe.hide();

        // DOM Setup
        ///////////////////////////
        this.$fullscreenContainer = $("<div id='"+this.moduleId+"-iframe' class='fullscreenContainer' style='display:none;'></div>");
        $('body').first().prepend(this.$fullscreenContainer);
        this.$fullscreenContainer.prepend(this.$iframe);

        this.container.click(function(){
            if (screenfull.enabled) {
                self.active = true;
                self.loadIframe();
                screenfull.request();
            }
        });

        this.container.hover(function(){
            self.container.find('.icon-resize-full').addClass('hover');
        }, function(){
            self.container.find('.icon-resize-full').removeClass('hover');
        });

        this.$fullScreenButton = this.$button.clone(true);
        this.$fullscreenContainer.append(this.$fullScreenButton);
        this.$fullscreenContainer.find('.goFull').text('Exit Fullscreen');
        this.$fullScreenButton.click(function(){
            if (screenfull.enabled) {
                self.active = false;
                screenfull.exit();
                self.unloadIframe();
            }
        });

        screenfull.addOnChange(function(e){
            if(self.active){
                if(screenfull.isFullscreen){
                    self.$iframe.width(screen.availWidth);
                    self.$iframe.height(screen.availHeight);
                } else {
                    self.active = false;
                    self.unloadIframe();
                }
            }
        });
    },
    loadIframe: function(){
        this.$iframe.attr('src', this.iframeTarget);
        this.$iframe.show();

        // We want to preserve the current visibility state
        // We want to target items that are currently visible
        $("body").children(':visible').addClass('__visible__').hide();        
        this.$fullscreenContainer.show();
    },
    // This unloads the iframe, preventing big big memory leaks
    // We definitely dont want intensive JS running in the background when it's not
    // even visible to the user. This prevents all that from happening.
    // firefox doesn't play nice - we have to remove the iframe alltogether
    unloadIframe: function(){
        this.$iframe.removeAttr('src');
        this.$iframe.hide();
        var old = this.$iframe;
        this.$iframe = old.clone();
        this.$iframe.insertBefore(old);
        old.remove();

        // This targets only elements that were previously hidden by us
        // It avoids targeting elements that were hidden by some other part of the program
        // EG: hidden menus, divs, etc.
        $("body").children('.__visible__').show();
        this.$fullscreenContainer.hide();
    }
});

