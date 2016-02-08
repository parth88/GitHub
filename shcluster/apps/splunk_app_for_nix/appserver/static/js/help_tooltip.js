$(function(){
    $('.help').append('<img align="center" class="spl_tooltip" src="/static/app/splunk_app_for_nix/images/question_mark_icon_whitering.png"/>');
    $('.spl_tooltip').bind("mouseenter", function(evt){
        var $target = $(evt.target);
        var $tooltip = $('<span class="spl_tooltip_content"><img src="/static/app/splunk_app_for_nix/images/question_mark_icon_whitering.png"/></span>');
        var $text = getTooltipText($target.parent().attr('id'));
        $tooltip.append($text);
        $('body').append($tooltip);
        var offset = $target.offset();
        $tooltip.offset({ top: offset.top - 5 , left: offset.left });
        $('.spl_tooltip_content').bind("mouseleave", function(evt){
            $(this).remove();
        });
    });
});
