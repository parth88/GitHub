(function($, _){
    
window.CategoryRootModel = function(){
    var loadUrl,
        saveUrl,
        self = this;

    loadUrl = Splunk.util.make_url('custom','splunk_app_for_nix','unixsetup','SA-nix','get_categories');
    saveUrl = Splunk.util.make_url('custom','splunk_app_for_nix','unixsetup','SA-nix','save_categories');
    getHostsUrl = Splunk.util.make_url('custom','splunk_app_for_nix','unixsetup','SA-nix','get_hosts');

    this.data = [];

    /*
    TODO: do this in python instead
    */
    function cleanData(data){
        _.each(data, function(cat, catKey){
            _.each(cat, function(group, groupKey){
                if(group.hosts === undefined){
                    group.hosts = [];
                }
                data[catKey][groupKey] = group.hosts;
            });
        });

        return data;
    }
    
    this.load = function(onSuccess, onError){
        $.ajax({
            type: 'GET',
            url: loadUrl,
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Splunk-Form-Key', Splunk.util.getConfigValue('FORM_KEY'));
            },
            success: function(data, textStatus, xhr) {
                data = cleanData(data);
                self.data = data;
                onSuccess.call(this, self.data, textStatus, xhr);
            },
            error: function(err){
                onError.call(this, err);
            }
        });
    };

    this.save = _.debounce(
      function(){
        var self = this;
        $.ajax({
            type: 'POST',
            url: saveUrl,
            data: JSON.stringify(this.data),
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Splunk-Form-Key', Splunk.util.getConfigValue('FORM_KEY'));
            },
            success: function(data, textStatus, xhr) {
                self.refresh();        
            },
            error: function(err){
                alert('Unable to save changes: your connection to Splunk might be down');
                console.error('save error: ', err);
            }
        });
      }, 
      500
    );
    
    this.refresh = _.debounce(
      function() {
        $.ajax({
            url: Splunk.util.make_url('/debug/refresh?entity=admin/lookup-table-files')
        });
      },
      500
    );

}


})(UnixjQuery, UnixUnderscore);
