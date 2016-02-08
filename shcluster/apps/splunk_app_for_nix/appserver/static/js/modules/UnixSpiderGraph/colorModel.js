(function($, _){

window.ColorModel = function(data, moduleId, storage){
    var current,
        self = this,
        colorRouter,ColorRouter;

    ColorRouter = Backbone.Router.extend({
        routes: {
            '/:param':"q",
        },

        q: function(query, params) {
            // splunk has functions for decoding the query string
            // and encoding
            // Splunk.util.queryStringToProp(Splunk.util.getHash())
        } 
    });

    colorRouter = new ColorRouter();
    // We can only start the history once, or it will throw an exception
    if(Backbone.history.started === undefined){
        Backbone.history.start({pushState: true});
        Backbone.history.started = true;    
    }

    this.current = {};
    this._current = {};
    this.data = [];

    function buildIndex(){
        _.each(self.data, function(swatch,i){
            swatch._i = i;
        });
    }

    function _load(cb){
        self.data = [];

        storage.load(function(newData){
            if (newData === undefined) {
                return false; 
            }

            _.each(newData, function(data, i){
                cb(data);
            });

            /*
            This addresses a bug in Firefox (at least Firefox 23)
            If we touch the URL history during SVG DOM operations (as are expected to occur during load callbacks)
            then none of the clipping paths work. Weird! See JIRA NIX-370
            */
            
            // window.setTimeout(function(){
            //     relativeNav(newQuery);
            // }, 200);
        });

        // self.reset();
    };

    /*
    add
    Adds data to the model.
    */
    this.add = function(swatchData){
        this.data.push(swatchData);
        this._current = swatchData;

        /*
            in order to keep track of the last-added element, we store a reference
            within this._current
            This value is swapped in whenever we need to reference the latest element.
            We cannot simply reference the last array value of this.data[] because
            that list is sorted. We would likely get the wrong element if we just 
            picked the last.
        */

        // why sort 1 item?
        if(this.data.length > 1){
            this.data = _.sortBy(this.data, 'y');
        }
        buildIndex();
    };

    this.remove = function(swatchData){
        removeFromArray(this.data, swatchData._i);
        buildIndex();
        this.save();
    };

    this.setCurrent = function(currentData){
        self.current = currentData;
    };

    this.setToLatest = function(){
        self.setCurrent(this._current);
    };

    this.updateCurrent = function(newData){
        $.extend(this.current, newData);
    };

    /*
        save
        data is optional, otherwise just uses internal data
    */
    function save(data){
        var saveable = [];
        if(data === undefined){
            data = self.data;
        }

        /*
        Some of the stuff in data[] is not governed by the model, so we remove that before saving.
        See the notes on this.load() for more information
        */
        _.each(data, function(v, k){
            saveable.push(
                _.pick(v, ['color', 'y'])
            );
        });

        storage.save(saveable);
    }

    this.save = _.debounce(save, 1000);

    /*
    load
    the decorator function allows the consumer to add whatever extra data they
    want to the items.

    While saving, the model will ignore /any/ property that isnt 'color' or 'y'
    This frees up a consumer to add any other properties they want, via the decorator.
    However, anything added there is not subject to any logic in the model.
    Anything that isn't 'y' or 'color' is not considered this model's responsibility.

    The decorator can also just act as an ordinary callback.
    */
    this.load = function(decorator){
        var self = this;
        _load.call(this, function(item){
            if(decorator === undefined){
                self.add(item);
            } else {
                self.add(decorator(item.color, item.y));
            }
        });
    };

    this.reset = function(){
        localStorage.spiderGraph = "[]";
        this.data = [];
        this._current = {};
        this.save();
    };
};

})(UnixjQuery, UnixUnderscore);
