/*
this doesnt return something d3 would like to use,
fix to look like:

    [
        {
            name: "process1",
            data: [
                {
                    name: "host1",
                    memory: 10
                }
            ]
        }
    ]

i still dont know how to use that with d3
    just draw each group at once?
        => draw group markers, host markers, host labels

    draw group labels later

arcsize = size of each group * totalGroups

*/

(function($, _){

window.modelUtil = {
    groupDataA: function(data, groups){
        var combined = [],
            currentGroup;

        _.each(groups, function(group, i){
            // combined[group] = [];
            // currentGroup = combined[group];
            currentGroup = {
                name: group,
                data: []
            };
            combined.push(currentGroup);

            _.each(data, function(host, k){
                if(host[group] !== undefined){
                    currentGroup.data.push({
                        name: k,
                        memory: host[group]
                    });
                    // currentGroup[host.name] = host[group];
                }
            });
        });

        return combined;
    },

    countItems: function(groupedData){
        var numItems = 0;

        _.each(groupedData, function(group){
            _.each(group.data, function(){
                numItems++;
            });
        });
        
        return numItems;
    },

    /*
    main differences:
        1. there is only one grouping key, which has no value we are interested in
            => group: "DataCenterA"
            => versus: "python" => memory usage
        2. The group key has no value associated that we are trying to utilize.

    whichever metric is used, it will hvae to be combined across many things
        => memory should be combined across all processes if we are just reporting one memory statistic
    */
    groupDataB: function(data, groups, groupKey, metric){
        var combined = [],
            currentGroup;

        _.each(groups, function(group, i){
            currentGroup = {
                name: group,
                data:[]
            };
            combined.push(currentGroup);

            _.each(data, function(host, k){
                if(host[groupKey] === group){
                    currentGroup.data.push({
                        name: k,
                        memory: host[metric]
                    });
                    // currentGroup[host.name] = host[metric];
                }
            });
        });

        return combined;
    },

    countByGroup: function(data, groupKey){
        var byGroup = {},
            arr = [];

        $.each(data, function(i,v){
            if(byGroup[v[groupKey]] === undefined){
                byGroup[v[groupKey]] = 0;
            }
            byGroup[v[groupKey]]++;
        });

        // must use array - cant sort an object
        $.each(byGroup, function(k, v){
            var obj = {};
            obj.count = v;
            obj[groupKey] = k;
            arr.push(obj);
        });
        
        // this must be sorted the same way prepareData sorts
        // so the data is drawn in the same order
        return _.sortBy(arr, function(v){
            return v[groupKey];
        });
    },

    prepareData: function(data, groupKey){
        var prepared;
        /*
        we must sort the data by group because
        we have to draw the hosts together by group
        */
        prepared = _.sortBy(data, function(v){
            return v[groupKey];
        });

        return prepared;
    }
};

})(UnixjQuery, UnixUnderscore);
