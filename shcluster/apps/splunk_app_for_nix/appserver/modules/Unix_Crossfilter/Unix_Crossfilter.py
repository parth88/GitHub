# Copyright 2012 Splunk, Inc.                                                                       
#                                                                                                        
#   Licensed under the Apache License, Version 2.0 (the "License");                                      
#   you may not use this file except in compliance with the License.                                     
#   You may obtain a copy of the License at                                                              
#                                                                                                        
#       http://www.apache.org/licenses/LICENSE-2.0                                                       
#                                                                                                        
#   Unless required by applicable law or agreed to in writing, software                                  
#   distributed under the License is distributed on an "AS IS" BASIS,                                    
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.                             
#   See the License for the specific language governing permissions and                                  
#   limitations under the License.    

import json
import logging
import os
import sys

import cherrypy
import splunk

from splunk.appserver.mrsparkle.lib import jsonresponse
import controllers.module as module

logger = logging.getLogger('splunk')

class Unix_Crossfilter(module.ModuleHandler):

    def generateResults(self, **kwargs):
        output = {'results': []}
        total_hosts = {}

        sid = kwargs.get('sid')
        count = max(int(kwargs.get('count', 500)), 0)
        offset = max(int(kwargs.get('offset', 0)), 0)
        entity_name = kwargs.get('entity_name', 'results')
        post_process = kwargs.get('post_process', None)

        job = splunk.search.getJob(sid);

        if post_process is not None:
            job.setFetchOptions(search=post_process, offset=offset, count=count)

        rs = getattr(job, entity_name)

        for indx, row in enumerate(rs):
            obj = {}
            for field in row:
                obj[field] = str(row[field])
            output['results'].append(obj)

        return self.render_json(output)

    def render_json(self, response_data, set_mime='text/json'):
        cherrypy.response.headers['Content-Type'] = set_mime

        if isinstance(response_data, jsonresponse.JsonResponse):
            response = response_data.toJson().replace("</", "<\\/")
        else:
            response = json.dumps(response_data).replace("</", "<\\/")

        return ' ' * 256  + '\n' + response
