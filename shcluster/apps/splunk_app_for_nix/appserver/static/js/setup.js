/*
   @author      araitz
   @name        setup.js
   @description client-side for unix app setup

*/
// default window feature for preview windows
DEFAULT_WINDOW_FEATURES = 'status=1,toolbar=1,location=1,menubar=1,resizable=1,scrollbars=1,directories=1';
// handler for 'Add New' button click
function onAddClick(event){
    var $target = $(event.target),
        $parent = $target.closest('dd'),
        $container = $target.closest('.belowInput').prev(),
        $new_input;

    event.preventDefault();
    $container.children().removeClass('singleRow');
    $new_input = $container.clone(true, true);
    $container.after($new_input);
}

// handler for 'Remove' button click
function onRemoveClick(event){
    var $parent = $(event.target).parent(),
        $container = $(event.target).closest('dd');

    // 3 or less means that there will only be one element left
    if ($container.children().length < 4) {
        $container.find('span.remove-text')
            .addClass('singleRow');
    }   
    // remove the element itself
    $parent.remove();
}

// handler for 'Preview' button click
function onPreviewClick(event){
    var $macros = $(event.target).closest('dd').find('.dynamic-text'),
        path = document.location.pathname.split('/'),
        app = 'splunk_app_for_nix',
        search, search_string,
        values = [];

    // create list of search strings for preview search
    $macros.each(function() {
        if ($.trim($(this).val()) !== '') {
            values.push($.trim($(this).val()));    
        }
    });

    // generate aggregate search string 
    if (values.length > 0) {
        search_string = searchGenerator(values);  
    }

    // if we have a search string, dispatch the search in a new window
    if (search_string !== undefined && search_string !== null && search_string.length > 0 && search_string !== '*') {
	search_string = search_string.concat(' | head 20');
        search = new Splunk.Search(search_string);
        search.sendToView('unix_flashtimeline', {}, false, true, 
                          {'windowFeatures': DEFAULT_WINDOW_FEATURES}, app);
    } 
}

// returns a formatted search string
function searchGenerator(values) {
    var i,
        output = null, 
        outputList = [];

    for (i=0; i<values.length; i++) {
        if (values[i] && values[i] !== undefined && values[i] !== null) {
            outputList.push(values[i]);
        } 
    }
    if (outputList.length > 0 ) {
        output = outputList.join(' OR ');
    }
    return output; 
}

function getTooltipText(id) {
    switch(id){
        case "tip_os_index":
            return "The index or indexes that contain your *nix data.  For example: index=os";
        case "tip_syslog_sourcetype":
            return "The sourcetype or sourcetypes for your *nix syslog data, which contains system messages and logs.  For example: sourcetype=syslog";
        case "tip_cpu_sourcetype":
            return "The sourcetype or sourcetypes for your *nix cpu data, which contains information on CPU activity.  For example: sourcetype=cpu";
        case "tip_df_sourcetype":
            return "The sourcetype or sourcetypes for your *nix df data, which contains information on disk capacity.  For example: sourcetype=df";
        case "tip_hardware_sourcetype":
            return "The sourcetype or sourcetypes for your *nix hardware data, which contains information on physical hardware.  For example: sourcetype=hardware";
        case "tip_interfaces_sourcetype":
            return "The sourcetype or sourcetypes for your *nix interfaces data, which contains information on network interface utilization.  For example: sourcetype=interfaces";
        case "tip_iostat_sourcetype":
            return "The sourcetype or sourcetypes for your *nix iostat data, which contains information on disk input/output utilization.  For example: sourcetype=iostat";
        case "tip_lastlog_sourcetype":
            return "The sourcetype or sourcetypes for your *nix lastlog data, which contains information on user's last logins.  For example: sourcetype=lastlog";
        case "tip_lsof_sourcetype":
            return "The sourcetype or sourcetypes for your *nix lsof data, which contains information on open files.  For example: sourcetype=lsof";
        case "tip_memory_sourcetype":
            return "The sourcetype or sourcetypes for your *nix memory data, which contains information on memory utilization.  For example: sourcetype=vmstat";
        case "tip_netstat_sourcetype":
            return "The sourcetype or sourcetypes for your *nix netstat data, which contains information on network connections.  For example: sourcetype=netstat";
        case "tip_open_ports_sourcetype":
            return "The sourcetype or sourcetypes for your *nix open ports data, which contains information on open network ports.  For example: sourcetype=open_ports";
        case "tip_package_sourcetype":
            return "The sourcetype or sourcetypes for your *nix package data, which contains information on installed software packages.  For example: sourcetype=package";
        case "tip_ps_sourcetype":
            return "The sourcetype or sourcetypes for your *nix process data, which contains information on running processes.  For example: sourcetype=ps";
        case "tip_rlog_sourcetype":
            return "The sourcetype or sourcetypes for your *nix rlog data, which contains information on remote logins.  For example: sourcetype=rlog";
        case "tip_time_sourcetype":
            return "The sourcetype or sourcetypes for your *nix time data, which contains information on time settings.  For example: sourcetype=time";
        case "tip_top_sourcetype":
            return "The sourcetype or sourcetypes for your *nix top data, which contains information on tasks.  For example: sourcetype=top";
        case "tip_users_with_login_privs_sourcetype":
            return "The sourcetype or sourcetypes for your *nix users with login privileges data, which contains information on users that have login privileges.  For example: sourcetype=users_with_login_privs";
        case "tip_who_sourcetype":
            return "The sourcetype or sourcetypes for your *nix who data, which contains information on logged in users.  For example: sourcetype=who";
        default:
            break;
    }
}

$(document).ready(function() {

    // bind 'Add New' button click to the onAddClick() handler
    $('.add-text').bind('click', function(event) {
        event.preventDefault();
        onAddClick(event);
    });

    // bind 'Remove' button click to the onRemoveClick() handler
    $('.remove-text').bind('click', function(event) {
        event.preventDefault();
        onRemoveClick(event);
    });

    // bind 'Preview' button click to the onPreviewClick() handler
    $('.preview').bind('click', function (event) {
        event.preventDefault();
        onPreviewClick(event);
    });
    // proactively refresh lookups and macros
    $.ajax({
        url: Splunk.util.make_url('/debug/refresh?entity=admin/lookup-table-files&entity=admin/macros')
    });

});

