import logging
import os
import sys
import json
import csv

import cherrypy

import splunk
import splunk.appserver.mrsparkle.controllers as controllers
import splunk.appserver.mrsparkle.lib.util as util
from splunk.models.saved_search import SavedSearch 
import splunk.util
import splunk.saved
import splunk.search


from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
from splunk.appserver.mrsparkle.lib import jsonresponse

dir = os.path.join(util.get_apps_dir(), __file__.split('.')[-2], 'bin')
if not dir in sys.path:
    sys.path.append(dir)

from unix.models.app import App
from unix.models.macro import Macro
from unix.models.unix_setup import UnixConfigured

logger = logging.getLogger('splunk')

## the macros to be displayed by the setup page
MACROS = [
          'os_index',
          'cpu_sourcetype',
          'df_sourcetype',
          'hardware_sourcetype',
          'interfaces_sourcetype',
          'iostat_sourcetype',
          'lastlog_sourcetype',
          'lsof_sourcetype',
          'memory_sourcetype',
          'netstat_sourcetype',
          'open_ports_sourcetype',
          'package_sourcetype',
          'protocol_sourcetype',
          'ps_sourcetype',
          'rlog_sourcetype',
          'syslog_sourcetype',
          'time_sourcetype',
          'top_sourcetype',
          'users_with_login_privs_sourcetype',
          'who_sourcetype'
         ]

'''Unix Setup Controller'''
class UnixSetup(controllers.BaseController):

    def render_json(self, response_data, set_mime="text/json"):
        cherrypy.response.headers["Content-Type"] = set_mime
        if isinstance(response_data, jsonresponse.JsonResponse):
            response = response_data.toJson().replace("</", "<\\/")
        else:
            response = json.dumps(response_data).replace("</", "<\\/")
        return " " * 256  + "\n" + response

    @route('/:app/:action=show')
    @expose_page(must_login=True, methods=['GET'])
    def show(self, app, action, **kwargs):

        form_content  = {}
        user = cherrypy.session['user']['name']
        host_app = cherrypy.request.path_info.split('/')[3]

        for key in MACROS:
            try:
                form_content[key] = Macro.get(Macro.build_id(key, app, user))
            except:
                form_content[key] = Macro(app, user, key)

        return self.render_template('/%s:/templates/unixSetup/setup_show.html' % host_app,
                                    dict(form_content=form_content, host_app=host_app, app=app))

    @route('/:app/:action=success')
    @expose_page(must_login=True, methods=['GET'])
    def success(self, app, action, **kwargs):
        ''' render the unix setup success page '''

        host_app = cherrypy.request.path_info.split('/')[3]
        ftr = kwargs.get('ftr', 0)

        return self.render_template('/%s:/templates/unixSetup/setup_success.html' \
                                    % host_app,
                                    dict(host_app=host_app, app=app, ftr=ftr))

    @route('/:app/:action=failure')
    @expose_page(must_login=True, methods=['GET'])
    def failure(self, app, action, **kwargs):
        ''' render the unix setup failure page '''

        host_app = cherrypy.request.path_info.split('/')[3]

        return self.render_template('/%s:/templates/unixSetup/setup_failure.html' \
                                    % host_app,
                                    dict(host_app=host_app, app=app))

    @route('/:app/:action=unauthorized')
    @expose_page(must_login=True, methods=['GET'])
    def unauthorized(self, app, action, **kwargs):
        ''' render the unix setup unauthorized page '''

        host_app = cherrypy.request.path_info.split('/')[3]
        ftr = kwargs.get('ftr', 0)

        return self.render_template('/%s:/templates/unixSetup/setup_403.html' \
                                    % host_app,
                                    dict(host_app=host_app, app=app, ftr=ftr))

    @route('/:app/:action=save')
    @expose_page(must_login=True, methods=['POST'])
    def save(self, app, action, **params):
        ''' save the posted unix setup content '''

        error_key = None
        form_content = {}
        user = cherrypy.session['user']['name']
        host_app = cherrypy.request.path_info.split('/')[3]
        this_app = App.get(App.build_id(host_app, host_app, user))
        ftr = 0 if (this_app.is_configured) else 1

        redirect_params = dict(ftr=ftr)

        # pass 1: load all user-supplied values as models
        for k, v in params.iteritems():

            try:
                key = k.split('.')[1]
            except IndexError:
                continue

            if key and key in MACROS:

                if isinstance(v, list):
                    definition = (' OR ').join(v)
                else:
                    definition = v
                try:
                    form_content[key] = Macro.get(Macro.build_id(key, app, user))
                except:
                    form_content[key] = Macro(app, user, key)
                form_content[key].definition = definition
                form_content[key].metadata.sharing = 'app'

        # pass 2: try to save(), and if we fail we return the user-supplied values
        for key in form_content.keys():

            try:
                if not form_content[key].passive_save():
                    logger.error('Error saving setup values')
                    return self.render_template('/%s:/templates/unixSetup/setup_show.html' \
                                                % host_app,
                                                dict(name=key, host_app=host_app, app=app,
                                                     form_content=form_content))
            except splunk.AuthorizationFailed:
                logger.error('User %s is unauthorized to perform setup on %s' % (user, app))
                raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'unauthorized', **redirect_params), 303)
            except Exception, ex:
                logger.debug(ex)
                logger.error('Failed to save eventtype %s' % key)
                raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'failure', **redirect_params), 303)

        this_app.is_configured = True
        # comment out this line to work around SPL-109444. Also, the removal of the call has no actual impact.
        # this_app.share_app()
        this_app.passive_save()

        # save build version to unix_setup.conf
        unixConfigured = UnixConfigured.get(UnixConfigured.build_id('install', host_app, 'nobody'))
        # Because UnixConfigured resource is 'configs/conf-unix_setup', no way to define required and optional fields there.
        # So call SplunkRESTManager._put_args directly, instead of unixConfigured.save(), to bypass required and optional fields check.
        newModel = UnixConfigured.manager()._put_args(UnixConfigured.build_id('install', host_app, 'nobody'), {'configured_version': this_app.version})
        logger.info('Save configured version from %s to %s successful' % (unixConfigured.configured_version, this_app.version))

        logger.info('App setup successful')
        raise cherrypy.HTTPRedirect(self._redirect(host_app, app, 'success', **redirect_params), 303)

    def insertDictItem(self, k, currentLevel):
        if k not in currentLevel:
            newLevel = {}
            currentLevel[k] = newLevel
        
        return currentLevel[k]

    def insertListItem(self, item, k, currentLevel):
        if k not in currentLevel:
            currentLevel[k] = []
        
        currentLevel[k].append(item)
        return currentLevel[k]

    def build_tree(self, raw, tree, order):
        for row in raw:
            # every row starts by inserting from the top-level of the tree
            currentLevel = tree
            for i, m in enumerate(order):
                item = row[m].strip()
                
                # Our leaves are represented by a list of hosts
                # these get appended to the hosts key of the last level
                if(i == len(order)-1):
                    self.insertListItem(item, 'hosts', currentLevel)
                else:
                    currentLevel = self.insertDictItem(item, currentLevel)

    def tree_to_csv(self, flat, node, csvOrder, hierarchy=[], slot=0):
        if(isinstance(node, basestring)):
            mappedSlot = csvOrder[slot]
            hierarchy[mappedSlot] = node

            # this makes a copy of hierarchy
            flat.append(list(hierarchy))

        elif(isinstance(node, dict)):
            if('hosts' in node and len(node) == 1):
                self.tree_to_csv(flat, node.get('hosts'), csvOrder, hierarchy, slot)
            else:
                for k, item in node.iteritems():
                    mappedSlot = csvOrder[slot]
                    hierarchy[mappedSlot] = k
                    self.tree_to_csv(flat, item, csvOrder, hierarchy, slot+1)
        else: 
            for item in node:
                self.tree_to_csv(flat, item, csvOrder, hierarchy, slot)

    def getOrder(self, keys, csvHeaders):
        order = []
        for key in keys:
            for i, header in enumerate(csvHeaders):
                if key == header.strip():
                    order.append(i)

        return order


    @route('/:app/:action=categories')
    @expose_page(must_login=True, methods=['GET'])
    def show_categories(self, app, action, **params):
        ''' render the unix categories page '''

        host_app = cherrypy.request.path_info.split('/')[3]

        csvData = []
        lookupCSV = os.path.join(util.get_apps_dir(), 'SA-nix', 'lookups', 'dropdowns.csv')
        with open(lookupCSV, 'rb') as csvfile:
             reader = csv.reader(csvfile)
             for row in reader:
                if len(row) == 3:
                    csvData.append(row)

        csvKey = csvData[0]
        keyOrder = ['unix_category', 'unix_group', 'host']
        order = self.getOrder(keyOrder, csvKey)
        csvData = csvData[1:len(csvData)]

        tree = {}
        self.build_tree(csvData, tree, order)
        tree = json.dumps(tree)


        return self.render_template('/%s:/templates/unixSetup/setup_categories.html' \
                                    % host_app,
                                    dict(host_app=host_app, app=app, csvData=csvData, csvKey=csvKey, tree=tree))

    @route('/:app/:action=get_categories')
    @expose_page(must_login=True, methods=['GET'])
    def load_categories(self, app, action, **params):
        host_app = cherrypy.request.path_info.split('/')[3]

        csvData = []
        lookupCSV = os.path.join(util.get_apps_dir(), 'SA-nix', 'lookups', 'dropdowns.csv')
        with open(lookupCSV, 'rb') as csvfile:
             reader = csv.reader(csvfile)
             for row in reader:
                 csvData.append(row)

        csvHeaders = csvData[0] # this must contain all the column names
        keyOrder = ['unix_category', 'unix_group', 'host']
        order = self.getOrder(keyOrder, csvHeaders)
        csvData = csvData[1:len(csvData)]

        tree = {}
        self.build_tree(csvData, tree, order)

        return self.render_json(tree)

    @route('/:app/:action=get_hosts')
    @expose_page(must_login=True, methods=['GET'])
    def get_hosts(self, app, action, **params):
        saved_search = SavedSearch('', cherrypy.session['user']['name'], 'newsearch')
        job = splunk.search.dispatch('| metadata type=hosts `metadata_index`', namespace='splunk_app_for_nix')

        splunk.search.waitForJob(job)

        hostData = []
        for item in job.results:
            hostData.append(unicode(item['host']))

        return self.render_json(hostData)

    @route('/:app/:action=save_categories')
    @expose_page(must_login=True, methods=['POST'])
    def save_categories(self, app, action, **params):
        user = cherrypy.session['user']['name']
        host_app = cherrypy.request.path_info.split('/')[3]
        this_app = App.get(App.build_id(host_app, host_app, user))

        for param in params:
            data = json.loads(param)

        csvData = []
        csvOrder = [1,2,0]

        #logger.error('before: %s' % data)
        self.tree_to_csv(csvData, data, csvOrder, [0,0,0])
        csvHeader = ["host", "unix_category", "unix_group"]
        csvData.insert(0, csvHeader)
        #logger.error('after: %s' % csvData)

        dropdownsCsv = os.path.join(util.get_apps_dir(), 'SA-nix', 'lookups', 'dropdowns.csv')
        with open(dropdownsCsv, 'wb') as csvfile:
             writer = csv.writer(csvfile)
             writer.writerows(csvData)

        session_key = cherrypy.session.get('sessionKey')
        success, errcode, reason = self._force_lookup_replication('SA-nix', 'dropdowns.csv', session_key)
        logger.info('force lookup replication: %s, %s, %s' % (success, errcode, reason))

    def _redirect(self, host_app, app, endpoint, **kwargs):
        ''' convenience wrapper to make_url() '''

        return self.make_url(['custom', host_app, 'unixsetup', app, endpoint], kwargs)

    def _force_lookup_replication(self, app, filename, sessionKey, base_uri=None):
        '''Force replication of a lookup table in a Search Head Cluster.'''

        # Permit override of base URI in order to target a remote server.
        endpoint = '/services/replication/configuration/lookup-update-notify'
        if base_uri:
            repl_uri = base_uri + endpoint
        else:
            repl_uri = endpoint

        payload = {'app': app, 'filename': os.path.basename(filename), 'user': 'nobody'}
        response, content = splunk.rest.simpleRequest(
            repl_uri,
            method='POST',
            postargs=payload,
            sessionKey=sessionKey,
            raiseAllErrors=False)

        if response.status == 400:
            if 'No local ConfRepo registered' in content:
                # search head clustering not enabled
                return (True, response.status, content)
            elif 'Could not find lookup_table_file' in content:
                return (False, response.status, content)
            else:
                # Previously unforeseen 400 error.
                return (False, response.status, content)
        elif response.status != 200:
            return (False, response.status, content)
        return (True, response.status, content)
