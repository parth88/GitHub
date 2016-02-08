function ColorPalette($el, onSelect, onClose){
    var colors, 
        $color,
        color,
        $swatches,
        $confirm,
        $topButtons,
        $bottomButtons,
        self = this,
        i,
        $exitButton;

    this.$el = $el;
    $swatches = $("<div class='swatches'></div>");
    $bottomButtons = $("<div class='bottomButtons'></div>");
    $topButtons = $("<div class='topButtons'></div>");
    $confirm = $('<button class="btn unixButton confirm">Confirm</button>');
    $exitButton = $('<button class="btn unixButton exit">X</button>');

    this.$el.append($swatches);
    this.$el.append($bottomButtons); 
    this.$el.prepend($topButtons);
    $topButtons.append($exitButton);
    $bottomButtons.append($confirm);

    colors = [
        '#E8E8E8',
        '#C9C9C9',
        '#AFAFAF',
        '#000000',

        '#B6D6A7',
        '#7DBCA4',
        '#468AB8',
        '#F3D17D',

        '#F3B070',
        '#E47A56',
        '#C55559',
        '#912D47'
    ];

    function populatePallet(){
        for(i = 0; i < colors.length; i++){
            $color = $("<div class='swatch'></div>");
            // we save this twice because it will guarantee the format
            // does not switch to rgb or hsl
            $color.attr('bg', colors[i]);
            $color.css('background-color', colors[i]);
            $swatches.append($color);
        }
    }

    populatePallet();
    $el.find('.swatch').on('click', function(e){
        color = $(this).attr('bg');
        onSelect.call(this, color);
    });

    $exitButton.click(function(){
        self.close();
        onClose();
    });

    $confirm.click(function(){
       self.close();
       onClose(); 
    });

    this.open = function(){
        $el.show();
    };

    this.close = function(){
        $el.hide();
    };

}