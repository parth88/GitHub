Splunk.Module.UnixAppBar = $.klass(Splunk.Module, {
    initialize: function($super, container) {
        $super(container);
        // TODO this may be overly aggressive but its better to do it sooner rather than later. 
        this.childEnforcement  = Splunk.Module.NEVER_ALLOW;
        this.parentEnforcement = Splunk.Module.NEVER_ALLOW;

        
        this.logger = Splunk.Logger.getLogger("Splunk.Module.AppBar");
        var menuData = [];
        var unitTestListing = [];
        try {
            menuData = this.parseNavConfig(this._params.menuData);
        } catch(e) {
            this.logger.error("Unable to parse JSON navConfig for appbar menu", e);
        }
        unitTestListing = this._params.unitTestListing;            
        this.unitTestMenu = null;
        this.mainMenus = [];
        this.generateMainMenus(menuData);
        this.generateUnitTestMenu(unitTestListing);
        this.bindEventListeners();
    },
    onViewDataChange: function(event, data){
        if(data.navConfig){
            try{
                var menuData = this.parseNavConfig(data.navConfig);
            }catch(e){
                this.logger.error("Unable to parse JSON navConfig for appbar menu", e);
                return;
            }
            this.removeMainMenus();
            this.generateMainMenus(menuData);
            this.logger.info("onViewDataChange fired, successfully reloaded main menu data in AppBar");
        }
    },
    removeMainMenus: function(){
        for(var i=0; i<this.mainMenus.length; i++){
            try{
                this.mainMenus[i].removeMenu();
            }catch(e){
                this.logger.error("Could not remove mainMenus item with an index of", i);
            }
        }
        this.mainMenus = [];
    },
    /**
     * Recursive method to transpose the navigation data structure coming from
     * the app nav XML definition into the format expected by the JS menu builder
     * class.
     *  
     * SAMPLE INPUT:

     * [{'label': 'Dashboards',
     *    'submenu': [{'label': 'Google', 'uri': 'http://google.com'}]},
     *   {'label': 'Views',
     *    'submenu': [{'label': 'All Views',
     *                 'submenu': [{'label': 'flashtimeline',
     *                              'uri': 'view/flashtimeline'},
     *                             {'label': 'super_link_list',
     *                              'uri': 'view/super_link_list'}]},
     *                {'label': 'flashtimeline', 'uri': 'view/flashtimeline'},
     *                {'label': 'super_link_list', 'uri': 'view/super_link_list'},
     *                {'label': 'report_builder_define_data',
     *                 'uri': 'view/report_builder_define_data'}]},
     *   {'label': 'Saved Searches',
     *    'submenu': [{'label': 'Recent Searches',
     *                 'submenu': [{'label': None, 'uri': 'saved/'}]},
     *                {'label': 'All firewall errors',
     *                 'uri': 'saved/All firewall errors',
     *                 'sharing': 'user'},
     *                {'label': '------', 'uri': '#', 'sharing': 'app'}]}]
     *
     * SAMPLE OUTPUT:
     *
     *  [{'items': [{'label': 'Google', 'uri': 'http://google.com'}],
     *    'label': 'Dashboards'},
     *   {'items': [{'items': [{'label': 'flashtimeline',
     *                          'uri': 'view/flashtimeline'},
     *                         {'label': 'super_link_list',
     *                          'uri': 'view/super_link_list'}],
     *               'label': 'All Views',
     *               'menuType': 'grouping'},
     *              {'label': 'flashtimeline', 'uri': 'view/flashtimeline'},
     *              {'label': 'super_link_list', 'uri': 'view/super_link_list'},
     *              {'label': 'report_builder_format_report',
     *               'uri': 'view/report_builder_format_report'}],
     *    'label': 'Views'},
     *   {'items': [{'items': [{'label': None, 'uri': 'saved/'}],
     *               'label': 'Recent Searches',
     *               'menuType': 'grouping'},
     *              {'label': 'All firewall errors',
     *               'uri': 'saved/All firewall errors',
     *               'style': 'splUserCreated'},
     *              {'label': '------', 'uri': '#'}],
     *    'label': 'Saved Searches'}]
     */
    transposeMenuData: function(menu, viewLabel, options){
        var output = [];
        options = options || {};
        isTop = (options.hasOwnProperty("isTop"))?options.isTop:false;
        isActive = (options.hasOwnProperty("isActive"))?options.isActive:false;
        for(var i=0; i<menu.length; i++){
            var menuEntry = menu[i];
            var replacement = {};
            
            if(menuEntry.hasOwnProperty("submenu")){
                var transpose = this.transposeMenuData(menuEntry.submenu, viewLabel, {isActive:isActive});
                var subnode = transpose.output;
                var isActive = transpose.isActive;
                replacement["items"] = subnode;
                replacement["label"] = (menuEntry.hasOwnProperty("label"))?menuEntry.label:"";
            
            } else {
                if(viewLabel==menuEntry.label){
                    isActive = true;
                }

                replacement = menuEntry;

                // add class to menu item for private items; possible 'sharing'
                // values are 'user', 'app', 'system', 'global'.  see eai:acl
                if (menuEntry['sharing'] == 'user') {
                    replacement['style'] = 'splUserCreated';
                }
            }
            
            if(isTop && isActive){
                replacement["isActive"] = true;
            }
            output.push(replacement);
        }
        return {output:output, isActive:isActive};
    },
    
    
    /**
     * load the submenu data into a map to allow the menu builder to reference
     * the data by the offset-based DOM ID
     */
    parseNavConfig: function(navConfig){
        var transpose = this.transposeMenuData(navConfig, Splunk.util.getCurrentViewConfig().app.label, {isTop:true});
        var menuData = {};
        for(var i=0; i<transpose.output.length; i++){
            if(transpose.output[i].hasOwnProperty("items")){
                menuData["navmenu_" + i] = transpose.output[i].items;
            }else{
                continue;
            }
        }
        return menuData;
    },
    generateMainMenus: function(menuData){
        // setup the menu systems for all of the app menus
        for (var key in menuData) {
            if (menuData.hasOwnProperty(key)) {
                this.mainMenus.push(
                    new Splunk.MenuBuilder({
                        containerDiv: this.container,
                        menuDict: menuData[key],
                        activator: $('#' + key),
                        menuClasses: 'splMenu-primary ' + key
                    })
                );
            }
        }
    },
    generateUnitTestMenu: function(menuData){
        // TODO: debug    
        this.unitTestMenu = new Splunk.MenuBuilder({
            containerDiv: this.container,
            menuDict: menuData,
            activator: $('#appBarUnitTests'),
            menuClasses: 'splMenu-primary'
        });
    },
    bindEventListeners: function(){
        // because minification can be on or off, may be doubly-bound
        $('a.aboutLink').unbind('click');

        $('a.aboutLink').click(function(event) {
            Splunk.Popup.AboutPopup($('.aboutPopupContainer'));
        });

        
        /** moved Print link into the Actions menu
         * Print the page.
        $('a.printLink').click(function(event) {
            $(document).trigger("PrintPage");
            return false;
        });        
         */

        /**
         * Show the About popup
         */
        /*
        $('a.aboutLink').click(function(event) {
        var aboutPopup = new Splunk.Popup($('.aboutPopupContainer'), {
        title: _('About Splunk'),
        buttons: [
            {
            label: _('Done'),
            type: 'primary',
            callback: function(){
                return true;
            }.bind(this)
            }
        ]
        });
        return false;
    });        
        */
        
    }

    
});



