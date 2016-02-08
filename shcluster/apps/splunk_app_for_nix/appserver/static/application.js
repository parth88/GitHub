(function(){

switch (Splunk.util.getCurrentView()) {
    case "hosts":
        // TODO: Purge memory of below from brain
        $(document).ready(function() {

            /*************************************************
                Page Control buttons for UnixModuleCloner
            **************************************************/

            // Set up interaction between node detail buttons & UnixModuleCloner
            var UnixModuleClonerId = $('.UnixModuleCloner').first().attr('id'),
                UnixModuleCloner = Splunk.Globals['ModuleLoader'].getModuleInstanceById(UnixModuleClonerId),
                $UnixModuleClonerContainer = UnixModuleCloner.$container,
                $unpinButton = $('.NodeDetailControl .unpinButton'),
                $compareButton = $('.NodeDetailControl .compareButton'),
                $overlay = $('.overlay');

            // Bind event listener to UnixModuleCloner data changes
            // to control enabled/disabled state of node detail buttons
            $UnixModuleClonerContainer.bind('change', function(event) {
                var total = UnixModuleCloner.getTotalCount(),
                    totalPinned = UnixModuleCloner.getTotalPinnedCount();

                // 'Compare' button enabled when there are more than 1 panel
                if (total > 1) {
                    $compareButton.removeClass('splButton-disabled');
                } else {
                    $compareButton.addClass('splButton-disabled');             
                }
                $compareButton.text('Compare (' + total + ')');

                // 'Unpin' button enabled when there are more than 1 pinned panel
                if (totalPinned > 0) {
                    $unpinButton.removeClass('splButton-disabled');
                } else {
                    $unpinButton.addClass('splButton-disabled');             
                }
            });

            // Click handler for 'unpin' button
            $unpinButton.bind('click', function(event) {
                var $el = $(this);
                if ($el.hasClass('splButton-disabled')) {
                    return;
                }
                $UnixModuleClonerContainer.trigger('collectionReset');
            });

            // Click handler for 'compare' button
            $compareButton.bind('click', function(event) {
                var $el = $(this);
                if ($el.hasClass('splButton-disabled')) {
                    return;
                }
                UnixModuleCloner.disableAllPanelContainers();
                $overlay.show();
                // custom drawing applied one retrieved collection
                tileElements(UnixModuleCloner.getAllPanelContainers());
            });

            $overlay.bind('click', function(event) {
                UnixModuleCloner.enableAllPanelContainers();
                $overlay.hide();
                UnixModuleCloner.repositionCollection(true);
            });

            function tileElements(elements) {
                if (!$.isArray(elements) || elements.length === 0) {
                    return false;
                }
                var count = elements.length,
                    unitWidth = elements[0].width(),
                    unitHeight = elements[0].height(),
                    totalWidth = $(window).width(),
                    totalHeight = $(window).height(),
                    posLeftDelta, posTopDelta,
                    posLeft, posTop;

                posLeft = (totalWidth > count * unitWidth) ? Math.round((totalWidth - count * unitWidth ) / 2) : 0;
                posLeftDelta = (totalWidth > count * unitWidth) ? unitWidth : Math.floor(totalWidth / count);
                //posTop = (totalHeight > unitHeight) ? Math.round((totalHeight - unitHeight) / 2) : 0;
                posTop = $compareButton.position().top;
                posTopDelta = 0;

                $.each(elements, function(i, $el) {
                    var curPos = $el.position();
                    $el.css('position', 'absolute');
                    $el.animate({
                        top: '+=' + (posTop - curPos.top),
                        left: '+=' + (posLeft - curPos.left)
                    }, 'fast');
                    posLeft += posLeftDelta;
                    posTop += posTopDelta;
                });
            }

            // TODO: This is VIEW only so move to template where it belongs
            // Add clearfixes after every row in system status section
            $('.NodeDetail .NodeDetailStatus .UnixResultsTable').after('<div class="splClearfix"></div>');      
        });

        /*
         * Override Paginator to not empty its content with every context change
         * causing an annoying flickering + browser reflow
         */
        if (Splunk.Module.Paginator) {
            Splunk.Module.Paginator = $.klass(Splunk.Module.Paginator, {
                /**
                 * Handles a new search.
                 */
                onContextChange: function(){
                    this.offset = 0;
                    var context = this.getContext();
                    var search  = context.get("search");
                    // Note: Commented out this part to avoid flickering
                    // if (search.isJobDispatched()){
                    //     if (this.getEntityCount()==0) {
                    //         this.resultsContainer.html('');
                    //     }
                    // }

                    // if there is an upstream paginator, we catch it's offset and if it's different, we update ourselves. 
                    var hasUpstreamPaginator = context.has("results.upstreamPaginator");
                    
                    // NOTE: this means the upstream paginator has sent us an offset value.
                    //       most of the time paginator takes it's internal property, and publishes it to the world 
                    //       via the context.  In this case however when we have another paginator above us, 
                    //       that pattern is reversed,  we actually listen to the offset from above...
                    if (hasUpstreamPaginator && context.has("results.offset")) {
                        this.offset = context.get("results.offset");
                    }
                    //subtle but important corner case - reset offset when count change is greater than offset.
                    if (this.offset != 0 && context.has("results.offset") && parseInt(context.get("results.offset"), 10) > this.offset){
                        this.offset = 0;
                    }
                    if (search.isJobDispatched() && search.job.isDone()) {
                        this.getResults();
                    }
                },
                
                resetUI: function(){
                    this.offset = 0;
                    this.length = 0;
                }
            });
        }
        break;

    default:
        break;
}

})();
