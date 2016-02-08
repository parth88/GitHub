import logging
import json

import cherrypy
import controllers.module as module

import splunk, splunk.search, splunk.util, splunk.entity
import lib.util as util
import lib.i18n as i18n
from splunk.appserver.mrsparkle.lib import jsonresponse

logger = logging.getLogger('splunk.appserver.controllers.module.UnixResultsTable')

# standard fields
TIME_FIELD = '_time'
RAW_FIELD = '_raw'

# response status codes
HTTP_BAD_REQUEST  = 400
HTTP_NOT_FOUND    = 404
HTTP_SERVER_ERROR = 500

class UnixResultsTable(module.ModuleHandler):

    def generateResults(self, host_app, client_app, sid, count=100, offset=0,
            field_list=None, postprocess=None, entity_name='results'):

        count = max(int(count), 0)
        offset = max(int(offset), 0)
        if not sid:
            err_msg = "Missing parameter 'sid'"
            return self.raise_error(HTTP_BAD_REQUEST, err_msg)

        job = splunk.search.JobLite(sid)

        # pass in any field list
        if (field_list) :
          job.setFetchOption(field_list=field_list, show_empty_fields=False)
        # pass in any post processing search to apply to results
        if postprocess:
          job.setFetchOption(search=postprocess)
          
        # set formatting
        job.setFetchOption(
          time_format=cherrypy.config.get('DISPATCH_TIME_FORMAT'),
          output_time_format=i18n.ISO8609_MICROTIME
        )      

        try:
            res = job.getResults(entity_name, offset, count)
        except Exception, e:
            logger.error(str(e))
            err_msg = "Unkown sid: %s" % sid
            return self.raise_error(HTTP_NOT_FOUND, err_msg)

        if res == None:
            err_msg = "Could not retrieve data: search job appears to have expired or has been cancelled"
            return self.raise_error(HTTP_SERVER_ERROR, err_msg)

        # fields to display
        field_names = [x for x in res.fieldOrder() if (not x.startswith('_') or x in (TIME_FIELD, RAW_FIELD))]

        # explicitly pull the _time field into the first column and _raw into the last
        try:
            timePos = field_names.index(TIME_FIELD)
            field_names.pop(timePos)
            field_names.insert(0, TIME_FIELD)
        except ValueError:
            pass

        try:
            rawPos = field_names.index(RAW_FIELD)
            field_names.pop(rawPos)
            field_names.append(RAW_FIELD)
        except ValueError:
            pass

        results = []
        dataset = res.results()
        for result in dataset:
            row = {}
            for field_name in field_names:
                field_values = result.get(field_name, None)
                # in case field_values has no len(), e.g. None or False
                try:
                    field_values_len = len(field_values)
                except TypeError:
                    field_values_len = 0
                    pass

                if field_name == RAW_FIELD and isinstance(field_values, splunk.search.RawEvent):
                    row[field_name] = field_values.getRaw()
                elif field_values_len > 1:
                    row[field_name] = [x.value for x in field_values]
                else:
                    row[field_name] = str(field_values)     
            results.append(row)

        return self.render_json({
            'fields': field_names,
            'results': results
        })

    def render_json(self, response_data, set_mime="text/json"):
        # set response type header and return JSON in body
        cherrypy.response.headers["Content-Type"] = set_mime
        if isinstance(response_data, jsonresponse.JsonResponse):
            response = response_data.toJson().replace("</", "<\\/")
        else:
            response = json.dumps(response_data).replace("</", "<\\/")
        return " " * 256  + "\n" + response

    def raise_error(self, status, err_msg):
        # set response HTTP status and return error message in body
        cherrypy.response.status = status
        logger.error("[HTTP %s] %s" % (status, err_msg))
        return err_msg


