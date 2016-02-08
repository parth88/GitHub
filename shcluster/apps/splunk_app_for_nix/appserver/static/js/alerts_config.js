(function($) {
  var alerts = {};

  function updateAlert(action, form_key, post_args, $button) {
     $.ajax({
       url: action, 
       method: 'POST',
       data: post_args, 
       beforeSend: function(xhr) {
           xhr.setRequestHeader('X-Splunk-Form-Key', form_key);
       },
       success: function(response) { 
         if (response) {
           if (response.success === true) {
             setSavedValues($button.closest('.splUnixConfItem'));
             setSaved($button);
           } else {
             alert(response.error);
           }
         }
       }
     }).done(function() { 
         return;
     }).fail(function() {
         console.error('unable to update alert');
     });
  }
  function setSavedStatus(target) {
    var $target = $(target),
        $form = $target.closest('form'),
        name = $target.attr('name'),
        alert_name = $form.find('input[name="name"]').val(),
        the_alert = alerts[alert_name],
        val = name === "disabled" ? $form.find('input[name="disabled"]').prop('checked') : $target.val(),
        idx = the_alert.changed.indexOf(name);

    if (val === the_alert[name]) {
      if (idx !== -1)
        the_alert.changed.splice(idx, 1);

      if (the_alert.changed.length === 0)
        setSaved(target);
    } else {
      if (idx === -1)
        the_alert.changed.push(name);
      needsSave(target);
    }
  }
  function setSaved(target) {
     $(target).closest('form')
       .find('input.needs-save')
         .removeClass('needs-save')
         .addClass('saved')
         .prop('disabled', true)
         .val('Saved'); 
  }
  function needsSave(target) {
     $(target).closest('form')
       .find('input.saved')
         .removeClass('saved')
         .addClass('needs-save')
         .prop('disabled', false)
         .val('Save'); 
  }
  function getMin(that) {
     return Number($(that).attr('slidermin'));
  }
  function getMax(that) {
     return Number($(that).attr('slidermax'));
  }
  function getStep(that) {
     return Number($(that).attr('sliderstep') || 1);
  }
  function getVal(that) {
     return Number($(that).attr('sliderval'));
  }
  function setSavedValues(elm) {
      var self = $(elm),
          $slider = $(elm).find('.slider'),
          value = $slider.slider("option", "value"),
          name = self.find('input[name="name"]').val(),
          desc = self.find('textarea[name="description"]').val(),
          business_impact = self.find('input[name="business_impact"]').val(),
          definition = self.find('input[name="definition"]').val(),
          remediation = self.find('input[name="remediation"]').val(),
          escalation = self.find('input[name="escalation"]').val(),
          disabled = self.find('input[name="disabled"]').prop('checked'),
          severity = self.find('input[name="alert.severity"]').val();
      
      alerts[name] = {description: desc, definition: definition,
          business_impact: business_impact, remediation: remediation,
          escalation: escalation, disabled: disabled,
          "alert.severity": severity, changed: []};
      
      $slider.slider("option", "saved_value", value);
  }
  $(document).ready( function() {
    $('.slider.count').each(function(idx, elm){
      var min = getMin(elm),
          max = getMax(elm),
          step = getStep(elm),
          val = getVal(elm);
      $(elm).slider({ 
        step: step,
        min: min,
        max: max,
        value: val,
        saved_value: val,
        slide: function(e, ui) {
           $(elm).siblings('input').first().val(ui.value);
        },
        stop: function(e, ui) {
          setSavedStatus($(elm).parent().find('input.threshold-input'));
        }
      });
    });
    $('.slider.greater_than').each(function(idx, elm){ 
      var min = getMin(elm),
          max = getMax(elm),
          val = getVal(elm);
      $(elm).slider({ 
        range: 'max',
        min: min,
        max: max,
        value: val,
        saved_value: val,
        slide: function(e, ui) {
           $(elm).siblings('input').val(ui.value);
        },
        stop: function(e, ui) {
          setSavedStatus($(elm).closest('form').find('input.threshold-input'));
        }
      });
    });
    $('.slider.less_than').each(function(idx, elm){ 
      var min = getMin(elm),
          max = getMax(elm),
          val = getVal(elm);
      $(elm).slider({ 
        range: 'min',
        min: min,
        max: max,
        value: val, 
        saved_value: val,
        slide: function(e, ui) {
           $(elm).siblings('input').val(ui.value);
        },
        stop: function(e, ui) {
          setSavedStatus($(elm).closest('form').find('input.threshold-input'));
        }
      });
    });
    $('.splUnixConfItem').each(function(idx, elm) {
      setSavedValues(elm);
    });
    $('input.threshold-input').on('blur keyup', function(e) {
        var $elm = $(e.target),
            val = Number($elm.val()),
            $slider = $elm.siblings('.slider'),
            oldval = $slider.slider("option", "saved_value"),
            min = getMin($slider),
            max = getMax($slider);
        if ($elm.val() === '')
          $elm.val('0');
        if (isNaN(val)) {
          val = oldval;
          $elm.val(val);
        } else {
          if (val < min) {
            val = min;
            $elm.val(val);
          } else if (val > max) {
            val = max;
            $elm.val(val);
          }
        }
        $slider.slider("value", val);
        setSavedStatus(e.target);
    });
    $('.disabled-radio').each(function(idx, elm){
        var id = $(elm).attr('id');
        $('#' + id).buttonset();
    });
    $('label.ui-button').click(function(e){
        var $elm = $(e.target);
        if ($elm.is('span')) {
            $elm = $elm.parent();
        }
        if ($elm.hasClass('ui-state-active')===true) {
            $elm.removeClass('ui-state-active');
            $elm.siblings('label').addClass('ui-state-active');
            $elm.prev('input').prop('checked', false).click();
        } else {
            $elm.addClass('ui-state-active');
            $elm.siblings('label').removeClass('ui-state-active');
            $elm.prev('input').prop('checked', true).click();
        }
        setSavedStatus($elm.prev('input'));
    });
    $('form').submit(function(e){
        e.preventDefault();
        var $form = $(e.target),
            $button = $form.find('input.needs-save'),
            action = $form.attr('action'),
            form_key = $form.find('input[name=splunk_form_key]').val(),
            post_args = $form.serialize();
        updateAlert(action, form_key, post_args, $button); 
    });
    $('form :input').keyup(function(e) {
      setSavedStatus(e.target);
    });
  });
}(UnixjQuery));
