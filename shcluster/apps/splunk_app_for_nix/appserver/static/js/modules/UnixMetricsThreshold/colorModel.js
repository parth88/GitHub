(function($, _){

window.ColorModel = function(data, moduleId, remoteStorageFactory, mode){
    var current,
        self = this,
        colorRouter,ColorRouter,
        isFirstRun = true,
        modes = {'leftToRight': true, 'bottomUp': true},
        storage = remoteStorageFactory("Splunk.Module.UnixMetricsThreshold", moduleId);
        // storage = remoteStorageFactory("Splunk.Module.UnixSpiderGraph", moduleId);

    if(modes[mode] !== undefined){
        modes[mode] = true;
    } else {
        console.error('GRAD: Invalid Mode specified');
    }

    if(modes['leftToRight']){
        axis = 'x';
    } else {
        axis = 'y';
    }

    ColorRouter = Backbone.Router.extend({
        routes: {
            '/:param':"q",
        },

        q: function(query, params) {
            return;
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

    function relativeNav(query){
        if(query[0] !== '?'){
            query = '?'+query;
        }
        colorRouter.navigate(window.location.pathname+query, {trigger: true, replace:true});
    }

    function buildIndex(){
        _.each(self.data, function(swatch,i){
            swatch._i = i;
        });
    }

    function parseQueryString(){
        var queryBreak = window.location.href.indexOf('?');
        if(queryBreak > -1){
            var query = window.location.href.slice(queryBreak);
            return Splunk.util.queryStringToProp(query);
        } else {
            return false;
        }
    }

    function checkAndReplaceExisting(data){
        var current = parseQueryString(),
            json_data = JSON.stringify(data),
            newQuery;
        if(!current){
            current = {};
        }

        if (json_data !== undefined)
            current[storage.id] = JSON.stringify(data);

        newQuery = Splunk.util.propToQueryString(current);
        return newQuery;
    }

    function _load(cb, done){
        var loadFromStorage = false;
        self.data = [];
        /*
        On first run, if the query is available, we need to save it to storage
        this is because the user may have pasted a shared URL containing spidergraph colors

        It's also slightly faster to use the query param, since we dont have to make an AJAX request.
        */
        if(isFirstRun){
            var newData = parseQueryString();
            if(newData && newData[storage.id] !== undefined){
                newData = JSON.parse(newData[storage.id]);
                self.save(newData);

                _.each(newData, function(item, i){
                    cb(item);
                });

                if(done !== undefined){
                    done(newData);
                }

                isFirstRun = false;
            } else {
                loadFromStorage = true;
            }
        } else {
            loadFromStorage = true;
        }

        if(loadFromStorage){
            storage.load(function(newData){
                // TEMP: for testing
                // newData = [];

                if(newData === undefined || newData.length < 1){
                    // newData = [{
                    //     color: "#BBECFA",
                    //     y: 0.0
                    // }];
                } else {
                    newData = JSON.parse(newData);
                }

                _.each(newData, function(data, i){
                    cb(data);
                });

                var newQuery = checkAndReplaceExisting(newData);
                relativeNav(newQuery);

                if(done !== undefined){
                    done(newData);
                }

            });

        }

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
            this.data = _.sortBy(this.data, axis);
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
    this.save = function(data){
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
                _.pick(v, ['color', axis])
            );
        });

        newQuery = checkAndReplaceExisting(saveable);
        relativeNav(newQuery);
        storage.save(JSON.stringify(saveable));
        return saveable;
    };

    /*
    load
    the decorator function allows the consumer to add whatever extra data they
    want to the items.

    While saving, the model will ignore /any/ property that isnt 'color' or 'y'
    This frees up a consumer to add any other properties they want, via the decorator.
    However, anything added there is not subject to any logic in the model.
    Anything that isn't 'y' or 'color' is not considered this model's responsibility.
    */
    this.load = function(decorator, done){

        var self = this;
        _load.call(this, function(item){
            if(decorator === undefined){
                self.add(item);
            } else {
                self.add(decorator(item.color, item[axis]));
            }
        }, done);
    };

    this.reset = function(){
        localStorage.spiderGraph = "[]";
        this.data = [];
        this._current = {};
        this.save();
    };
};

})(UnixjQuery, UnixUnderscore);
