(function($, _){

window.LinkedBasePanel = function(){

};

LinkedBasePanel.prototype.setNextPanel = function(nextPanel){
    this.nextPanel = nextPanel;
};

LinkedBasePanel.prototype.setPrevPanel = function(prevPanel){
    this.prevPanel = prevPanel;
};

LinkedBasePanel.prototype.closeAllNext = function(){
    var panel = this.nextPanel;
    while(panel !== null && panel !== undefined){
        panel.close();
        panel = panel.nextPanel;
    }
};

LinkedBasePanel.prototype.eachSibling = function(cb){
    var next = this.nextPanel;
    while(next !== null){
        next.updateCounts();
        cb(next);
        next = next.nextPanel;
    }

    var prev = this.prevPanel;
    while(prev !== null){
        cb(prev);
        prev = prev.prevPanel;
    }
};



})(UnixjQuery, UnixUnderscore);
