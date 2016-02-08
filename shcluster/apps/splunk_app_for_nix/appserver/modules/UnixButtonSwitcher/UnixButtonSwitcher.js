Splunk.Module.UnixButtonSwitcher = $.klass(Splunk.Module.ButtonSwitcher, {
   // override pushContextToChildren to avoid ButtonSwitcher from pushing empty context
   // with every view mode click. This way it won't cause a redispatch of active
   // HiddenSearch child and associated view refresh for no reason.
   initialize: function($super, container) {
       $super(container);
       var base = new Splunk.Module.UnixBaseAbstractFactoryFactory;
       this.storage = new base.RemoteStorage('Splunk.Module.UnixButtonSwitcher', this.moduleId, false, this.moduleType);
       this.urlStorage = new base.URLStorage('Splunk.Module.UnixButtonSwitcher', this.moduleId, false, this.moduleType);
   },

   onLoadStatusChange: function($super,statusInt) {
       if (!this.isPageLoadComplete() && statusInt >= Splunk.util.moduleLoadStates.WAITING_FOR_CONTEXT) { 
           this.setFromStorage();
           $super(statusInt);
       }
   },
   setActiveChild: function($super, childIndex) {
       $super(childIndex);
       this._params["selected"] = this._titles[childIndex];
       this.saveToStorage();
   },

   /*
    * attempt to get selected from storage
    * 1) URL storage
    * 2) User-Prefs
    * 3) Default selected
    */
   setFromStorage: function() {
       var self = this,
           clicked,
           data,
           idx;

       data = this.urlStorage.load();

       if(data !== undefined && data.length > 0){
           data = JSON.parse(data);
           if(data !== undefined && data['clicked'] !== undefined) {
               clicked = data['clicked'];
               self.container.find('a.'+clicked).click();
           }
       } else {
           this.storage.load(function(newData){
               if(newData !== undefined){
                   newData = JSON.parse(newData);
                   if (newData !== undefined && newData['clicked'] !== undefined) {
                       clicked = newData['clicked'];
                       self.container.find('a.'+clicked).click();
                       self.setSelected(clicked);
                   }
               }
           });
       }
   },
 
   setSelected: function(val) {
       this._params['selected'] = val;
   },

   /*
    * Save node size to remote storage
    */
   saveToStorage: function(){
       var self = this,
           settings = {},
           data;
       settings['clicked'] = this._params["selected"];
       data = JSON.stringify(settings);
       this.storage.save(data);
       this.urlStorage.save(data);
   },

   pushContextToChildren: function(explicitContext) {
       var readiness = this.isReadyForContextPush();
       if (readiness == Splunk.Module.CANCEL) {
           if (!this.isPageLoadComplete()) {

               var propagateLoadCompleteFlag = function(module) {
                   module.markPageLoadComplete();
                   module.withEachChild(function(child) {
                       propagateLoadCompleteFlag(child);
                   });
               };
               propagateLoadCompleteFlag(this);
           }
           return;

       } else if (readiness == Splunk.Module.DEFER) {
           this.pushContextWhenReady = true;
           return;

       } else if (readiness == Splunk.Module.CONTINUE){
           if (this.pushContextWhenReady) {
               this.pushContextWhenReady = false;
           }

       } else {
           this.logger.error(this.moduleType + " returned illegal value from isReadyForContextPush");
       }

       this.ensureFreshContexts();

       var childContext = explicitContext || this.getModifiedContext();

       if (childContext == null || !childContext.has("search")) {
           return;
       } else if (this.getLoadState() < Splunk.util.moduleLoadStates.HAS_CONTEXT) {
           return;
       }

       this.withEachDescendant(function(module) {
           module.setLoadState(Splunk.util.moduleLoadStates.WAITING_FOR_CONTEXT);
       });

       var search = childContext.get("search");

       var currentContext = this.getContext();
       if(currentContext.has('from_history') && Splunk.util.normalizeBoolean(currentContext.get('from_history'))) {
           currentContext.set('from_history', "0");
           this.baseContext = currentContext;
       }


       /****************************************
           This is where OVERRIDE starts:
       *****************************************/

       // abandon all children's current jobs
       this.withEachChild(function(child) {
           var context = child.getModifiedContext();
           if (context) {
               var search = context.get("search");
               if (search.job.getSearchId()) {
                   search.job.cancel(function() {
                       console.debug('Handle successful job cancellation.');
                   }, function() {
                       console.debug('Handle failure to cancel job.');
                   });
               }
               search.abandonJob();
           }
       });

       var selectedChild = this._children[this._activeChildIndex];

       if (selectedChild.requiresDispatch(search)) {
           search.abandonJob();
           this._fireDispatch(search);
           return;
       }

       if (selectedChild) {
           var child = selectedChild,
               context = this.baseContext;

           child.setLoadState(Splunk.util.moduleLoadStates.HAS_CONTEXT);
           child.baseContext = context.clone();
           child.onContextChange();
           child.ensureFreshContexts();
           child.pushContextToChildren();
           if (!child.isPageLoadComplete()) {
               child.markPageLoadComplete();
           }
       }

       this.setChildContextFreshness(true);
   }

});
