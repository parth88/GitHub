Splunk.Logger.mode.console = function(prepend) {
    var self = this,
        prefix = prepend;

    self.log = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(prefix);
        console.log.apply(console, args);
    };
    self.info = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(prefix);
        console.info.apply(console, args);
    };
    self.debug = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(prefix);
        console.debug.apply(console, args);
    };
    self.warn = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(prefix);
        console.warn.apply(console, args);
    };
    self.error = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(prefix);
        console.error.apply(console, args);
    };
    self.trace = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(prefix);
        console.trace.apply(console, args);
    };

    return self;
};
