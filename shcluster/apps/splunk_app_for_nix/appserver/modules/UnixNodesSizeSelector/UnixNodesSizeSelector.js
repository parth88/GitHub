Splunk.Module.UnixNodesSizeSelector = $.klass(Splunk.Module.UnixBaseAbstractFactoryFactory, {

    initialize: function($super, container) {
        $super(container);
        this.canvas = d3.select(container).select("g.selector");
        this.default_size = this.getParam("default_size") || 75;
        this.node_size = this.default_size;
        this.storage = new this.RemoteStorage('Splunk.Module.UnixNodesSizeSelector', this.moduleId, false, this.moduleType);
        this.token = this.getParam('token');
        this.urlStorage = new this.URLStorage('Splunk.Module.UnixNodesSizeSelector', this.moduleId, false, this.moduleType);
        this.setFromStorage();
    },

    SIZE_MAP: {
        "small": 50,
        "medium": 65,
        "large": 100
    },

    getNodeSize: function() {
        return this.node_size;
    },

    getTextFill: function(size1, size2) {
        if (size1 === size2) {
           return "#F8FBEE";
        } else {
           return "#878787";
        }
    },

    getRectFill: function(size1, size2) {
        if (size1 === size2) {
           return "#ADADAD";
        } else {
           return "transparent";
        }
    },

    /*
     * draw the selection items and wire up callbacks
     */ 
    draw: function(size) {
        var that = this;
        this.canvas.selectAll("rect.border").remove();
        this.canvas.selectAll("text").remove();
        this.canvas.append("text")
            .attr("x", 0)
            .attr("y", 15)
            .attr("fill", "#878787")
            .text("Size");
        this.canvas.append("rect")
            .attr("id", "small")
            .attr("fill", this.getRectFill(size, "small"))
            .attr("stroke", "#b1b1b1")
            .attr("stroke-width", 1)
            .attr("x", 28)
            .attr("y", 4)
            .attr("height", 15)
            .attr("width", 15)
            .attr("class", "border")
            .on("click", function() {
		that.onClick("small");
            });
        this.canvas.append("text")
            .attr("x", 32)
            .attr("y", 15)
            .style("font-size", "11px")
            .attr("fill", this.getTextFill(size, "small"))
            .attr("class", "small")
            .text("S")
            .on("click", function() {
                that.onClick("small");
            });
        this.canvas.append("rect")
            .attr("id", "medium")
            .attr("fill", this.getRectFill(size, "medium"))
            .attr("stroke", "#b1b1b1")
            .attr("x", 49)
            .attr("y", 4)
            .attr("height", 15)
            .attr("width", 15)
            .attr("class", "border")
            .on("click", function() {
                that.onClick("large");
            });
        this.canvas.append("text")
            .attr("x", 52)
            .attr("y", 15)
            .attr("class", "medium")
            .attr("fill", this.getTextFill(size, "medium"))
            .style("font-size", "11px")
            .text("M")
            .on("click", function() {
                that.onClick("medium");
            });
        this.canvas.append("rect")
            .attr("id", "large")
            .attr("fill", this.getRectFill(size, "large"))
            .attr("stroke", "#b1b1b1")
            .attr("x", 70)
            .attr("y", 4)
            .attr("height", 15)
            .attr("width", 15)
            .attr("class", "border")
            .on("click", function() {
                that.onClick("large");
            });
        this.canvas.append("text")
            .attr("x", 74)
            .attr("y", 15)
            .style("font-size", "11px")
            .attr("class", "large")
            .attr("fill", this.getTextFill(size, "large"))
            .text("L")
            .on("click", function() {
                that.onClick("large");
            });
    },

    /*
     * override
     * set the node_size charting option
     */ 
    getModifiedContext: function() {
        var context = this.getContext(),
            chart = context.get("chart") || {},
            node_size = this.getNodeSize(),
            token = this.getToken();

        if (node_size !== null) {
            chart[token] = this.SIZE_MAP[node_size];
            context.set("chart", chart);
        }

        return context;
    },

    /*
     * resize click callback
     * set the size of the downstream nodes 
     */ 
    onClick: function(size) {
        this.setNodeSize(size);
    },

    /*
     * Save node size to remote storage
     */
    saveToStorage: function(){
        var self = this,
            size = {},
            data;
        size[self.token] = this.getNodeSize();
        data = JSON.stringify(size);
        this.storage.save(data);
        this.urlStorage.save(data);
    },
   
    setNodeSize: function(val) {
        this.node_size = val;
        this.draw(val); 
        this.saveToStorage();
        this.pushContextToChildren();
    },

    /*
     * attempt to get selected from storage
     * 1) URL storage
     * 2) User-Prefs
     * 3) Default selected
     */
    setFromStorage: function() {
        var self = this,
            token = self.token,
            data;

        data = this.urlStorage.load();

        if(data !== undefined && data.length > 0){
            data = JSON.parse(data);
            if(data !== undefined && data[token] !== undefined && data[token].length > 0){
                self.setNodeSize(data[token]);
            }  
        } else {
            this.storage.load(function(newData){
                if(newData !== undefined){
                    newData = JSON.parse(newData);
                    if (newData !== undefined && newData[token] !== undefined && newData[token].length > 0){
                        self.setNodeSize(newData[token]);
                    } else {
                        self.setNodeSize(self.default_size);
                    }
                } else {
                    self.setNodeSize(self.default_size);
                }
            });
        }
    }

});
