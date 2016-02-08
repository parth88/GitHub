(function($, _){
    Splunk.Module.UnixDropdown = $.klass(Splunk.Module, {
        
        initialize: function($super, container){
            var self = this,
                flyout;

            $super(container);

            this.simpleReplace = this.getParam('simpleReplace');
            if(this.simpleReplace === 'true'){ 
                this.simpleReplace = true;
            } else {
                this.simpleReplace = false;
            }

            this.key = this.getParam('key');
            this.$container = $("#"+ this.moduleId);
            this.$dropdownToggle = this.$container.find(".dropdown-toggle");
            this.$dropdown = this.$container.find(".dropdown");

            if(this.getParam('options') !== null && this.getParam('options') !== undefined){
                this.options = this.convertParams(this.getParam('options'));
                this.setup();
                this.useInternalSearch = false;
            } else {
                this.useInternalSearch = true;
                this.earliest = this.getParam('earliest');
                this.latest = this.getParam('latest');
                if(this.latest === null){
                    this.latest = undefined;
                }
                this.internalSearchStr = this.getParam('internalSearch');
                this.internalSearch = new Splunk.Search();
                timerange = new Splunk.TimeRange(this.earliest, this.latest);

                this.internalSearch.setBaseSearch(this.internalSearchStr);
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

        setup: function(){
            this.currentOption = this.options[0];
            this.initSelector();
            this.setSelectedOption();
        },

        // onContextChange: function(){
        //     var context = this.getContext(),
        //         search = context.get('search'),
        //         form = context.get('form'),
        //         timerange,
        //         self = this;
        // },

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

            xhrObject = $.ajax({
                type: "GET",
                cache: false,
                url: resultUrl,
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Splunk-Module', callingModule);
                },
                success: function(data, textStatus, xhr) {
                    self.options = data.results;
                    self.setup();
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

        convertParams: function(params){
            var converted = [];

            $.each(params, function(i, v){
                $.each(v, function(name){
                    // converted.push({
                    //     "name": name
                    // });
                    converted.push(name);
                });
            });

            return converted;
        },

        getResultParams: function($super) {
            var params = $super();
            params.sid = this.internal_search.job.getSearchId();
            return params;
        },

        getModifiedContext: function(){
            context = this.setOption();
            return context;
        },

        initSelector: function(){
            var self = this,
                flyout;

            this.$dropdownToggle.dropdown();
            flyout = new Flyout(this.options, 0, this.$dropdown, {
                change: function(i){
                    self.currentOption = self.options[i];
                    self.setSelectedOption();
                }
            });
        },

        replaceSearchToken: function(searchStr, token, replacement){
            var re = new RegExp("\\$("+token+")\\$", 'gi');
            return searchStr.replace(re, replacement);
        },

        setOption: function(){
            var context = this.getContext(),
                form = context.get('form') || {},
                search = context.get('search'),
                searchStr = search.toString()

            if(this.currentOption !== undefined){
                if(this.currentOption.name !== undefined){
                    form[this.key] = this.currentOption.name;
                } else {
                    form[this.key] = this.currentOption;
                }
                context.set('form', form);

                if(this.simpleReplace){
                    searchStr = this.replaceSearchToken(searchStr, this.key, this.currentOption);
                }
                search.setBaseSearch(searchStr);
                context.set('search', search);

                return context;
            } else {
                return context;
            }
            
        },

        setSelectedOption: function(){
            var context = this.setOption();
            this.pushContextToChildren();
        }

    });

})(UnixjQuery, UnixUnderscore);
