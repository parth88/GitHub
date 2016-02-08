(function($, undefined) {

Splunk.Module.UnixContextViewer = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        var $label;
        $super(container);
        // cast container jQ object into jQ object using passed $ instance
        // (instead of whatever core used for original container jQ object)
        this.$container = $(this.container);

        // initialize module params
        this.params = {
            namespace: this.getParam("namespace"),
            token: this.getParam("token"),
            value: this.getParam("value") || "",
            label: this.getParam("label"),
            width: this.getParam("width"),
            height: this.getParam("height")
        };

        // set internal state
        this._results = null;

        // cache needed elements
        this.$label = $('.UnixContextViewerLabel', this.$container);
        this.$value = $('.UnixContextViewerValue', this.$container);

        // apply width, height to container when applicable
        if (this.params.height) {
            this.setHeight(this.params.height);
        }
        if (this.params.width) {
            this.setWidth(this.params.width);
        }

        // add label if any
        if (this.params.label !== null) {
            this.setLabel(this.params.label);
        }
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * Rendering abstraction helpers
     * ///////////////////////////////////////////////////////////////////
     */

    setHeight: function(value) {
        this.$container.height(value);
    },

    setWidth: function(value) {
        this.$container.width(value);
    },

    setValue: function(value) {
        this.$value.text(value);
    },

    setLabel: function(text) {
        this.$label.text(text);
    },

    /**
     * ///////////////////////////////////////////////////////////////////
     * Hook ups to module system
     * ///////////////////////////////////////////////////////////////////
     */

    onContextChange: function() {
        var context = this.getContext(),
            form = context.get(this.params.namespace),
            value = form && form[this.params.token];

        // update value
        if (value) {
            this.renderResults(value);
        }
    },

    renderResults: function(value) {
        // cache results
        this._results = value;
        this.setValue(value);
        
        this.onResultsRendered();
    },

    // callback to override for post results rendering
    onResultsRendered: function() {
        return true;
    }
});

}(UnixjQuery));