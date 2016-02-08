/*

*/

(function($) {

Splunk.Module.UnixHomeTitle = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);
        this.namespace = this.getParam('namespace');
        this.groupKey = this.getParam('groupKey');
        this.searchKey = this.getParam('searchKey');
        this.metricKey = this.getParam('metricKey');
        this.colors = this.getParam('colors');
        this.container.addClass('UnixHomeTitle-'+this.colors);
    },

    onContextChange: function(){
        var context = this.getContext(),
            form = context.get('form'),
            searchName = form[this.searchKey],
            metricName = form[this.metricKey],
            groupName = form[this.groupKey];

        this.setTitle(searchName, metricName, groupName);
    },

    setTitle: function(search, metric, group){
        this.container.find('.searchName').empty().append(search);
        this.container.find('.metricName').empty().append(metric);
        this.container.find('.groupName').empty().append(group);
    }

});

}(UnixjQuery));
