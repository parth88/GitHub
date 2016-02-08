Splunk.Module.UnixContextPopulator = $.klass(Splunk.Module.DispatchingModule, {

    initialize: function($super, container) {
        $super(container);
        this.hide('HIDDEN MODULE KEY');
        this.internalSearch = null;
        this.filterInfo = null;
        this.prevSearch = null;
        this.namespace = this.getParam('namespace');
    },

    /*
     * add internal sid to getResults() request
     */ 
    getResultParams: function($super) {
        var params = $super();
        params.sid = this.getContext().get('search').job.getSearchId();
        return params;
    },

    /*
     * if the search string and time range are the same as previous search, return false
     */ 
    needsGetResults: function(search) {
        return search.getTimeRange().equalToRange(this.prevSearch.getTimeRange()) 
               && search.toString() === this.prevSearch.toString();
    },

    /*
     * when internal job is done, call the module controller 
     */ 
    onJobDone: function() {
        var search = this.getContext().get('search');
        this.getResults();
        this.prevSearch = search;
    },

    /*
     * insert data from controller response into context, using namespace
     */ 
    renderResults: function(data) {
        var context = this.getContext(),
            form = context.get(this.namespace) || {};
            
        for (key in data) {
            form[key] = data[key];
        }

        context.set(this.namespace, form);
        this.passContextToParent(context);
        this.internalSearch = null;
    }

});
