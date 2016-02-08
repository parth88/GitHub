require.config({
    baseUrl: '/static',
    preserveLicenseComments: false,
    paths: {
        // paths outside of baseUrl
        'modules': '/modules',
        'domReady': '/static/app/splunk_app_for_nix/js/contrib/domReady', 

        // jQuery and contrib plugins
        'jquery': '/static/app/splunk_app_for_nix/js/contrib/jquery/jquery.min',
        'jquery.iframe.auto.height': '/static/app/splunk_app_for_nix/js/contrib/jquery/jquery.iframe-auto-height',
        'jquery-multiselect': '/static/app/splunk_app_for_nix/js/contrib/jquery-ui/jquery.multiselect',
        'jquery-multiselect-filter': '/static/app/splunk_app_for_nix/js/contrib/jquery-ui/jquery.multiselect.filter',
        'jquery.history': 'js/contrib/jquery.history',
        'jquery.bgiframe': 'js/contrib/jquery.bgiframe.min',
        'jquery.cookie': 'js/contrib/jquery.cookie',


        // jQuery UI plugins
        'jquery.ui.core': '/static/app/splunk_app_for_nix/js/contrib/jquery-ui/jquery-ui-1.9.2.custom',

        // other contrib libraries
        'underscore': '/static/app/splunk_app_for_nix/js/contrib/underscore',
        'backbone': '/static/app/splunk_app_for_nix/js/contrib/backbone/backbone',
        'highcharts': 'js/contrib/highcharts',
        'json': 'js/contrib/json2',

        /* augments builtin prototype */
        'strftime': 'js/contrib/strftime',
        'lowpro': 'js/contrib/lowpro_for_jquery',
        'spin': '/static/app/splunk_app_for_nix/js/contrib/spin',

        // Splunk legacy
        'splunk': 'js/splunk',
        'splunk.init': 'js/init',
        'splunk.legend': 'js/legend',
        'splunk.logger': 'js/logger',
        'splunk.util': 'js/util',
        'splunk.pdf': 'js/pdf',
        'splunk.i18n': 'js/i18n',
        'splunk.paginator': 'js/paginator',
        'splunk.messenger': 'js/messenger',
        'splunk.menu_builder': 'js/menu_builder',
        'splunk.time': 'js/splunk_time',
        'splunk.timerange': 'js/time_range',
        'splunk.window': 'js/window',
        'splunk.jabridge': 'js/ja_bridge'
    },
    shim: {

        /* START contrib jQuery plugins */
        'jquery.cookie': {
            deps: ['jquery']
        },
        'jquery.history': {
            deps: ['jquery'],
                exports: 'History'
        },
        'jquery.bgiframe': {
            deps: ['jquery']
        },

        "jquery.attributes": {
            deps: ['jquery']
        },
        "spin": {
            deps: ['jquery'],
            exports: 'Spinner'
        },

        "jquery.sparkline": {
            deps: ['jquery']
        },

        "jquery.deparam": {
            deps: ['jquery']
        },

        /* jQuery UI plugins */
        'jquery.ui.core': {
            deps: ['jquery']
        },

        'jquery.multiselect': {
            deps: ['jquery']
        },
        'jquery.multiselect.filter': {
            deps: ['jquery', 'jquery.multiselect']
        },
        underscore: {
            deps: ['splunk.i18n'],
            exports: '_',
            init: function(i18n) {
                // use underscore's mixin functionality to add the ability to localize a string
                this._.mixin({
                    t: function(string) {
                        return i18n._(string);
                    }
                });
                // can't put underscore in no conflict mode here because Backbone needs to find it on the global scope
                return this._;
            }
        },
        backbone: {
            deps: ['jquery', 'underscore'],
            exports: 'Backbone',
            init: function($, _) {
                // now that Backbone has a reference to underscore, we need to give the '_' back to i18n
                _.noConflict();

                // inject a reference to jquery in case we ever run it in no conflict mode
                // set up for forward compatibility with Backbone, setDomLibrary is being replaced with Backbone.$
                if(this.Backbone.hasOwnProperty('setDomLibrary')) {
                    this.Backbone.setDomLibrary($);
                }
                else {
                    this.Backbone.$ = $;
                }
                return this.Backbone.noConflict();
            }
        },
        highcharts: {
            deps: ['jquery'],
            exports: 'Highcharts'
        },
        json: {
            exports: 'JSON'
        },

        lowpro: {
            deps: ['jquery']
        },

        /* Start Splunk legacy */
        splunk: {
            exports: 'Splunk'
        },
        'splunk.menu_builder': {
            deps: ['jquery', 'jquery.ui.core', 'jquery.bgiframe', 'lowpro', 'splunk.logger']
        },
        'splunk.util': {
            deps: ['jquery', 'splunk'],
            exports: 'Splunk.util',
            init: function($, Splunk, config) {
                return $.extend({ sprintf: this.sprintf }, Splunk.util);
            }
        },
        'splunk.legend': {
            deps: ['splunk'],
                exports: 'Splunk.Legend'
        },
        'splunk.logger': {
            deps: ['splunk', 'splunk.util'],
                exports: 'Splunk.Logger'
        },
        'splunk.pdf': {
            deps: ['splunk', 'splunk.util', 'jquery'],
            exports: 'Splunk.pdf'
        },
        strftime: {
            deps: []
        },
        'splunk.paginator': {
            deps: ['splunk'],
                exports: 'Splunk.paginator'
        },
        'splunk.jquery.csrf': {
            deps: ['jquery', 'jquery.cookie', 'splunk.util']
        },
        'splunk.messenger': {
            deps: ['splunk', 'splunk.util', 'splunk.logger', 'splunk.i18n', 'lowpro'],
            exports: 'Splunk.Messenger'
        },
        'splunk.timerange': {
            deps: ['splunk', 'splunk.util', 'splunk.logger', 'splunk.i18n', 'lowpro'],
            exports: 'Splunk.Timerange',
            init: function(Splunk) {
                Splunk.namespace("Globals");
                if (!Splunk.Globals.timeZone) {
                    Splunk.Globals.timeZone = new Splunk.TimeZone(Splunk.util.getConfigValue('SERVER_ZONEINFO'));
                }
                return Splunk.TimeRange;
            }
        },
        'splunk.window': {
            deps: ['splunk', 'splunk.util', 'splunk.i18n'],
            exports: 'Splunk.window'
        },
        'splunk.jabridge': {
            deps: ['splunk'],
            exports: 'Splunk.JABridge'
        },
        'splunk.init': {
            deps: ['splunk', 'splunk.i18n', 'splunk.util', 'lowpro']
        }
    }
});

