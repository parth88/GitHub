(function($, _){
    
window.CategoryChildModel = function(rootModel){
    var getHostsUrl,
        hostsAreCached = false,
        self = this;

    getHostsUrl = Splunk.util.make_url('custom','splunk_app_for_nix','unixsetup','SA-nix','get_hosts');

    /*
    If we really needed to be extensible, these could be
    defined outside the model. This would allow a more 
    arbitrary structure to be constructed

    However, our current use case is rather limted so 
    extensibility is not the current goal. This is here
    so we have the window open in the future.
    */
    var appendHandlers = {
        'Category': insertObjectChild,
        'Group': insertHostsArrChild
    }

    this.data = [];
    this.currentKey = null;
    this.parentModel = null;
    this.childrenCounts = {};

    function insertObjectChild(data, key){
        data[key] = {};
    }

    function insertHostsArrChild(data, key){
        data[key] = []
    }

    function buildHostsSet(parent){
        hostsSet = {};

        _.each(parent, function(group, k){
            _.each(group, function(host){
                hostsSet[host] = k;
            });
        });

        return hostsSet;
    }

    function rebuildHostsWithOwners(hosts){
        var hostOwners = buildHostsSet(self.parentModel.data);

        /*
        this will associate each host with the groups it belongs to
        A host cannot belong to two groups within the same category
        i dont know how i can enforce that, however
        */

        self.hostsWithOwners = [];

        _.each(hosts, function(host, i){
            self.hostsWithOwners.push({
                name: host,
                owner: hostOwners[host]
            });
        });
    }

    this.getAllHosts = function(onSuccess, whileLoading){
        if(!hostsAreCached){
            whileLoading.call(self);
            $.ajax({
                type: 'GET',
                url: getHostsUrl,
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Splunk-Form-Key', Splunk.util.getConfigValue('FORM_KEY'));
                },
                success: function(hosts, textStatus, xhr) {
                    // var hostsWithOwners = buildHostsSet(self.parentModel.data);

                    
                    // this will associate each host with the groups it belongs to
                    // A host cannot belong to two groups within the same category
                    // i dont know how i can enforce that, however
                    
                    // _.each(hosts, function(host, i){
                    //     hosts[i] = {
                    //         name: host,
                    //         owner: hostsWithOwners[host]
                    //     };
                    // });

                    hostsAreCached = true;
                    self.hosts = hosts;
                    rebuildHostsWithOwners(hosts);

                    onSuccess.call(self, self.hostsWithOwners);
                },
                error: function(err){
                    onError.call(this, err);
                }
            });
        } else {
            rebuildHostsWithOwners(self.hosts);
            onSuccess.call(self, self.hostsWithOwners);
        }
        
    };

    this.getHostsNotInGroup = function(onSuccess, whileLoading){
        this.getAllHosts(function(hostData){
            var filtered = _.filter(hostData, function(item){
                return item.owner !== self.parentModel.currentKey;
            });
            onSuccess(filtered);
        }, whileLoading);
    };

    /*
    A host can only belong to a single group within a category.
    */
    this.appendHost = function(name){
        _.each(this.parentModel.data, function(group, groupKey){
            if(groupKey !== self.parentModel.currentKey){
                self.parentModel.data[groupKey] = _.without(group, name);
            }
        });
        this.data.push(name);
        rootModel.save();
    };

    this.append = function(title){
        var key,
            i = 0,
            appender,
            displayData = {};


        key = "New "+title;

        while(this.data[key] !== undefined){
            key = "New "+title+i;
            i++;
        }


        appender = appendHandlers[title];
        appender(this.data, key);
        self.childrenCounts[key] = 0;

        rootModel.save();

        displayData.name = key;
        displayData.count = 0;
        return displayData;
    };

    this.remove = function(key){
        if(_.isArray(this.data)){
            var newArr = _.without(this.data, key);
            this.parentModel.data[this.parentModel.currentKey] = newArr;
            this.data = this.parentModel.data[this.parentModel.currentKey];
        } else {

        }

        rootModel.save();
    };


    /*
    this uses the parent model to set the data for the
    current model.
    */
    this.load = function(model){
        if(model === undefined){
            this.data = rootModel.data;
            this.currentKey = null;
        } else {
            this.parentModel = model;
            this.currentKey = null;
            this.data = model.data[model.currentKey];
        }

        this.updateCounts();
    };

    this.updateCounts = function(){
        // This is super specific to the current data structure
        // a better solution would be a recursive function
        _.each(this.data, function(item, i){
            self.childrenCounts[i] = 0;
            if(_.isArray(item)){
                self.childrenCounts[i] += item.length;
            } else {
                _.each(item, function(arr){
                    self.childrenCounts[i] += arr.length;
                });
            }
        });
    }

    // TODO: change my name, it is not very descriptive or accurate
    this.update = function(newKey){
        if(this.currentKey !== newKey){
            this.data[newKey] = this.data[this.currentKey];
            delete this.data[this.currentKey];
            this.setCurrent(newKey);
            rootModel.save();
        }
    };

    this.setCurrent = function(newKey){
        this.currentKey = newKey;
    };

    this.deleteCurrent = function(){
        var del = false;
        if(this.currentKey !== null){
            del = confirm('Are you sure you want to delete "'+this.currentKey+'"?');
            if (del === true) {
                delete this.data[this.currentKey];
                rootModel.save();
            }
        }
        return del;
    };

    this.getTitle = function(){
        return self.parentModel.currentKey;
    };
}

})(UnixjQuery, UnixUnderscore);
