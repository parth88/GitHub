(function($, _, i18n, undefined) {

Splunk.Module.UnixNodesPaginator = $.klass(Splunk.Module.UnixBaseDispatchingFactoryFactory, {
    EVENTS_ENTITY_NAME: "events",
    RESULTS_ENTITY_NAME: "results",
    AUTO_ENTITY_NAME: "auto",
    SETTINGS_MAP_ENTITY_NAME: "settings",
    initialize: function($super, container){
        $super(container);
        this.childEnforcement = Splunk.Module.ALWAYS_REQUIRE;

        this.logger = Splunk.Logger.getLogger("paginator.js");
        this.entityName = this._params['entityName'];
        this.increment = parseInt(this._params['increment'], 10);

        this.count = this.increment;
        this.offset = 0;
        this.total = 0;

        this.$resultsContainer = $(".UnixNodesPaginatorWrapper", container);

        this.storage = new this.RemoteStorage('Splunk.Module.UnixNodesPaginator', this.moduleId, false, this.moduleType);
        this.urlStorage = new this.URLStorage('Splunk.Module.UnixNodesPaginator', this.moduleId, false, this.moduleType);

        this.setFromStorage();

        this.setupTemplate();
        // bind a top level event listener
        
        this.$resultsContainer.on('click', 'a', this.onLinkClick.bind(this));

    },

    getCount: function() {
        return this.count;
    },

    getIncrement: function() {
        return this.increment;
    },

    getOffset: function() {
        return this.offset;
    },

    getTotal: function() {
        return this.total;
    },

    setupTemplate: function() {
        this.template = _.template(
            "<div>" +
                "<span class='text-large'><%=count%></span><span class='text-medium'> "+i18n('of')+" <%=total%> "+i18n('shown')+"</span>" +
                "<span class='controls'>show&#58;" +
                    "<% _.each(controls, function(c) { %>" +
                        "<a href='#' class='<%=c.class%> <%=(c.disabled)?'disabled':''%>'><%=c.label%></a>" +
                    "<% }); %>" +
                "</span>" +
            "</div>"
        );
    },

    setCount: function(val) {
        this.count = val;
        this.saveToStorage();
    },

    setIncrement: function(val) {
        this.increment = val;
    },

    setOffset: function(val) {
        this.offset = val;
        this.saveToStorage();
    },

    setTotal: function(val) {
        this.total = val;
    },

    setupControls: function() {
        var controls = [],
            count = this.getCount(),
            increment = this.getIncrement(),
            total = this.getTotal();

        controls.push({
            label: i18n('more'),
            class: 'show-more',
            disabled: (count >= total)
        });
        controls.push({
            label: i18n('fewer'),
            class: 'show-less',
            disabled: (count <= increment)
        });
        controls.push({
           label: i18n('all'),
           class: 'show-all',
           disabled: (count >= total) 
        });

        return controls;
    },

    onLinkClick: function(event){
        var $eventTarget = $(event.target),
            count = this.getCount(),
            increment = this.getIncrement(),
            total = this.getEntityCount();

        event.preventDefault();

        if ($eventTarget.hasClass('disabled')) {
            return false;
        }

        if ($eventTarget.hasClass('show-more')) {
            count += increment;
        } else if ($eventTarget.hasClass('show-less')) {
            count -= increment;
        } else if ($eventTarget.hasClass('show-all')) {
            count = total;
        }

        // count cannot exceed total
        count = Math.min(total, count);
        // count cannot be < 1
        count = Math.max(count, 1);
 
        this.setCount(count);
        this.setTotal(total);

        this.pushContextToChildren();
        this.getResults();

        //return false;
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
     * This is fired the moment the dispatch request goes out. 
     * and we use it here, if we need events, to set the minimum status_buckets to 1.
     */
    onBeforeJobDispatched: function(search) {
        // we need at least 1 if the pager is set to look at events.
        if (this.entityName == this.EVENTS_ENTITY_NAME) {
            search.setMinimumStatusBuckets(1);
        }
    },

    /**
     * Return the correct item count based on a module entityName value 
     * (EVENTS_ENTITY_NAME, RESULTS_ENTITY_NAME or SETTINGS_MAP_ENTITY_NAME).
     */
    getEntityCount: function(){
        var count,
            context = this.getContext(),
            search  = context.get("search");

        switch(this.entityName){
            case this.AUTO_ENTITY_NAME:
                count = search.job.areResultsTransformed() ? search.job.getResultCount() : search.getEventAvailableCount();
                break;
            case this.EVENTS_ENTITY_NAME:
                //Search now has it's own getEventAvailableCount
                //that will return the correct answer even when the user has 
                //selected a subset of the timerange  
                count = search.getEventAvailableCount();
                break;
            case this.RESULTS_ENTITY_NAME:
                count = search.job.getResultCount();
                break;
            case this.SETTINGS_MAP_ENTITY_NAME:
                count = this.total;
                break;
            default:
                this.logger.error("Invalid module entityName value of", this.entityName);
                count = 0;
                break;
        }
        return count;
    },
    /**
     * Override default.
     */
    getModifiedContext: function() { 
        var context = this.getContext(),
            count = this.getCount(),
            total = this.getTotal();

        context.set("results.count", count);
        
        if (this.entityName == this.SETTINGS_MAP_ENTITY_NAME) {
            context.set("results.totalCountCallback", function(val) {
                total = (val != null) ? val : total;
                this.setTotal(total);
                this.getResults();
            }.bind(this));
        }

        return context;
    },

    /**
     * Handle job complete and retrieve new results if required.
     */
    onJobDone: function(event){
        this.setTotal(this.getEntityCount());
        this.getResults();
    },

    /**
     * Handle job progress notification and retrieve new results if required.
     *
     * @param {Object} event A jQuery event.
     */
    onJobProgress: function(event){
        var total = this.getEntityCount();
        this.setTotal(total); 
        if (total > 0) {
            this.getResults();
        }
    },

    /**
     * Handles a new search.
     */
    onContextChange: function(){
        var context = this.getContext(),
            search  = context.get("search");
        

        // if there is an upstream paginator, we catch it's offset and if it's different, we update ourselves. 
        var hasUpstreamPaginator = context.has("results.upstreamPaginator");
        
        // NOTE: this means the upstream paginator has sent us an offset value.
        //       most of the time paginator takes it's internal property, and publishes it to the world 
        //       via the context.  In this case however when we have another paginator above us, 
        //       that pattern is reversed,  we actually listen to the offset from above...
        if (hasUpstreamPaginator && context.has("results.offset")) {
            this.setOffset(context.get("results.offset"));
        }
        if (hasUpstreamPaginator && context.has("results.count")) {
            this.setCount(context.get("results.count"));
        }
        //subtle but important corner case - reset offset when count change is greater than offset.
        if (this.offset != 0 && context.has("results.offset") && parseInt(context.get("results.offset"), 10) > this.offset){
            this.setOffset(0);
        }

        if (search.isJobDispatched() && search.job.isDone()) {
            this.setTotal(this.getEntityCount());
            this.getResults();
        }
    },

    /**
     * Override default.
     */
    getResults: function() {
        var count = this.getCount(),
            total = this.getTotal();

        if (total === 0) {
            this.$resultsContainer.html("");
            return;
        }

        // dynamically setup appropriate paging controls
        var controls = this.setupControls();

        // if count=0, then showing all; otherwise
        // count cannot be higher than total
        var options = {
            total: total,
            count: Math.min(total, count),
            controls: controls
        };

        var render = this.template(options);
        this.$resultsContainer.html(render);
    },

    /**
     * Override render results so the message is set to an empty string if no content is available.
     */
    renderResults: function($super, htmlFragment){
        if(!htmlFragment){
            this.$resultsContainer.html("");
        }else{
            $super(htmlFragment);
        }
    },
    /**
     * Reset the UI to its original state.
     */
    resetUI: function(){
        // this.count = this.increment;
        // this.offset = 0;
        // this.total = 0;
        //this.$resultsContainer.html("");
    },

    requiresDispatch: function($super,search) {
        var entityName = this.getParam('entityName');
        if (entityName == this.SETTINGS_MAP_ENTITY_NAME) return false;
        return $super(search);
    },

    /*
     * Save count and offset to remote storage
     */
    saveToStorage: function(){
        var self = this,
            settings = {},
            data;
        settings['count'] = this.getCount();
        settings['offset'] = this.getOffset();
        data = JSON.stringify(settings);
        this.storage.save(data);
        this.urlStorage.save(data);
    },

    /*
     * attempt to get selected from storage
     * 1) URL storage
     * 2) User-Prefs
     * 3) Default selected
     */
    setFromStorage: function() {
        var self = this,
            data;

        data = this.urlStorage.load();

        if(data !== undefined && data.length > 0){
            data = JSON.parse(data);
            if(data !== undefined) {
                if (data['count'] !== undefined) { 
                    self.setCount(data['count']);
                }
                if (data['offset'] !== undefined) {
                    self.setOffset(data['offset']);
                }
            }
        } else {
            this.storage.load(function(newData){
                if(newData !== undefined){
                    newData = JSON.parse(newData);
                    if (newData !== undefined) {
                        if (newData['count'] !== undefined) {
                            self.setCount(newData['count']);
                        } 
                        if (newData['offset'] !== undefined) {
                            self.setOffset(newData['offset']);
                        } 
                    }
                } 
            });
        }
    }

});

}(UnixjQuery, UnixUnderscore, _));
