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
from splunk.appserver.mrsparkle.lib import util as app_util
from splunk.models.field import FieldValue
import controllers.module as module

logger = \
logging.getLogger('splunk.appserver.controllers.module.CFScrollerXExpand')

APPS_DIR = app_util.get_apps_dir()
STATIC_APP = __file__.split(os.sep)[-5]
APP_DIR = os.path.join(APPS_DIR, STATIC_APP)

# SPL-44264 - some platforms won't include 
# an app's ./bin directory in the sys.path
BIN_DIR = os.path.join(APP_DIR, 'bin')
if not BIN_DIR in sys.path:
    sys.path.append(BIN_DIR)

def fv2json(fv):
    jsobj = {key[0]:key[1].get() for key in fv.field.fields()}
    
    for k in jsobj.keys():
        if type(jsobj[k]) == FieldValue:
            jsobj[k] = fv2json(jsobj[k])

    return jsobj

class CFScrollerXExpand(module.ModuleHandler):

    def generateResults(self, **kwargs):
        logger.error(kwargs)

        sid = kwargs.get('sid')
        count = max(int(kwargs.get('count', 1000)), 0)
        offset = max(int(kwargs.get('offset', 0)), 0)
        entity_name = kwargs.get('entity_name', 'results')

        if not sid:
            raise Exception('CFScrollerXExpand.generateResults - sid not passed!')

        try:
            job = splunk.search.getJob(sid);

        except splunk.ResourceNotFound, e:
            logger.error('CFScrollerXExpand could not find job %s. Exception: %s' % (sid, e))
            return self.render_json(_('Could not get search data.'))

        results = getattr(job, entity_name)[offset: offset+count]
        outputJSON = []
        for i, result in enumerate(results):
            obj = {}
            for k in result.keys():
                logger.debug("%s %s" % (k, result[k]));
                obj[k] = str(result[k])

            outputJSON.append(obj)

        return self.render_json({'result': outputJSON});

    def render_json(self, response_data, set_mime='text/json'):
        cherrypy.response.headers['Content-Type'] = set_mime

        if isinstance(response_data, jsonresponse.JsonResponse):
            response = response_data.toJson().replace("</", "<\\/")
        else:
            response = json.dumps(response_data).replace("</", "<\\/")

        return ' ' * 256  + '\n' + response

# ////////////////////////////////////////////////////////////////////////////
# Test routines
# ////////////////////////////////////////////////////////////////////////////

if __name__ == '__main__':

    import unittest
