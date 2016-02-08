import json
import logging
import os
import sys

import cherrypy
import controllers.module as module
import splunk
import splunk.search
import splunk.util
import lib.util as util
from splunk.appserver.mrsparkle.lib import jsonresponse

logger = logging.getLogger('splunk')

class UnixNodes(module.ModuleHandler):

    def generateResults(self, host_app, client_app, sid, endpoint, internal, clicked=None, count=0, offset=0):

        count = max(int(count), 0)
        offset = max(int(offset), 0)

        internal = splunk.util.normalizeBoolean(internal)
        job = splunk.search.JobLite(sid)

        ''' 
        retrieve results from context search
        or from internal heatmap search 
        '''
        if internal is False:

            output = {'racks': {},'sym': {}, 'downed': {}}

            # handle the case where we must return the clicked host
            # we filter out the clicked host to prevent duplicates
            # and will get one less host than the dictated count
            if clicked is not None and count > 0:
                post_process = ' | search NOT host="%s"' % clicked
                job.setFetchOption(search=post_process)
                count = count - 1
                
            rs = job.getResults(endpoint, offset, count)

            output = self.append_hosts(rs, output) 
 
            # if we were given a clicked host, filter it in via
            # post process with a clean job and result set 
            if clicked is not None and count > 0: 
                job = splunk.search.JobLite(sid)
                post_process = ' | search host="%s"' % clicked
                job.setFetchOption(search=post_process) 
                rs = job.getResults(endpoint, 0, 0)
                output = self.append_hosts(rs, output)

        else:

            rs = job.getResults(endpoint, offset, count)
            output = {'heatmap': {}}

            for row in rs.results():

                host = str(row['host'])
                heatmap = str(row['heatmap'])

                output['heatmap'][host] = heatmap

        return self.render_json(output)

    def append_hosts(self, rs, output):

        downed = output['downed']
        symbol = ""

        for row in rs.results(): 

            host = str(row['host'])
            service = str(row['service'])
            
            if 'symbol' in row: 
                symbol = str(row['symbol'])
                if (symbol is not None) and (len(symbol)>0):
                     output['sym'][service]=symbol
            rack = str(row['group'])
            status = int(str(row['status']))

            if status != 1:
                downed[host] = 1
            if rack not in output['racks'].keys():
                output['racks'][rack] = {} 
            if host not in output['racks'][rack].keys():
                output['racks'][rack][host] = [{service: status}]
            else: 
                output['racks'][rack][host].append({service: status})
            output['downed'] = downed

        return output

    def render_json(self, response_data, set_mime='text/json'):
        cherrypy.response.headers['Content-Type'] = set_mime
        if isinstance(response_data, jsonresponse.JsonResponse):
            response = response_data.toJson().replace("</", "<\\/")
        else:
            response = json.dumps(response_data).replace("</", "<\\/")
        return ' ' * 256  + '\n' + response
