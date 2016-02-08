try:
    import xml.etree.cElementTree as et
except:
    import xml.etree.ElementTree as et

import logging
import os
import re
import sys
import time
import json

import cherrypy

import splunk
import splunk.rest
from splunk.util import uuid4

from splunk.models.fired_alert import FiredAlert
from splunk.models.saved_search import SavedSearch

import splunk.appserver.mrsparkle.controllers as controllers
import splunk.appserver.mrsparkle.lib.util as util

from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route

dir = os.path.join(util.get_apps_dir(), __file__.split('.')[-2], 'bin')
if not dir in sys.path:
    sys.path.append(dir)

from unix.util.timesince import *

logger = logging.getLogger('splunk')

class unixAlertEvents(controllers.BaseController):
    '''unixAlertEvents Controller'''

    @route('/:app/:action=search')
    @expose_page(must_login=True, trim_spaces=True, methods=['POST'])
    def search(self, app, action, **params):
        ''' search proxy '''

        user = cherrypy.session['user']['name']
        host_app = cherrypy.request.path_info.split('/')[3]
        basesearch = params.get('basesearch')
        earliest = params.get('earliest')
        latest = params.get('latest')
        search = basesearch.strip()
        if search[0] != '|':
            search = "search " + search

        try:
            job = splunk.search.dispatch(search, earliestTime=earliest, latestTime=latest)
            done = splunk.search.waitForJob(job, 10)
            if not done:
                logger.error('Search timed-out')
                return self.render_json({'success':'false', 'error':'search timeout'})

            output = []
            for r in job.results:
                output.append({k: str(r.get(k)) for k in r.keys()})

        except Exception, e:
            logger.error('%s Search failed: %s' % (e, basesearch))
            return self.render_json({'success':'false', 'error':'search failed'})

        return self.render_json({'success':'true', 'results': output, 'sid': job.sid})

    @route('/:app/:action=id')
    @expose_page(must_login=True, methods=['GET'])
    def id(self, app, action, **params):
        sid = params.get('sid')
        if sid:
            return self.sid(app, action, sid, params)

    @route('/:app/:action=id/:sid')
    @expose_page(must_login=True, methods=['GET'])
    def sid(self, app, action, sid, **kwargs):
        ''' return details for a specific alertevent'''

        alertevent = None
        output = None
        user = cherrypy.session['user']['name']
        host_app = cherrypy.request.path_info.split('/')[3]

        try:
            job = splunk.search.getJob(sid)

            #for r in job.results:
            #    logger.debug("results %s" % r)

            fired = FiredAlert.all()
            fired = fired.search('sid=%s' % sid)[0]

            hosts = sorted(list({str(x.get('host')) for x in job.results if x.get('hosts')}))
            alertevent = {'alert_name': job.label,
                    'time': fired.trigger_time,
                    'description': fired.savedsearch_name,
                    'severity': fired.severity,
                    'hosts': hosts,
                    'sid': sid,
                    'et': job.earliestTime,
                    'lt': job.latestTime}

            logger.debug(alertevent)

        except Exception, ex:
            logger.exception(ex)
            logger.warn('problem retreiving alertevent %s' % id)
            raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'alertevent_not_found', sid=sid), 303)

        return self.render_template('/%s:/templates/unixAlertEvents/alertevents_detail.html' % host_app,
                                    dict(alertevent=alertevent, host_app=host_app, app=app))

    @route('/:app/:action=alertevent_not_found')
    @expose_page(must_login=True, methods=['GET'])
    def notfound(self, app, action, **kwargs):
        ''' render the alertevent not found page '''

        host_app = cherrypy.request.path_info.split('/')[3]
        sid = kwargs.get('sid')
        return self.render_template('/%s:/templates/unixAlertEvents/alertevent_not_found.html' \
                                    % host_app,
                                    dict(host_app=host_app, app=app, sid=sid))

    def get_time(self, time):
        getargs = {'time': time, 'time_format': '%s'}
        serverStatus, serverResp = splunk.rest.simpleRequest('/search/timeparser', getargs=getargs)
        root = et.fromstring(serverResp)
        if root.find('messages/msg'):
            raise splunk.SplunkdException, root.findtext('messages/msg')
        for node in root.findall('dict/key'):
            return node.text

    def discover_tokens(self, search):
        return re.findall('\$([^\$]+)\$', search)

    def replace_tokens(self, search, sid):
        output = search
        tokens = self.discover_tokens(search)

        if len(tokens) > 0:
            try:
                job = splunk.search.JobLite(sid)
                rs = job.getResults('results', count=1)
                for row in rs.results():
                    tmp = []
                    for token in tokens:
                        if row[token] is not None:
                            output = re.sub(r'\$' + token + '\$', str(row[token]), output)
            except Exception, ex:
                logger.warn('unable to parse tokens from search %s' % sid)
                logger.debug(ex)
        return output

    def _redirect(self, host_app, app, endpoint, **kwargs):
        ''' convienience wrapper to make_url() '''

        return self.make_url(['custom', host_app, 'unixalertevents', app, endpoint], kwargs)
