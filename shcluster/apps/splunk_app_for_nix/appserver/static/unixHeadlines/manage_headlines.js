function deleteHandler (event) {
    // handle click to delete a headline 
    var $target = $(event.target),
        base = $target.attr('href'),
        key = $target.attr('name'),
        label = $target.attr('id'),
        path = base.split('/'),
        path_len = path.length,
        id = path.slice(path_len-1)[0],
        cnfrm = confirm("Delete headline '" + JSON.stringify(label) + "'?"),
        base_path = path.slice(0,path_len-2).join('/'),
        del_path = path.slice(0,path_len-1).join('/'),
        return_to = [base_path, 'manage'].join('/');

    event.preventDefault();
    if (cnfrm === true) {
        $.ajax({
            type: 'POST',
            url: del_path,
            data: {'name': id},
            dataType: 'json',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Splunk-Form-Key', key);
            },
            error: function(data) {
                console.error('error deleting headline: ' + label);  
            },
            complete: function(data) {
                var redirect_uri = return_to + '?' + Math.random();
                window.document.location = redirect_uri;
            }
        });
    }
}
$(document).ready(function() {
    var $table = $('#headlines_table');
    if ($table.length > 0) {
        $table.tablesorter();
    }
    $('a.delete').bind('click', function(e) {
        deleteHandler(e);
    });
});
