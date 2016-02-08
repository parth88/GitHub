Splunk.Module.Unix_CFInclude = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);

        var that = this;

        this.namespace = this.getParam('namespace');
        this.file = this.getParam('file');
        this.ctx = {};
        this.hide('HIDDEN MODULE KEY');
        this.expose = this.getParam('export').split(',');

        if (this.file) {
            if (this.namespace === undefined || this.namespace === null)
                this.namespace = 'unixcf';
        }

        push();

        function identity(d) { return d; }

        function push() {
            var expose = that.expose,
                i;

            if (that.namespace === undefined || that.namespace === null) {
                that.namespace = 'unixcf';
                for (i = 0; i < expose.length; i++)
                    that.ctx[expose[i]] = identity;
            } else {
                var nsobj = window[that.namespace];

                if (nsobj) {
                    var func;

                    if (expose.indexOf('*') !== -1) { // export all
                        that.ctx = nsobj;
                    } else {
                        for (i = 0; i < expose.length; i++) {
                            func = nsobj[expose[i]];
                            if (func === undefined || func === null)
                                that.displayInlineErrorMessage(that.namespace + "." + expose[i] + " undefined.");
                            else
                                that.ctx[expose[i]] = nsobj[expose[i]];
                        }
                    }
                } else {
                    that.displayInlineErrorMessage('namespace"' + that.namespace + '" undefined.');

                    return;
                }
            }

            that.pushContextToChildren();
        }
    },

    getModifiedContext: function($super) {
        var context = this.getContext();

        context.set('namespace', this.namespace);
        context.set(this.namespace, this.ctx);

        return context;
    }
});
