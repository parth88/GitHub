(function($, _){
Splunk.Module.UnixBaseAbstractFactoryFactory = $.klass(Splunk.Module, {
    initialize: function($super, container){
        $super(container);
        var self = this;
        
        this.$container = this.container;

        this._width = this.getParam('width');
        if(this._width === null || this._width === undefined){
            this._width = this.$container.width();
        } else {
            this._width = Number(this._width);
        }

        this._height = this.getParam('height');
        if(this._height === null || this._height === undefined){
            this._height = this.$container.height();
        } else {
            this._height = Number(this._height);
        }

        if(this._height < this._width){
            this._smallerDim = this._height;
        } else {
            this._smallerDim = this._width;
        }
        
        // this is used to save state while the spinner may be loading
        // calls for the spinner are made during loading, we must defer them until the spinner is ready
        this.spinIsOn = false;
        this.$spinEl = this.$container;

        $script(Splunk.util.make_url('/static/app/splunk_app_for_nix/js/contrib/backbone-unix.js'), 'backbone');
        this.setupSpinner();
    },

    truncateStr: function(str, maxChars, chopInMiddle){
        var strlen = str.length,
            newStr,
            half;
        if(strlen < maxChars) {
            return str;
        } else {
            if(chopInMiddle){
                half = maxChars / 2;
                newStr = str.slice(0, half-1) + '...' + str.slice(strlen-half+2, strlen);
                return newStr;
            } else {
                newStr = str.slice(0, maxChars-3) + '...';
                return newStr;
            }
        }
    },

    searchChanged: function(oldSearch, newSearch){
        if(oldSearch === null){
            return true;
        } else {
            if(newSearch._baseSearch !== oldSearch._baseSearch){
                return true;
            }
            if(!_.isEqual(newSearch._range._relativeArgs, oldSearch._range._relativeArgs)){
                return true;
            }
            if(!_.isEqual(newSearch._range._absoluteArgs, oldSearch._range._absoluteArgs)){
                return true;
            }
            return false;
        }
    },

    setupSpinner: function(){
        if(this.spinIsOn){
            this.showLoadingIndicator();
        } else {
            this.hideLoadingIndicator();
        }
    },

    showLoadingIndicator: function($el){
        this.spinIsOn = true;
        if($el !== undefined){
            this.$spinEl = $el;
        }

        this.$spinEl.addClass('UnixBaseAbstractFactoryFactory-spin');
    },

    hideLoadingIndicator: function(){
        this.spinIsOn = false;
        this.$spinEl.removeClass('UnixBaseAbstractFactoryFactory-spin');
    },

    /*
    Handles saving/loading per-module state in the URL

    Note that this is designed to be instantiated with 'new'
    and not used directly.
    */

    URLStorage: function(name, moduleId, moduleType, secondaryToken){
        var Router,
            router,
            id;

        Router = Backbone.Router.extend({
            routes: {
                '/:param':"q",
            },

            q: function(query, params) {
            }
        });
        router = new Router();
        if(Backbone.history.started === undefined){
            Backbone.history.start({pushState: true});
            Backbone.history.started = true;
        }

        id = Splunk.util.getCurrentApp() + ':' + Splunk.util.getCurrentView() + ':' + moduleId;

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
                newQuery;
            if(!current){
                current = {};
            }
            current[id] = JSON.stringify(data);
            newQuery = Splunk.util.propToQueryString(current);
            return newQuery;
        }

        function relativeNav(query){
            if(query[0] !== '?'){
                query = '?'+query;
            }
            router.navigate(window.location.pathname+query, {trigger: true, replace:true});
        }

        function save(data){
            var newQuery = checkAndReplaceExisting(data);
            window.setTimeout(function(){
                relativeNav(newQuery);
            }, 200);
        }

        /*
         * Interface
         **********************/
        this.save = _.throttle(save, 500);

        this.load = function(){
            var data = parseQueryString();
            // data = data[id];
            if(secondaryToken !== undefined && data[secondaryToken] !== undefined){
                data = data[secondaryToken];
            } else {
                data = data[id];
            }

            if(data !== undefined){
                try {
                    data = JSON.parse(data);
                } catch(e) {
                }
            } else {
                data = {};
            }
            return data;
        };
    },

    Storage: function(urlStorage, remoteStorage){
        this.load = function(onLoadCb){
            var self = this,
                data;

            data = urlStorage.load();
            if(data !== undefined && data.length > 0){
                data = JSON.parse(data);
                if(data.length !== undefined && data.length > 0){
                    onLoadCb(data);
                } else {
                    return false;
                }
                
            } else {
                remoteStorage.load(function(json){
                    if(json !== undefined){
                        data = JSON.parse(json);
                        if(data.length !== undefined && data.length > 0){
                            onLoadCb(data);
                            // the URL should always reflect the latest data
                            // if we are on this branch, we know the URL 
                            // is out of date
                            urlStorage.save(json);
                        } else {
                            return false;
                        }
                    }
                });
            }
        };

        function save(data){
            var json = JSON.stringify(data);
            remoteStorage.save(json);
            urlStorage.save(json);
        }

        this.save = _.throttle(save, 500)
    },

    storageFactory: function(name, secondaryToken){
        var urlStorage,
            remoteStorage;

        urlStorage = new this.URLStorage(name, this.moduleId, this.moduleType, secondaryToken);
        remoteStorage = new this.RemoteStorage(name, this.moduleId, false, this.moduleType); 

        return new this.Storage(urlStorage, remoteStorage);
    },

    // This closure wrapper is neccesary when we wish to use RemoteStorage
    // with other classes that don't inherit from the unix base class
    // we simply need to save the this.moduleId and this.moduleType
    // so we don't have to pass those values down
    remoteStorageFactory: function(){
        var self = this;
        return function(name, allowMultiple){
            return new self.RemoteStorage(name, self.moduleId, allowMultiple, self.moduleType);
        }
    },

    // This is designed to be instantiated with 'new'
    // and NOT used on its own. 
    // RemoteStorage handles storing data 
    RemoteStorage: function(name, moduleId, allowMultiple, moduleType){
        var app = Splunk.util.getCurrentApp(),
            conf_name = 'nix_view_prefs',
            currentRequest = null,
            form_key = Splunk.util.getConfigValue('FORM_KEY'),
            id = moduleId,
            setup_url = getSetupUrl(),
            url = getUrl(),
            ready = false,
            self = this,
            view = Splunk.util.getCurrentView();

        function getUrl() {
            return Splunk.util.make_url(['splunkd', '__raw', 'servicesNS', Splunk.util.getConfigValue('USERNAME'), app, 'configs', 'conf-'+conf_name, Splunk.util.getCurrentView()+'?output_mode=json'].join('/'));
        }

        function getSetupUrl() {
            return Splunk.util.make_url(['splunkd', '__raw', 'servicesNS', Splunk.util.getConfigValue('USERNAME'), app, 'configs', 'conf-'+conf_name].join('/'));
        }

        function checkIfExists(){
            var exists;
            $.ajax({
                type: 'GET',
                async: false,
                url: url,
                success: function(data, textStatus, xhr) {
                    exists = true;
                },
                error: function(err){
                    exists = false;
                }
            });
            return exists;
        }

        function setup(){
            var data = {'name': Splunk.util.getCurrentView(), 'default': {}};
              
            $.ajax({
                type: 'POST',
                data: data,
                url: setup_url,
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Splunk-Module', moduleType);
                    xhr.setRequestHeader('X-Splunk-Form-Key', form_key);
                },
                success: function(data, textStatus, xhr) {
                    ready = true;
                },
                error: function(err){
                    console.error("error, cant make prefs config:", err);
                }
            });
        }
        
        function error(resp){
            console.error('error', resp);
        }

        function success(resp){
            return;
        }

        if (checkIfExists() === false) {
            setup();
        }

        this._save = function(data){
            var existing_data = {};

            if(currentRequest !== null){
                currentRequest.abort();
            }

            // async call to make sure we preserve old prefs
            self.load(function(old_data) {
                if (old_data !== null && old_data !== undefined) {
                    existing_data = JSON.parse(old_data);
                }
            }, true);

            existing_data[id] = data;

            currentRequest = $.ajax({
                type: 'POST',
                data: existing_data,
                url: url,
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Splunk-Module', moduleType);
                    xhr.setRequestHeader('X-Splunk-Form-Key', form_key);
                },
                success: function(data, textStatus, xhr) {
                    if (xhr.status===0) {
                        return;
                    }
                    success.call(this, data);
                },
                error: error.bind(this)
            });
        };
        
        this.save = _.debounce(this._save, 300);

        this.load = function(cb, is_async){
            if (is_async === undefined || is_async !== false) {
                is_async = true;
            }
            $.ajax({
                type: 'GET',
                url: url,
                async: is_async,
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Splunk-Module', moduleType);
                },
                success: function(data, textStatus, xhr) {
                    cb.call(this, data.entry[0].content[id]);
                },
                error: error.bind(this)
            });
        };

        this.delete = function(cb){
            $.ajax({
                type: 'DELETE',
                url: url,
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Splunk-Module', moduleType);
                    xhr.setRequestHeader('X-Splunk-Form-Key', Splunk.util.getConfigValue('FORM_KEY'));
                },
                success: function(data, textStatus, xhr) {
                    cb.call(this, true);
                },
                error: function() {
                    cb.call(this, false);
                }
            });
        };
    }

});

})(UnixjQuery, UnixUnderscore);
