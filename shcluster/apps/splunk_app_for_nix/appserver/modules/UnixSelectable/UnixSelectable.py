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

class UnixSelectable(module.ModuleHandler):

    def generateResults(self, host_app, client_app, sid, token, count=None):

        output = {'results':[]}

        job = splunk.search.JobLite(sid);
        rs = job.getResults('results', count=count)

        tree = {}

        for row in rs.results():
            try:
                items = str(row[token])
                category = str(row['unix_category'])
                group = str(row['unix_group'])
                items = items.split(',')
                output['results'] = output['results'] + items

                for item in items:
                    self.prepareTree(tree, category, group)

                tree[category][group] = tree[category][group] + items

            except Exception, ex:
                logger.exception(ex)
                pass

        output['tree'] = tree

        return self.render_json(output)

    # Ensure that the appropriate keys exist in the tree
    def prepareTree(self, tree, category, group):
        if category not in tree:
            tree[category] = {}
        if group not in tree[category]:
            tree[category][group] = []

    def render_json(self, response_data, set_mime='text/json'):
        cherrypy.response.headers['Content-Type'] = set_mime
        if isinstance(response_data, jsonresponse.JsonResponse):
            response = response_data.toJson().replace("</", "<\\/")
        else:
            response = json.dumps(response_data).replace("</", "<\\/")
        return ' ' * 256  + '\n' + response

