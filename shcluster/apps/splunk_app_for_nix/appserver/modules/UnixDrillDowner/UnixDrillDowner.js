/*
Redirects to a given view. Uses context to populate URL query string.
*/

(function(_){
  Splunk.Module.UnixDrillDowner = $.klass(Splunk.Module, {

      initialize: function($super, container) {
          $super(container);
          this.hide('HIDDEN MODULE KEY');
          this.field_list = this.parseFields(this.getParam('fields'));
          this.viewTarget = this.getParam('viewTarget');
          this.drillToChart = this.getParam('drillToChart'); 
          this.namespace = this.getParam('namespace');
      },

      /*
       * on context change, try to populate query string from context
       * redirect regardless of presence of query string
       */
      onContextChange: function() {
          var context = this.getContext(),
              click = context.get('click'),
              legacy_click = this.getLegacyClick(context),
              form = context.get('form') || null,
              link = this.viewTarget,
              search = context.get('search'),
              // grab everything from charting.drilldown. Avoids namespace
              // collisions when drilling from a formated chart
              charting = context.getAll('charting.drilldown') || null, 
              time_range = search.getTimeRange(),
              qsDict = {},
              self = this,
              json,
              i, key, val, namespaced;

          if (click !== null || legacy_click !== null) {
              if (time_range !== null && time_range !== undefined) {
                  if (time_range.getEarliestTimeTerms()) {
                      qsDict.earliest = time_range.getEarliestTimeTerms();
                  }
                  if (time_range.getLatestTimeTerms()) {
                      qsDict.latest = time_range.getLatestTimeTerms();
                  }
                  if (time_range.isAllTime()) {
                      qsDict.earliest = 0;
                  }
              }
   
              if (legacy_click !== null) {
                 for (i = 0; i < legacy_click.length; i++) {
                     if (legacy_click[i][1] !== null) {
                         qsDict['form.' + legacy_click[i][0]] = legacy_click[i][1]; 
                     }
                 } 
              }

              if (form !== null && typeof form === 'object') {
                  if (this.field_list !== null) {
                      for (i = 0; i < this.field_list.length; i++) {
                         if (form.hasOwnProperty(this.field_list[i])) {
                             val = form[this.field_list[i]];
                             if (typeof val === 'string' || typeof val === 'object') {
                                 qsDict['form.' + this.field_list[i]] = val; 
                             }
                         }
                      }
                  } else {
                      $.each(form, function(k, v){
                        if(_.isArray(v)){
                            json = JSON.stringify(v);
                            qsDict[k] = json; 
                        } else if (typeof v === 'string' || typeof v === 'object') {
                            qsDict[k] = v;
                        }
                      });
                  }
              } else {
                 // if we have a charting context (From HiddenChartFormatter)
                 // and we've passed the drill_to_chart option to the module
                 if (typeof charting === "object" &&
                   this.drill_to_chart !== undefined &&
                   this.drill_to_chart !== null) {
                      // looks like chart options in flashtimeline are
                      // prepended with c. namespace
                      $.each(charting, function(k,v){
                        qsDict["c." + k] = charting[k];
                      });
                 }  
                 qsDict.q = search.getBaseSearch();
             }

             link += '?' + this.propToQueryString(qsDict);
             this.drillDowner(link); 
          }

      },
   
      /*
       * helper to parse fields param or set to null if unparsable
       */  
      parseFields: function(fields) {
          var output = null;
          if (fields !== undefined && fields !== null) {
              output = fields.split(',');     
              if (typeof output !== 'object' 
                || output.hasOwnProperty('length') === false 
                || output.length < 1) {   
                  output = null;
              }
          } 
          return output;
      },

      /*
       * extension of Splunk.util.propToQueryString()
       * required since that one doesn't handle lists
       */ 
      propToQueryString: function(dictionary) {
          var o = [],
              i, val;

          $.each(dictionary, function(k,v){
            if ($.isArray(dictionary[k])) {
                for (i=0; i<dictionary[k].length; i++) {
                    o.push(encodeURIComponent(k) + '=' + encodeURIComponent(dictionary[k][i]));
                }
            } else {
                val = String(dictionary[k]);
                o.push(encodeURIComponent(k) + '=' + encodeURIComponent(dictionary[k]));
            }
          });
              
          return o.join('&');
      },

      getLegacyClick: function(context) {
          var click_name = context.get('click.name') || null,
              click_value = context.get('click.value') || null,
              click_name2 = context.get('click.value2') || null,
              click_value2 = context.get('click.value2') || null,
              ret = [];

          if (click_name === null && click_name2 === null) { 
              return null;
          } else {
              if (click_name !== null) {
                  ret.push([click_name, click_value]);
              }
              if (click_name2 !== null) {
                  ret.push([click_name2, click_value2]);
              }
              return ret;
          }
          return null;
      },

      /*
       * Redirects to the link in same or new window depending on whether ctrl is pressed
       */
      drillDowner: function(link) {
          if (link !== undefined && link !== null) {
              window.document.location = link;
          }
      }
  });
})(UnixUnderscore)