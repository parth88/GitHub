(function($, _, i18n, undefined) {

Splunk.Module.CFPaginator = $.klass(Splunk.Module, {
    /**
     * Paginate twice it's a long way to the bay!
     */
    initialize: function($super, container){
        $super(container);
        // we subclass validateHierarchy to provide an exception for when the paginator is operating as a 
        // secondary paginator.  This is the only case in which a Paginator may have a good reason to have no children.
        this.childEnforcement = Splunk.Module.ALWAYS_REQUIRE;

        this.logger = Splunk.Logger.getLogger("paginator.js");
        
        this.mergeLoadParamsIntoContext("results", ["count", "maxPages"]);
        this.length = 0;
        this.offset = 0;
        this.resultsContainer = $(".ResultsContainer", this.container);
        if( $("script", this.container).length )
        	this.template = doT.template($("script", this.container)[0].innerHTML);
        this.bindUIEvents();//Bootstrap top level event dispatcher.

        this.namespace = this.getParam('namespace');
    },

    validateHierarchy: function($super) {
        var context = this.getContext();
        // unless there's no paginator upstream, the normal validation is applied.
            
        if (!context.has("results.upstreamPaginator")) {
            // we could inline a simpler method here rather than using the superclass
            // but this way all the messaging is in one place.
            return $super();
        }
    },

    /**
     * Bind a generic UI event listener.
     */
    bindUIEvents: function(){
        this.container.bind("click", this.onUIEvent.bind(this));
        this.container.attr({
            'data-update': '',
            'data-reset': ''
        })
        this.container.bind('cf.update', this.filterResults.bind(this));
    },

    getEntityCount: function(){
        var count;
        var context = this.getContext();
        var namespace = context.get('namespace'),
            nsobj = context.get(namespace),
            dataset = context.get('crossfilter'),
            controller = context.get(this.namespace + '_controller');

        if (dataset !== undefined && dataset !== null && nsobj) {
            count = dataset.groupAll().reduceCount().value();
        } else
            count = 0;

        return count;
    },
    /**
     * Override default.
     */
    getModifiedContext: function() { 
        var context = this.getContext();
        context.set("results.offset",   this.offset);
        
        // pass a reference to onOffsetChange down, for any second paginators we may find below.
        context.set("results.upstreamPaginator", this);
        return context;
    },
    /**
     * Override default.
     */
    getResults: function() {
        var context = this.getContext();
        var options = {
            max_items_page: context.get('results.count'), 
            max_pages: context.get('results.maxPages'),
            item_offset: this.offset
        };
        var that = this,
            namespace = context.get('namespace'),
            nsobj = context.get(namespace),
            dataset = context.get('crossfilter'),
            controller = context.get(this.namespace + '_controller');

        if (dataset !== undefined && dataset !== null && nsobj) {
            if (dataset.groupAll().value() === 0) {
                this.resultsContainer.html('');
                return;
            }
            count = this.getEntityCount();
            var dim = dataset.dimension(function(d) { return d.trigger_time; }),
                format = d3.time.format("%x %I:%M:%S %p");
                summary = {'count': count,
                    'et': format(new Date(Number(dim.bottom(1)[0].trigger_time)*1000)),
                    'lt': format(new Date(Number(dim.top(1)[0].trigger_time)*1000))
                };
            dim.remove();
            var paginator = new Splunk.paginator.Google(count, options);
            var render = this.template({p: paginator, s: summary});
            this.resultsContainer.html(render);
        
        }
    },

    /**
     * Does room exist for more pages to be displayed (Used for request throttling).
     */
    hasCapacity: function(){
        var context = this.getContext();
        return ($("li.page", this.container).length < context.get("results.maxPages"));
    },

    /**
     * Handle a UI event and retrieve results response.
     *
     * @oaram {Object} element The DOM element that triggered the event.
     */
    onOffsetChange: function(element){
        element = $(element);//Cast to a jquery element.
        var resource = element.attr("href");
        var query = resource.split("#")[1];
        try{
            this.offset = parseInt(Splunk.util.queryStringToProp(query).offset, 10);
        }catch(err){
            this.logger.error("Could not parse offset from uri.", err);
            return false;
        }
        this.pushContextToChildren();
        this.getResults();
        return false;//Cancel the click/keyboard event from making a request.
    },

    /**
     * Handles a new search.
     */
    onContextChange: function(){
        this.offset = 0;
        var context = this.getContext();

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
        this.getResults();
    },
    
    /**
     * Top level UI event listener and dispatcher.
     *
     * @param {Object} event A jQuery event.
     */
    onUIEvent: function(event){
       var eventType = event.type;
       var eventTarget = event.target;//What was the source element of the event.
       if((eventType==="click") && $(eventTarget).is("a")){
           if ($(eventTarget).hasClass('disabled')) return false;
           var context = this.getContext();
           var upstreamPaginatorReference = context.get("results.upstreamPaginator");
           if (upstreamPaginatorReference) {
                upstreamPaginatorReference.onOffsetChange(eventTarget);
                // unless the upper paginator is already visible onscreen, scroll up to it.
                $(window).scrollTop(Math.min($(window).scrollTop(), upstreamPaginatorReference.container.offset().top));
           }
           return this.onOffsetChange(eventTarget);
       }
    },
    /**
     * Override render results so the message is set to an empty string if no content is available.
     */
    renderResults: function($super, htmlFragment){
        if(!htmlFragment){
            this.resultsContainer.html("");
        }else{
            $super(htmlFragment);
        }
    },
    /**
     * Reset the UI to its original state.
     */
    resetUI: function(){
        this.offset = 0;
        this.length = 0;
        //TODO - review why this push was here.  If the caller wanted to push the changes 
        //       to downstream modules they will be doing it themselves. 
        //       my guess is it was here cause arguably it was 'resetting' downstream modules
        //       but a module's resetUI() should only worry about itself.
        //this.pushSettingsToChildren();
        this.resultsContainer.html("");
    },

    filterResults: function() {
        this.offset = 0;
        this.length = 0;
        this.getResults();
    }
});

}(UnixjQuery, UnixUnderscore, _));
