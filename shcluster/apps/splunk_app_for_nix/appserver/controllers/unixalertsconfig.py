import logging
import os
import sys

import cherrypy

import splunk
import splunk.util
import splunk.appserver.mrsparkle.controllers as controllers
import splunk.appserver.mrsparkle.lib.util as util

from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route

dir = os.path.join(util.get_apps_dir(), __file__.split('.')[-2], 'bin')
if not dir in sys.path:
    sys.path.append(dir)

from unix.models.saved_search import SavedSearch
from unix.models.alerts import AlertOverlay
from unix.models.macro import Macro

logger = logging.getLogger('splunk')

MACRO_PREFIX = '_unix_alert_threshold_'

class UnixAlertsConfig(controllers.BaseController):
    '''Unix Alerts Config Controller'''

    @route('/:client_app/:action=show')
    @expose_page(must_login=True, methods=['GET'])
    def show(self, client_app, action, **kwargs):

        user = cherrypy.session['user']['name']
        host_app = cherrypy.request.path_info.split('/')[3]

        alerts = SavedSearch.all()
        alerts = alerts.filter_by_app(client_app)
        alerts = alerts.search('alert.track=True')

        overlay = AlertOverlay.all()
        overlay._count_per_req = 30
        overlay = overlay.filter_by_app(client_app)

        macros = Macro.all()
        macros = macros.filter_by_app(client_app)
        macros = macros.search('name=%s*' % MACRO_PREFIX)

        return self.render_template('/%s:/templates/unixAlertsConfig/alerts_config_show.html' % host_app,
                                    dict(alerts=alerts, overlay=overlay, macros=macros,
                                         host_app=host_app, client_app=client_app))

    @route('/:client_app/:action=save')
    @expose_page(must_login=True, methods=['POST'])
    def save(self, client_app, action, **params):

        user = cherrypy.session['user']['name']
        host_app = cherrypy.request.path_info.split('/')[3]
        name = params['name']
        macro_name = '%s%s' % (MACRO_PREFIX, name)
        disabled = splunk.util.normalizeBoolean(params['disabled'])

        try:
            value = int(params['definition'])
        except ValueError, e:
            return self.render_json({'success': False, 'error': 'Threshold value should be an integer.'})

        try:
            overlay = AlertOverlay.get(AlertOverlay.build_id(name, client_app, 'nobody'))
        except:
            overlay = AlertOverlay(client_app, 'nobody', name)

        overlay.update(params)

        if (value > overlay.threshold_max or value < overlay.threshold_min):
            return self.render_json({'success': False, 'error':
                        'value out of valid range [%d, %d]' % (overlay.threshold_min, overlay.threshold_max)})

        try:
            macro = Macro.get(Macro.build_id(macro_name, client_app, 'nobody'))
        except:
            macro = Macro(client_app, 'nobody', macro_name)

        try:
            alert = SavedSearch.get(SavedSearch.build_id(name, client_app, 'nobody'))
        except:
            alert = SavedSearch(client_app, 'nobody', name)

        macro.definition = params['definition']
        alert.alert.severity = params['alert.severity']

        if (macro.passive_save() is True and overlay.passive_save() is True and alert.passive_save() is True):
            if disabled is True:
                alert.disable()
            else:
                alert.enable()
            return self.render_json({'success': True, 'error': 'none'})
        else:
            logger.error(self.errors)
            return self.render_json({'success': False, 'error': 'cant save'})

