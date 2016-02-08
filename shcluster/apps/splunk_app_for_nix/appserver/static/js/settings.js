function resizeContentWindow() {
  var $iframe = $('iframe#settings-content'),
      $content = $iframe.contents().find('#setup'),
      $container = $('.settings-content'),
      height = Number($content.height()) + 100,
      width = Number($content.width()) + 100;

  $container.width(width);
  $container.height(height);
  $iframe.width(width);
  $iframe.height(height);
}

function updateFrame(target) {
  var $iframe = $('iframe#settings-content'),
      $target = $(target),
      $siblings = $('a.navlink'),
      href = $target.attr('href');

  $siblings.removeClass('selected');
  $siblings.attr('disabled', false);
  $target.attr('disabled', true);
  $target.addClass('selected');
  $iframe.attr('src', href);
}

$(document).ready(function() {
  var $iframe = $('iframe#settings-content'),
      $navlinks = $('a.navlink');
  $iframe.load(function() {
    resizeContentWindow();
  });
  $navlinks.click(function(e) {
    e.preventDefault();
    $iframe.attr('src', '');
    updateFrame(e.target);
  });
});