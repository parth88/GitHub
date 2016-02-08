Splunk.Module.Unix_Crossfilter = $.klass(Splunk.Module.DispatchingModule, {

    initialize: function($super, container) {
        $super(container);
        this.data = null;
        this.namespace = this.getParam('namespace');

        this.container.bind('update', notifykids);

        function notifykids(e) {
            var type = e.type;
            $('[data-' + type + ']').each(function() {
                $(this).triggerHandler("cf." + type);
            });
            e.stopPropagation();
        }
    },

    getModifiedContext: function() {
        var context = this.getContext();

        if (this.data !== null && this.data !== undefined) {
            context.set(this.namespace, this.data);
            context.set(this.namespace + '_controller', this.moduleId);
        }

        return context;
    },

    onContextChange: function() {
        this._data = this.data;
        this.data = null;
    },

    onJobDone: function() {
        this.getResults();
    },

    getResultParams: function($super) {
        var params = $super(),
            context = this.getContext(),
            search = context.get('search'),
            post_process = search.getPostProcess();

        if (post_process) params.post_process = post_process;
 
        params.sid = search.job.getSearchId();
        return params;
    },

    renderResults: function(response) {
        var data;
        if (response !== undefined && response !== null && response.results) {
            response.results.forEach(function(d, i) {
                d.date = new Date(Number(d.trigger_time)*1000);
            });

            if (this._data !== undefined)
                delete this._data;

            this.data = crossfilter(response.results);
            this.data.data = response.results;
            this.pushContextToChildren();
        }
    }

});
