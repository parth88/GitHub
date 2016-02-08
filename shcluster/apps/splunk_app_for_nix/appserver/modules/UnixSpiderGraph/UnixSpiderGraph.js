(function($, _){

    Splunk.Module.UnixSpiderGraph = $.klass(Splunk.Module.UnixBaseDispatchingFactoryFactory, { 

        initialize: function ($super, container, opt) {
            $super(container);
            var left,
                top,
                $document = $(document),
                smallerDim;

            // ensure backbone uses our version of jQuery, not splunk's old version
            Backbone.setDomLibrary($); 

            this.$container = $("#"+this.moduleId);

            this.width = this.getParam('width');
            if(this.width === null || this.width === undefined){
                this.width = this.$container.width();
            } else {
                this.width = Number(this.width);
            }

            this.height = this.getParam('height');
            if(this.height === null || this.height === undefined){
                this.height = this.$container.height();
            } else {
                this.height = Number(this.height);
            }

            if(this.height < this.width){
                smallerDim = this.height;
            } else {
                smallerDim = this.width;
            }

            this.showLoadingIndicator();

            this.clicked = false;
            this.clicked_value = null;
            this.namespace = 'form';
            this.token = 'host';

            this.$noResults = $('.noResultsArea', this.container);

            this.currentSearch = null;
            this.metricName = this.getParam('metricName');
            this.groupName = this.getParam('groupName');
            this.itemName = this.getParam('itemName');
            this.min = Number(this.getParam('min'));
            this.max = Number(this.getParam('max'));

            this.title = this.getParam('title');
            if(this.title !== undefined && this.title !== null){
                this.container.find('.header').append(this.title);
            }

            
            this.labelsOn = toBoolean(this.getParam('labelsOn'));
            this.throttleDuration = Number(this.getParam('throttle'));

            left = this.width/4;
            top = this.height/1.85;

            d3.select(container).select("svg")
                .attr({'width': this.width, 'height': this.height})
                .append("g")
                    .attr("transform", "translate(" + left + "," + top + ")")
                    .attr('class', 'wrapper');

            this.isJobDone = false;
            this.isFirstPlot = true;
            this.spiderPlot = new SpiderPlot(this.moduleId, this.width, this.height, this.labelsOn, this.storageFactory('Splunk.Module.UnixSpiderGraph'));

            this.update = _.throttle(this._update, this.throttleDuration);
        },

        hideNoResultsMessage: function(){
            this.$noResults.hide();
        },

        showNoResultsMessage: function(){
            this.$noResults.show();
        },

        getClicked: function() {
            return this.clicked;
        },

        getClickedValue: function() {
            return this.clicked_value;
        },

        getToken: function() {
            return this.token;
        },

        setClicked: function(val) {
            this.clicked = val;
        },

        setClickedValue: function(val) {
            this.clicked_value = val;
        },

        // completely get rid of the old stuff
        // we have no code that handles switching to a new searchy cleanly
        _reset: function(){
            this.hideNoResultsMessage();
            this.showLoadingIndicator();

            this.isFirstPlot = true;
            this.isJobDone = false;  // need this?
            $(this.container).find('svg .wrapper').empty();
            this.spiderPlot.destroy();
            this.spiderPlot = new SpiderPlot(this.moduleId, this.width, this.height, this.labelsOn, this.storageFactory('Splunk.Module.UnixSpiderGraph'));
        },

        /*
        * override
        * only drilldown if click has occurred
        */
        isReadyForContextPush: function($super) {
            if (this.getClicked() !== true) {
                return Splunk.Module.CANCEL;
            } 
            return Splunk.Module.CONTINUE;
        },
        getModifiedContext: function() {
            var context = this.getContext(),
                namespace = context.get(this.namespace) || {},
                clicked = this.getClicked(),
                value = this.getClickedValue(),
                token = this.getToken();

            if (clicked === true) {
                namespace[token] = value;
                context.set('click', this.moduleId);
            }

            context.set(this.namespace, namespace);
            return context;
        },

        onBeforeJobDispatched: function(search) {
            search.setRequiredFields(['*']);
        },

        getResultParams: function($super){
            var params,
                aggregate,
                aggregateSize,
                searchJob = this.getContext().get('search').job; 

            params = $super();
            params.sid = searchJob.getSID();
            if (searchJob.isDone()) {
                params.entity_name = 'results';
            } else {
                params.entity_name = 'results_preview';
            }

            if(this.itemName !== undefined && this.itemName !== null
                && this.metricName !== undefined && this.metricName !== null
                && this.groupName !== undefined && this.groupName !== null
            ){
                params.fields = JSON.stringify({
                    metricName: this.metricName,
                    groupName: this.groupName,
                    itemName: this.itemName
                });
            }

            aggregateSize = this.getParam("aggregateSize");
            aggregate = this.getParam("aggregate");

            params.aggregateSize = aggregateSize;
            params.aggregate = aggregate;

            return params;
        },

        onJobDone: function(){
            this.isJobDone = true;
            this.getResults();
        },

        onContextChange: function() {
            var context = this.getContext(),
                newSearch = context.get('search'),
                newBaseSearch = newSearch.getBaseSearch(),
                newJob = newSearch.job;

            if (newSearch.isJobDispatched() && !newJob.isDone()) {
                newJob.setPreviewable(true);
            }

            if (this.currentSearch !== newBaseSearch){
                this.currentSearch = newBaseSearch;
                this._reset();
            } else {
                this.currentSearch = newBaseSearch;
            }

            return;
        },

        onHostClick: function(e) {
            this.setClicked(true);
            this.setClickedValue(d3.select(e.target).data()[0].name);
            this.pushContextToChildren();
        }, 

        renderResults: function(data){
            this.hideLoadingIndicator();
            if (data === undefined || data === null || data.error) {
                this.showNoResultsMessage();
            } else {
                this.hideNoResultsMessage();
                this.update(data);
            }
        },

        /*
        note that this function is throttled, see initialize
        */
        _update: function(newData){
            if(newData !== undefined && newData['groupedConverted'] !== undefined && newData['groupedConverted'].length){
                var context = this.getContext(),
                    self = this;

                if(this.isFirstPlot){
                    this.data = newData.groupedConverted;
                    this.spiderPlot.plot(this.data, this.min, this.max);

                    this.isFirstPlot = false;
                    $('g.hostGroup', this.container).bind('click', this.onHostClick.bind(this));
                } else {
                    // NOTE: test to see if the chart does actually move
                    // newData['groupedConverted'][0]['data'][0].metric = Math.random() * 100;
                    this.spiderPlot.update(newData['groupedConverted']);
                }
            }
        }

    });

})(UnixjQuery, UnixUnderscore);

