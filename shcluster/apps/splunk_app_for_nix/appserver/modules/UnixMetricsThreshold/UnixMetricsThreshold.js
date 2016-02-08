(function($, _$, _){

Splunk.Module.UnixMetricsThreshold = $.klass(Splunk.Module.UnixBaseAbstractFactoryFactory, {
    initialize: function($super, container) {
        var self = this;
        $super(container);
        this.data = null;
        this.token = this.getParam('token');
        this.$svg = d3.select(this.container.find('svg')[0]);
        this.width = Number(this.getParam('width'));
        this.height = Number(this.getParam('height'));

        this.grad = new Grad(this.$svg, this.moduleId + '-bg', 'leftToRight');


        function update(newData){
            self.updateData.call(self, newData);
        }

        this.thresholdPicker = new Color({
            svg: this.$svg,
            grad: this.grad,
            range: [0,100],
            // defaultColors: ["#ff5405", "#ffb76b"], 
            moduleId: this.moduleId,
            position: {
                width: this.width-40,
                height: this.height-15,
                paddingTop: 15,
                paddingLeft: 20
            },
            remoteStorageFactory: this.remoteStorageFactory(),
            onSave: update,
            onLoad: update
        });
        
    },

    updateData: function(newData){
        this.thresholdData = newData;
        this.pushContextToChildren();
        
    },

    resetThreshold: function() {
        
    },

    /*
     * override
     * insert selected values into our given token and namespace
     */
    getModifiedContext: function() {
        var context = this.getContext(),
            newContextData = context.get(this.namespace) || {};

        context.set(this.token, this.thresholdData);
        return context;
    },

    /*
     * override
     * grab any selected values from the context 
     */
    onContextChange: function() {
        var context = this.getContext(),
            namespace = context.get(this.namespace) || {},
            selected = namespace[this.token] || null;
    
    }

});

})(UnixjQuery, $, UnixUnderscore)

