from __future__ import with_statement

import os
import urllib
import urllib2
import lxml.etree as etree
from contextlib import closing, nested

from splunk import auth
from splunk.rest import format

import core.appmap as appmap
from model import PaladinModel, PaladinField, RESTResource, LocalApps, RemoteApps, PaladinQueryRunner, LocalAppConfigs
from model import RemoteAppEntries, NamedRemoteAppEntries


'''
PaladinException intended to be used to notify splunkd errors to the application in a systematical way -
include status, message etc.
'''
class PaladinException(Exception):
    exceptions = dict(
                      )

    def __init__(self, tag):
        self.message = PaladinException.exceptions[tag]


ATOM_NS = "{%s}" % format.ATOM_NS
NSMAP   = {'a' : format.ATOM_NS}

URLOPEN_TIMEOUT     = 15

'''
An abstraction of a remote splunkbase server.
'''
class Splunkbase(object):
    
    def __init__(self, host_path, username, password, login_url):
        super(Splunkbase, self).__init__()
        self.host_path = host_path
        self.login_url = login_url
        self.sessionKey = self.login(username, password)
        self.runner = PaladinQueryRunner(self.host_path, self.sessionKey)

    def login(self, username, password):
        post_args = urllib.urlencode(dict(username=username, password=password))
        # Forward post arguments, including username and password.
        with closing(urllib2.urlopen(self.login_url, post_args, URLOPEN_TIMEOUT)) as f:
            root = etree.parse(f).getroot()
            return root.xpath("a:id", namespaces=NSMAP)[0].text            
        
        raise Exception()
    
    # remote apps available for splunkd
    def get_apps (self, platform, splunk_version):
        remote = RemoteApps.build (self, platform, splunk_version)
        return remote.all()
    
    def get_appfile(self, appid, version):
        if appmap.idn_dict.has_key(appid):
            remote = NamedRemoteAppEntries.build (self, appmap.idn_dict[appid])
        else: remote = RemoteAppEntries.build (self, appid)
        return remote.get_appfile(version)

    def download_appfile(self, fd, appid, version):
        app = self.get_appfile(appid, version)
        location = app.href.value
    
        if location:
            req = urllib2.Request(url=location)
            req.add_header('X-Auth-Token', urllib.unquote(self.sessionKey))
            req.add_header('Content-Type', 'application/x-gzip')
            
            to_file = open(fd, 'w+')
            with nested(closing(urllib2.urlopen(req)), to_file) as (remote, local):
                local.write(remote.read())
                local.flush()
            to_file.close()
        
        return location
        

@RESTResource(path='services/server/info')
class ServerInfo(PaladinModel):
    name        = PaladinField('title')
    server_name = PaladinField('content', 'serverName')
    platform    = PaladinField('content', 'os_name')
    version     = PaladinField('content', 'version')

@RESTResource(path='services/apps/apptemplates')
class AppTemplates(PaladinModel):
    name        = PaladinField('title')
    href        = PaladinField('links', 'alternate', 'href')
    
@RESTResource(path='services/apps/appinstall')
class AppInstall(PaladinModel):
    location        = PaladinField('content', 'localtion')
    name            = PaladinField('content', 'name')
    status          = PaladinField('content', 'status')
    source_location = PaladinField('content', 'source_localtion')


'''
any splunkd will provide:
    1. access server info of this instance.
    2. local apps infos and browsing.
    3. archive a local app.
    4. restore an app to local
    5. install an app to local.
    6. remove an app in local.
    7. create a new app from template
    8. restart this instance
'''
class Splunkd(object):
    
    def __init__(self, host_path=None, sessionKey=None):
        self.runner = PaladinQueryRunner(host_path, sessionKey)
        self.host_path = host_path
        self.sessionKey = sessionKey
        
        info = ServerInfo.build (self.runner)
        
        # there is only one entry anyway
        for f in info.all():
            self.platform       = f.platform.value
            self.version        = f.version.value
            self.server_name    = f.server_name.value

        self.m_localapps = LocalApps.build (self)
        self.m_templates = AppTemplates.build (self.runner)
        self.m_installer = AppInstall.build (self.runner)

    def get_templates(self):
        return self.m_templates.all()
    
    def create_app_from_template(self, appname, template='barebones', **kwargs):
        return self.m_apps.create(appname, template, **kwargs)

    def local_apps(self):
        return self.m_localapps.all()
    
    '''
    Allows for restarting Splunk.
    POST server/control/restart

    Restarts the Splunk server. no return if ok.    
    '''
    def restart(self):
        self.runner.set_entity('services/server/control/restart')
        
    def remove_app(self, app):
        m_app = self.m_localapps.get(app)
        if m_app: m_app.delete()
        # after deletion, the splunkd should restart to respond the change.
        # here it is left to the application to do/control that.
    
    
    def install_app(self, fileName, update=False):
        return self.m_installer.create(name=fileName, update=update)
    
    def archive_app(self, app):
        m_app = self.m_localapps.get(app)
        return m_app.archive() if m_app else None
    
    '''
    The restoration of an app is based on the app file or a link from package_app that can be downloaded.
    it actually calls install_app with update=True flag.
    '''
    def restore_app(self, archive):
        return self.install_app(archive.path.value, True)


"""
VESTIGIAL
LOCAL_APP_REPO_DIR = '/Applications/splunk/etc/apps/splunk_app_shared_components/appserver/static/repo'    
'''
Paladin holds three resources:
    paladin.conf: that describes paladin host info, splunkbase and splunkd infos.
    appsrepo.conf: the local apps repo info.
    appfile repository: in the static folder for remote instance to locate the appfile.
    
    The methods provided here are for accessing these resources, and providing the instantiation of splunkbase, splunkd servers.
'''
class Paladin(Splunkd):
    
    def __init__(self, host_path=None, sessionKey=None):
        super(Paladin, self).__init__(host_path, sessionKey)
        paladin = self.m_localapps.get('paladin')
        m_configs = LocalAppConfigs.build(paladin)
        config, repoapps = m_configs.get('paladin', 'appsrepo')
        self.m_stanzas = ConfigStanzas.build(config)
        self.m_repoapps = ConfigStanzas.build(repoapps)
        # load configurations from paladin.conf
        stanza = self.m_stanzas.get('paladin')
        props = stanza.properties
        self.ex_host_path = props['external_host_path']

    def update_splunkd_desc(self, alias, host_path, username, password):
        stanza = 'splunkd-%s' % alias

        desc = self.m_stanzas.get(stanza)
        if desc:
            desc.update(host_path=host_path, username=username, password=password)
        else:
            self.m_stanzas.create(stanza, host_path=host_path, username=username, password=password)

    def get_splunkd_desc (self):
        return filter(lambda s: s.name.value.startswith('splunkd-'), self.m_stanzas.all())

    def remove_splunkd_desc(self, alias):
        stanza = self.m_stanzas.get('splunkd-%s' % alias)
        stanza.delete()
    
    def get_splunkbase_desc (self):
        return self.m_stanzas.get('splunkbase')
    
    def connect_splunkbase(self):
        sbase = self.get_splunkbase_desc()
        login_url = sbase.properties['login_url']
        host_path = sbase.properties['host_path']
        username = sbase.properties['username']
        password = sbase.properties['password']
        
        return Splunkbase(host_path, username, password, login_url)
    
    def connect_splunkd(self, alias):
        for meta in self.get_splunkd_desc():
            if meta.stanza.value=='splunkd-%s' % alias:
                host_path = meta.properties['host_path']
                username = meta.properties['username']
                password = meta.properties['password']
                sessionKey = auth.getSessionKey(username, password, host_path)
                return Splunkd(host_path, sessionKey)

    '''
    getting app info from paladin apps repo
    '''    
    def get_repo_app_desc (self, platform=None):
        apps = []
        for app in self.m_repoapps.all():
            props = app.properties
            props.update(dict(stanza = app.name.value))
            if not platform or props['platform']==platform:
                apps.append(RepoAppDesc(props))
                
        return apps

    def build_appname(self, appid, version, platform, splunk_version):
        return '%s-%s-%s-%s' % (appid, version, platform, splunk_version)

    def build_repo_appfile(self, appid, version, platform, splunk_version):
        return '%s/%s.spl' % (LOCAL_APP_REPO_DIR, self.build_appname(appid, version, platform, splunk_version))
        
    '''
    create or update a repo app entry in the appsrepo.conf
    base_id is the app url id from splunkbase
    '''
    def update_repo_app_desc(self, base_id, appid, version, platform, splunk_version):
        appname = self.build_appname(appid, version, platform, splunk_version)
        postargs = dict(__stanza=appname)
        self.m_repoapps.set_entity(self.m_repoapps.get_path(), postargs)
        self.m_repoapps.get(appname).update(id=base_id, appid=appid, version=version, platform=platform, splunk_version=splunk_version)
        
    '''
    download appfile from splunkbase and write to app repo
    '''    
    def download_appfile(self, appid, version, platform, splunk_version=None, overwrite=False):
        if not hasattr(self, 'splunkbase'):
            self.splunkbase = self.connect_splunkbase()
            
        fd = self.build_repo_appfile(appid, version, platform, splunk_version)

        print fd
        if overwrite or not os.path.exists(fd):
            self.splunkbase.download_appfile(fd, appid, version)
            
    '''
    get the url of the repo app in order to locate the repo app file from remote splunkd
    '''
    def get_appfile_url(self, appid, version, platform, splunk_version):
        return '%s/static/app/splunk_app_shared_components/repo/%s.spl' % (self.ex_host_path, self.build_appname(appid, version, platform, splunk_version))
        
    '''
    remove the entry(stanza) named appname in the appsrepo.conf
    '''
    def remove_repo_app_desc (self, appname):
        app = self.m_repoapps.get(appname)
        app.delete()
"""



if __name__ == "__main__":
    host_path = 'https://localhost:8089'
    sessionKey = auth.getSessionKey('admin', 'monday', host_path)
    
    splunkd = Splunkd(host_path, sessionKey)
    templates = splunkd.get_templates()
    
    '''
    for t in templates:
        napp = splunkd.create_app_from_template('ap-%s' % t.name.value, t.name.value)
        print napp.name.value
        print napp.href.value
    '''

    apps = splunkd.get_installed_apps()
    
    for app in apps:
        print app.name.value
        print app.description.value
            
    print '----------------------------------------'
    apps = splunkd.get_installed_apps()
    for app in apps:
        print app.name.value
        print app.version.value

