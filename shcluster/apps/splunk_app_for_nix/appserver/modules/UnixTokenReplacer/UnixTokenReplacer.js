/*
This module replaces search string tokens found in the format: $field$
The tokens are matched to keys found in the context.
EG:
"index=_internal $test$"
If the context had the key/val pair - "test":123
We would get then get - "index=_internal test=123"
*/

(function($) {

// extend core jquery 1.6 with basic utility
$.extend({
    isNumeric: function( obj ) {
        return !isNaN( parseFloat(obj) ) && isFinite( obj );
    }
});

Splunk.Module.UnixTokenReplacer = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);
        this.hide('HIDDEN MODULE KEY');
        this.namespace = this.getParam('namespace');
    },

    parseRangeObject: function(token, currReplacement){
        var newStr = '( ';

        $.each(currReplacement.val, function(i, val){
            // we only want to place these between statements
            if(i > 0 && i < currReplacement.val.length){
                newStr = newStr + " AND ";
            }

            newStr = newStr + token + currReplacement.comparator[i] + val;
        });

        newStr = newStr + ' )';

        return newStr;
    },

    parseObject: function(token, currReplacement){
        return this.parseString(token, currReplacement.val, currReplacement.comparator);
    },

    parseString: function(token, currReplacement, comparator){
        var val = currReplacement,
            newStr,
            j;

        comparator = comparator || "=";
        newStr = token + comparator;

        if (currReplacement === null) {
            newStr = ''; 
        } else if ($.isArray(val)) {
            newStr = '( ' + newStr;
            for (j=0; j < val.length; j++) {
                newStr += ($.isNumeric(val[j])) ? val[j] : '"' + val[j] + '"';
                if (val.length !== (j + 1)) {
                    newStr += ' OR ' + token + comparator;
                }
            } 
            newStr += ' )';
        } else if ($.isNumeric(val)) {
            newStr +=  val;
        } else {
            newStr +=  '"' + val + '"';
        }
        return newStr;
    },

    getModifiedContext: function($super) {
        var context = this.getContext(),
            form = context.get(this.namespace),
            search = context.get('search'),
            new_search = search.toString(),
            searchTokens = Splunk.util.discoverReplacementTokens(new_search),
            token,
            type,
            comparator = '=',
            currReplacement,
            val,
            j,
            i,
            newStr;
            
        if (form !== null && form !== undefined && searchTokens.length > 0) {
            for (i=0; i < searchTokens.length; i++) {
                currReplacement = form[searchTokens[i]];
                if (currReplacement !== undefined) {
                    token = new RegExp("\\$" + searchTokens[i] + "\\$");
                    /*
                    Any new parsing strategy should be added here
                    Don't define new parsing inline - use another function
                    */
                    type = typeof currReplacement;
                    if(type.toLowerCase() === 'string' || $.isArray(currReplacement)){
                        newStr = this.parseString(searchTokens[i], currReplacement);
                    } else if (currReplacement === null) {
                        newStr = this.parseString(searchTokens[i], '*');
                    } else {
                        if($.isArray(currReplacement.val)){
                            newStr = this.parseRangeObject(searchTokens[i], currReplacement);
                        } else {
                            newStr = this.parseObject(searchTokens[i], currReplacement);
                        }
                    }

                    new_search = Splunk.util.replaceTokens(new_search, token, newStr);
                }
            } 
            search.setBaseSearch(new_search);
            context.set('search', search);
        }
        return context;
    }

});

}(jQuery));
