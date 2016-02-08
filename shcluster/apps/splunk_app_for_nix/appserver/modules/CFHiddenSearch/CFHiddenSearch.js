Splunk.Module.CFHiddenSearch = $.klass(Splunk.Module, {
    xhrRetryCount: 10,

    initialize: function($super, container) {
        $super(container);

        //this.childEnforcement = Splunk.Module.ALWAYS_REQUIRE;
        this.messenger = Splunk.Messenger.System.getInstance();
        this.logger = Splunk.Logger.getLogger("cf_hidden_search.js");
        this.hide(this.HIDDEN_MODULE_KEY);
        this.ctxid = this.getParam('contextId');
        this.basesearch = this.getParam('search');
        this.timerange = new Splunk.TimeRange(this.getParam('earliest') || '0', this.getParam('latest') || 'now');
        this.search = null;
        this.xhrObject = null;
        this.complete = false;
    },

    getModifiedContext: function() {
        var context = this.getContext();

        context.set(this.ctxid, this.results);

        return context;
    },

    onContextChange: function() {
        var context = this.getContext();

        if (this.basesearch) {
            var tokens = Splunk.util.discoverReplacementTokens(this.basesearch),
                basesearch = this.basesearch,
                search = new Splunk.Search();

            for (var i=0; i<tokens.length; i++) {
                var replacer = new RegExp("\\$" + tokens[i] + "\\$");
                basesearch = Splunk.util.replaceTokens(basesearch, replacer, context.get(tokens[i]));
            }

            search.setBaseSearch(basesearch);
            search.setTimeRange(this.timerange);
            this.search = search;
            this._stealthSearch();
        }
    },

    handleResults: function(response) {
        this.results = response.result;
        this.pushContextToChildren();
    },

    _stealthSearch: function() {
        var search = this.search,
            that = this;

        if (this.dispatchAlreadyInProgress || this.complete)
            return false;

        this.dispatchAlreadyInProgress = true;

        search.dispatchJob(
            function(search) {
                var _getResults = function () {
                    var counter = 0;

                    if (!search.job.isDone()) {
                        if (counter > this.xhrRetryCount) {
                            this.xhrObject.abort();
                            this.xhrObject = null;
                            this.logger.info('XHR in-flight destroyed for module', this.moduleId, 'for job', job.getSearchId(), 'and replaced with new one');
                        } else {
                            counter++;
                            setTimeout(_getResults, 250);
                        }
                        return;
                    }

                    this.dispatchAlreadyInProgress = false;
                    this.complete = true;

                    this.logger.info('XHR clear for takeoff for module', this.moduleId);
                    var params = {sid: search.job.getSearchId()},
                        resultUrl = this.getResultURL(params),
                        callingModule = this.moduleId;

                    this.xhrObject = $.ajax({
                        type: "GET",
                        //cache: ($.browser.msie ? false : true),
                        cache: false,
                        url: resultUrl,
                        beforeSend: function(xhr) {
                            xhr.setRequestHeader('X-Splunk-Module', callingModule);
                        },
                        success: function(htmlFragment, textStatus, xhr) {
                            this.logger.info('->XHR DEBUG: observer: success status:', xhr.status, 'module:', this.moduleId, 'responseText:', !!(htmlFragment));
                            //JQuery 1.4 bug where success callback is called after an aborted request
                            //NOTE: status 0 means the resource is unreachable
                            if (xhr.status === 0) {
                                return;
                            }
                            this.handleResults(htmlFragment);
                        }.bind(this),
                        complete: function(xhr, textStatus) { this.xhrObject = null; },
                        error: function(xhr, textStatus, errorThrown) {
                            that.xhrObject = null;
                            if (textStatus == 'abort') {
                                that.logger.debug(that.moduleType, '.getResults() aborted');
                            } else {
                                that.logger.warn(that.moduleType, '.getResults() error; textStatus=' + textStatus + ' errorThrown=' + errorThrown);
                            }
                        }
                    });
                }.bind(this);

                _getResults();
            }.bind(this),

            function(search) {
                this.dispatchAlreadyInProgress = false;
                this.logger.error(this.moduleType, " Context failed to dispatch job for search=", search.toString());
                console.log("search fail", search);
            }
        );

        return true;
    }
});
