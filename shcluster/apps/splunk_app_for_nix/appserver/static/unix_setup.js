// Copyright 2011 Splunk, Inc.
//
//   Licensed under the Apache License, Version 2.0 (the "License"); 
//   you may not use this file except in compliance with the License.    
//   You may obtain a copy of the License at
//                                                                                                        
//       http://www.apache.org/licenses/LICENSE-2.0 
//
//   Unless required by applicable law or agreed to in writing, software 
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and 
//   limitations under the License.


$(document).ready(function (){
    $('#scripted_enable_all').click(function (event){
        $('.ScriptedEnable').attr('checked', 'checked');
        event.preventDefault();
    });
    $('#scripted_disable_all').click(function (event){
        $('.ScriptedDisable').attr('checked', 'checked');
        event.preventDefault();
    });
    $('#monitor_enable_all').click(function (event){
        $('.MonitorEnable').attr('checked', 'checked');
        event.preventDefault();
    });
    $('#monitor_disable_all').click(function (event){
        $('.MonitorDisable').attr('checked', 'checked');
        event.preventDefault();
    });
    $('#unix_form').submit(function (event){
        $('#unix_submit').attr('disabled', 'disabled').val('Please wait...')
            .next().attr('disabled', 'disabled');
    }); 
    $('#unix_reset').click(function (event){
        $('.errorText').hide().html('');
    });
});
