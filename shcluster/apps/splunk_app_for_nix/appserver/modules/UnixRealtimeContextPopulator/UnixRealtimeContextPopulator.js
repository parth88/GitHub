/*
UnixRealtimeContextPopulator

This module is very similar to UnixContextPopulator.
This module handles realtime searches, whereas UnixContextPopulator cannot.
Realtime searches never trigger onJobDone. Additionally,
there is no guarantee that a realtime search will have enough data. This lack of data
might not provide accurate representation of all the values for a field.

Our solution is to provide a secondary search. This secondary search is 
based upon whichever search is in the context.
The secondary search (this.internalSearch) changes the range to -15m (by default).
This works around the problems created by a realtime search.
*/

Splunk.Module.UnixRealtimeContextPopulator = $.klass(Splunk.Module.DispatchingModule, {

    initialize: function($super, container) {
        $super(container);
        this.hide('HIDDEN MODULE KEY');
        this.filterInfo = null;
        this.prevSearch = null;
        this.namespace = this.getParam('namespace');
        this.internalSearch = new Splunk.Search();
        this.earliest = this.getParam('earliest');
        this.latest = this.getParam('latest');
        if(this.latest === null){
            this.latest = undefined;
        }

        var self = this;
    },

    onContextChange: function(){
        var context = this.getContext(),
            search = context.get('search'),
            timerange,
            self = this;
        
        /*
        We don't need to update unless the search has actually changed.
        This typically occurs when UnixSearchSelector selects a new search
        */
        if(search.getBaseSearch() !== this.internalSearch.getBaseSearch()){
            timerange = new Splunk.TimeRange(this.earliest, this.latest);

            this.internalSearch.setBaseSearch(search.getBaseSearch());
            this.internalSearch.setTimeRange(timerange);

            /*
            We have to dispatch the search ourselves
            since this is a new search
            */
            this.internalSearch.dispatchJob(function(search){
                self._getResults(search);
            });
        }
        
    },

    /*
    Since we use a secondary search (this.internalSearch) we must handle
    this boilerplate AJAX code ourselves.
    Ordinarily this is done by the AbstractModule base class.
    */
    _getResults: function(search){
        var counter = 0,
            params = {sid: search.job.getSearchId()},
            resultUrl = this.getResultURL(params),
            callingModule = this.moduleId,
            xhrObject,
            xhrRetryCount = 10,
            self = this;

        if (!search.job.isDone()) {
            if (counter > xhrRetryCount) {
                xhrObject.abort();
                xhrObject = null;
                this.logger.info('XHR in-flight destroyed for module', callingModule, 'for job', job.getSearchId(), 'and replaced with new one');
            } else {
                counter++;
                setTimeout(function(){
                    self._getResults(search);
                }, 250);
            }
            return;
        }

        this.logger.info('XHR clear for takeoff for module', callingModule, search.job.getSearchId());

        xhrObject = $.ajax({
            type: "GET",
            cache: false,
            url: resultUrl,
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Splunk-Module', callingModule);
            },
            success: function(htmlFragment, textStatus, xhr) {
                //JQuery 1.4 bug where success callback is called after an aborted request
                //NOTE: status 0 means the resource is unreachable
                if (xhr.status === 0) {
                    return;
                }

                self._renderResults(htmlFragment);
            }.bind(this),
            complete: function(xhr, textStatus) { self.xhrObject = null; },
            error: function(xhr, textStatus, errorThrown) {
                //xhr = null;
                if (textStatus == 'abort') {
                    self.logger.debug(self.moduleType, '.getResults() aborted');
                } else {
                    self.logger.warn(self.moduleType, '.getResults() error; textStatus=' + textStatus + ' errorThrown=' + errorThrown);
                }
                self.logger.error(textStatus, errorThrown);
            }
        });
    },

    /*
     * add internal sid to getResults() request
     */ 
    getResultParams: function($super) {
        var params = $super();
        params.sid = this.internalSearch.job.getSearchId();
        return params;
    },

    /*
     * insert data from controller response into context, using namespace
     * with our internal search, an ordinary renderResults will not be called
     * so we use this instead
     */
    _renderResults: function(data) {
        var context = this.getContext(),
            form = context.get(this.namespace) || {};
            
        for (key in data) {
            form[key] = data[key];
        }

        context.set(this.namespace, form);
        this.passContextToParent(context);
    }

});
