Splunk.Module.Cubism = $.klass(Splunk.Module, {
    initialize: function ($super, container) {
        
        $super(container);

        this.div_id = '#' + this.moduleId + '_cubism';
        this.svg_id = this.moduleId + '_svg';
        this.clicked = false;
        this.indexOnClick = 0;
        $script(Splunk.util.make_url('/modules/Cubism/cubism.v1.js'), 'cubism_js');

    },

   
    displayCube: function (data) {

        this.div = d3.select(this.div_id);

        data = d3.csv.parse(data);

        var latest = getLatest(data);
        var metricArray = getMetricArray(data);
        var extTop = getMetricExtent(data, metricArray);
  
             
        var delay = +Date.now() - latest * 1000;
        var now = +Date.now(); 

	
        var context = cubism.context()
            .step(60 * 1000) //.serverDelay( 13*60*60*1000) 
            .size(600) //use 1200 for now, need to adjust to accomodate width
        .stop(); //may need to use start() for real time

        var metricData = metricArray.map(stock);
        
        
        this.div.selectAll(".horizon").remove();
        this.div.selectAll(".axis").remove();
        

        this.div.selectAll(".axis")
            .data(["top", "bottom"])
            .enter().append("div")
            .attr("class", function (d) {
            return d + " axis";
        })
            .each(function (d) {
            d3.select(this).call(context.axis().ticks(8).orient(d));
        });

		
        this.div.append("div")
            .attr("class", "rule")
            .call(context.rule());
	
		for (var i =0; i < metricArray.length; i++) {
		
			 this.div.selectAll(".horizon f"+i)
            .data([metricData[i]])
            .enter().insert("div", ".bottom")
            .attr("class", "horizon f"+i)
            .call(context.horizon().extent([0, extTop[i]]).height(30).format(d3.format("+,.1f")));
		
		}
        
        this.container.bind("mouseover", this.onMouseover.bind(this));
        this.container.bind("click", this.onClick.bind(this));

        context.on("focus", function (i) {
        
            d3.selectAll(".value").style(
            "right", i == null ? null : context.size() - i  + "px;");

        });
        

		function getMetricExtent(data, marray) {
		
			var extent =[];
				
			var firstRow=data[1];	
		
		    for (var i=0 ; i < marray.length; i++) {
		    
		    	var tmp = firstRow[marray[i]];
		    
		    	if (tmp <= 100)	{
					extent.push(100);
				} else {
					extent.push(tmp*1.6);
				}		    	
		    
		    }
		    
		    return extent;
		
		}

        function getLatest(data) {

			
            if (data) {
                return data[data.length - 1]["time"];
            } else {
                return Date.now() / 1000;
            }
        }

        function getMetricArray(data) {

            var row = data[0];
            var metrics = [];

            for (var name in row) {
                if (name  && name.charAt(0) != "_" && name.charAt(0) != "t" && name.charAt(0) != "#" )  {
                    metrics.push(name);
                }
            }
 
            return metrics;
        }


        // Replace this with context.graphite and graphite.metric!
        function stock(name) {

            var value = 0,
                values = [];

            return context.metric(function (start, stop, step, callback) {


                rows = data.map(function (d) {

                    return [new Date(d.time), + d[name]];
                });

                rows.forEach(function (d) {

                    //for (var i=0; i < 30; i++) { 
                    values.push(value = (d[1]));
                    //}
                });
                
              
                
                callback(null, values.slice(-context.size()));

            }, name);
        }

    },

    onMouseover: function (event) {
            d3.selectAll(".value")
            .style("right", event.layerX == null ? null : cubism.context().size() - event.layerX  + "px;");
            this.indexOnClick =event.layerX ;
    },
  
    onClick: function(event){
        this.clicked = true;
        
        this.pushContextToChildren();
    },
    
    getModifiedContext: function() {
    
    	
    	var that = this,
            context = this.getContext(),
            dataset = context.get('dataset');

        if (dataset == undefined){
            return context;
        }
        
        if (this.clicked) {
            context.set("indexOnClick",this.indexOnClick);
            this.clicked = false;
        } else {
            this.displayCube(dataset.results);
        }
        
        return context;
	},  
   

    onContextChange: function () { 
    
    	
 		 var that = this,
            context = this.getContext(),
            dataset = context.get('dataset');
      

        if (dataset != undefined) {
            this.displayCube(dataset.results);
        }
    }

});