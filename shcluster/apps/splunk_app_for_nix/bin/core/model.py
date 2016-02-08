from __future__ import with_statement

import copy

from splunk import rest

'''
PaladinQueryRunner is the query client runner to send query to splunk host, that can be splunkd or splunkbase
PaladinModel must use an instance of it to run query against the host
'''
class PaladinQueryRunner(object):

    def __init__(self, host_path, sessionKey, getargs=None, postargs=None):
        self.host_path = host_path
        self.sessionKey = sessionKey
        self.getargs = getargs
        self.postargs = postargs
    
    def update_getargs(self, name, value):
        if not self.getargs: 
            self.getargs = dict()
        
        self.getargs.update({name: value})
        
    def update_postargs(self, name, value):
        if not self.postargs: 
            self.postargs = dict()
        
        self.postargs.update({name : value})

    def make_uri(self, path):
        return '%s/%s' % (self.host_path, path) if not path.startswith('http') else path

    def do_GET(self, path, getargs=None):
        _getargs = copy.deepcopy(self.getargs) if self.getargs else None
        
        if getargs:
            if _getargs:
                _getargs.update(getargs)
            else:
                _getargs = getargs
        
        resp, cont = rest.simpleRequest(self.make_uri(path), self.sessionKey, getargs=_getargs)
        if resp.status not in [200, 201]:
            raise BaseException()

        return rest.format.parseFeedDocument(cont)
    
    def do_POST(self, path, postargs=None):
        _postargs = copy.deepcopy(self.postargs) if self.postargs else None
        
        if postargs:
            if _postargs:
                _postargs.update(postargs)
            else:
                _postargs = postargs
                
        resp, cont = rest.simpleRequest(self.make_uri(path), self.sessionKey, postargs=_postargs)
        if resp.status not in [200, 201]:
            raise BaseException(cont)
        
        try:
            atomEntry = rest.format.parseFeedDocument(cont)
        except Exception, e:
            return None
        
        if isinstance(atomEntry, rest.format.AtomFeed):
            try:
                atomEntry = atomEntry[0]
            except IndexError, e:
                return None
            
        return atomEntry

    def do_DELETE(self, path):
        resp, cont = rest.simpleRequest(self.make_uri(path), self.sessionKey, method='DELETE')
        if resp.status not in [200, 201]:
            raise BaseException()

        return rest.format.parseFeedDocument(cont)
    
    def as_json(self, entry):
        val = entry.asJsonStruct()
        if val.has_key('content'):
            val.update(dict(content = entry.toPrimitive()))
            
        return val
    
    def get_entities(self, path, getargs=None):
        atom = self.do_GET(path, getargs)
        return [self.as_json(entry) for entry in atom.entries]
        
    def get_entity(self, path, getargs=None):
        atom = self.do_GET(path, getargs)
        
        return None if len(atom.entries)==0 else self.as_json(atom.entries[0])
    
    def set_entity(self, path, postargs=None):
        atom = self.do_POST(path, postargs)
        if not atom: return None
        if isinstance(atom, rest.format.AtomEntry):
            return self.as_json(atom)
        return atom

    def remove_entity(self, path):
        return self.do_DELETE(path)

class PaladinField(object):
    
    # the initial flds can be 'na:nb:nc'
    # for dic['na']['nb']['nc']
    def __init__(self, *flds):
        self.flds = flds
        self._value = None

    def set(self, dic, name=None):
        if not name and not self.flds: 
            self._value = dic
            return
        
        if not self.flds: 
            self._value = dic.get(name, name)
            return

        val = dic
        
        for fld in self.flds:
            if not isinstance(fld, str):
                val = fld(val)
            elif isinstance(val, dict) and isinstance(fld, str):
                val = val.get(fld, fld)
            else: 
                val = None
                break
            
        self._value = val
            
    @property
    def value(self):
        return self._value


class PaladinRESTResource(object):
    
    # this methond give subclass a chance to extend its capabilities
    @classmethod
    def set_runner (cls, runner=None):
        if runner:
            if isinstance(runner, PaladinRESTResource):
                cls.runner = runner.runner
            
            if isinstance(runner, PaladinQueryRunner):
                cls.runner = runner


    @classmethod
    def new_type(cls):
        return type(cls.__name__, (cls, ), {})
                
    @classmethod
    def build(cls, runner):
        tp = cls.new_type()
        tp.set_runner(runner)
        return tp

    @classmethod
    def update_getargs(cls, name, value):
        cls.runner.update_getargs(name, value)

    @classmethod        
    def update_postargs(cls, name, value):
        cls.runner.update_postargs(name, value)

    @classmethod
    def as_json(cls, entry):
        val = entry.asJsonStruct()
        if val.has_key('content'):
            val.update(dict(content = entry.toPrimitive()))
            
        return val
    
    @classmethod
    def get_entities(cls, path, **kwargs):
        getargs = None
        if len(kwargs)>0:
            getargs = dict()
            getargs.update(kwargs)
            
        return cls.runner.get_entities(path, getargs)
        
    @classmethod
    def get_entity(cls, path, getargs=None):
        return cls.runner.get_entity(path, getargs)

    @classmethod
    def set_entity(cls, path, postargs=None):
        return cls.runner.set_entity(path, postargs)

    @classmethod
    def remove_entity(cls, path):
        return cls.runner.remove_entity(path)

    @classmethod
    def create(cls, **kwargs):
        postargs = None
        if len(kwargs)>0:
            postargs = copy.deepcopy(kwargs)
        
        ent = cls.runner.set_entity(cls.get_path(), postargs)
        return cls(ent)

    @classmethod
    def get(cls, *ids):
        assert len(ids)>0
        names = list(ids)
        values = [None for n in range(0, len(names))]
        
        for i in cls.all():
            for n in range(0, len(names)):
                if i.name.value in names[n]:
                    values[n] = i
                    break
            
        return list(values)

    '''
    name|value pairs for kwargs are:
    count        Number    30     Indicates the maximum number of entries to return. To return all entries, specify -1.
    offset       Number     0     Index for first item to return.
    refresh      Boolean          Indicates whether to scan for new apps and reload any objects those new apps contain.
    search       String           Search expression to filter the response. The response matches field values against the search expression. For example:
    sort_dir     Enum      asc     Valid values: (asc | desc)
    sort_key     String    name     Field to use for sorting.
    sort_mode    Enum      valid values: (auto | alpha | alpha_case | num) 
    '''
    @classmethod
    def all(cls, **kwargs):
        return [cls(ent) for ent in cls.runner.get_entities(cls.get_path(), **kwargs)]

    @classmethod
    def set_path(cls, path): 
        cls.__path = path
        
    @classmethod
    def get_path(cls): 
        return cls.__path
    
    def update(self, **kwargs):
        ''' to do '''
        
    def delete(self):
        ''' to do '''
    
    
def RESTResource(path=None):

    def new_type(cls):
        tp = type(cls.__name__, (cls, PaladinRESTResource), {})
        tp.set_path(path)
        return tp

    return new_type

'''
PaladinModel is used to transfer an atomField into python objects through REST calls.
'''
class PaladinModel(object):
    name = PaladinField('title')
    
    def __init__(self, entry):
        cls = self.__class__
        self.entry = entry
        fields = filter(lambda x: isinstance(getattr(cls, x), PaladinField), dir(cls))
  
        for n in fields:
            fld = getattr(cls, n)
            setattr(self, n, copy.deepcopy(fld))
            getattr(self, n).set(entry, n)


    def __str__(self):
        return str(self.entry) 


class RemoteAppFile(PaladinModel):
    href   = PaladinField('links', 'download', 'href')
    id     = PaladinField('id')


@RESTResource(path='api/apps/entriesbyid/%s')
class RemoteAppEntries(PaladinModel):
    href            = PaladinField('links', 'download', 'href')
    compatibility   = PaladinField('content', 'splunk_compatibility')
    
    @classmethod
    def get_appfile(cls, idpath):
        if idpath.startswith('http'):
            entry = cls.get_entity(idpath)
        else:
            path = '%s/%s' % (cls.get_path(), idpath)
            entry = cls.get_entity(path)
    
        return RemoteAppFile(entry)

    
    @classmethod
    def build(cls, splunkbase, appid):
        tp = cls.new_type()

        tp.set_runner (splunkbase.runner)
        tp.set_path(tp.get_path() % appid)
    
        return tp


#https://splunkbase.splunk.com/api/apps/entries/Splunk%20App%20for%20HadoopOps

@RESTResource(path='api/apps/entries/%s')
class NamedRemoteAppEntries(RemoteAppEntries):
    pass


class VersionDesc(PaladinModel):
    appid       = PaladinField('id')
    version     = PaladinField('title')
    href        = PaladinField('links','alternate','href')
    islatest    = PaladinField('content', 'islatest', bool)


'''
splunkbase provides remote app meta data as the following uri's.

# http://www.splunkbase.com/api/apps/entries?platform=Linux&version=5.0.1
# http://www.splunkbase.com/api/apps/entries/Google%20Maps?platform=Linux&version=5.0.1
# http://www.splunkbase.com/api/apps/entries/Google%20Maps/1.1.2?platform=Linux&version=5.0.1
# http://splunkbase.splunk.com/api/apps:download/Google+Maps/1.1.2/maps-20120820-25.tar.gz
'''

@RESTResource(path='api/apps/entries')
class RemoteApps(PaladinModel):
    # ['category', 'type', 'agent', 'allplatforms', 'q', 'name', 'splunk_version', 'version', 'sort_by', 'sort_dir', 'offset', 'count']
    
    id          = PaladinField('id')
    versions    = []
    href        = PaladinField('links', 'alternate', 'href')
    appid       = PaladinField('content', 'appID')
    compatibility   = PaladinField('content', 'splunk_compatibility')


    @classmethod
    def build (cls, splunkbase, platform, splunk_version='5.0.1'):
        tp = cls.new_type()

        runner = PaladinQueryRunner(splunkbase.host_path, splunkbase.sessionKey)
        tp.set_runner(runner)
        
        tp.update_getargs('platform', platform)
        tp.update_getargs('version', splunk_version)
        
        tp.splunkbase = splunkbase

        return tp
    
    @classmethod
    def get(cls, idpath, version, platform, splunk_version):
        if idpath.startswith('http'):
            return cls(cls.runner.get_entity(idpath))
        else:
            return cls(cls.runner.get_entity('%s/%s' % (cls.get_path(), idpath)))


'''
The app has been packaged to archived.
'''
class ArchivedApp(PaladinModel):
    name = PaladinField('content', 'name')
    path = PaladinField('content', 'path')
    url  = PaladinField('content', 'url')

'''
InstalledApp is the app information that was installed at a splunkd
'''
@RESTResource(path='services/apps/local')
class LocalApps(PaladinModel):
    id          = PaladinField('id')
    version     = PaladinField('content', 'version')
    description = PaladinField('content', 'description')
    owner       = PaladinField('content', 'eai:acl', 'owner')
    href        = PaladinField('links', 'alternate', 'href')

    @classmethod
    def build (cls, splunkd):
        tp = cls.new_type()
        tp.set_runner(splunkd.runner)
        tp.splunkd = splunkd
        
        return tp

    @classmethod
    def get(cls, idpath):
        if idpath.startswith('http'):
            return cls(cls.runner.get_entity(idpath))
        else:
            return cls(cls.runner.get_entity('%s/%s' % (cls.get_path(), idpath)))


    @classmethod
    def create(cls, appname, template, **kwargs):
        postargs = dict(name=appname, template=template)
        
        if len(kwargs)>0:
            postargs.update(kwargs)
            
        atom = cls.set_entity(cls.get_path(), postargs)
        
        return cls(atom)
    
    def delete(self):
        self.remove_entity('%s/%s' % (self.get_path(), self.name.value))
        
    def update(self, **kwargs):
        self.set_entity('%s/%s' % (self.get_path(), self.name.value), kwargs)
        
    def archive(self):
        path = '%s/%s/package' % (self.get_path(), self.name.value)
        entry = self.get_entity(path)
        
        return ArchivedApp(entry)

    @property
    def properties(self):
        if not hasattr(self, 'm_properties'):
            self.m_properties = LocalAppConfigs.build (self)
            
        return self.m_properties

    @property
    def configs(self):
        return self.properties

            
@RESTResource(path='servicesNS/nobody/%s/properties')
class LocalAppConfigs(PaladinModel):
    id          = PaladinField('id')
    href        = PaladinField('links', 'alternate', 'href')
        
    @classmethod
    def build(cls, app):
        tp = cls.new_type()
        tp.set_runner(app)
        tp.set_path(cls.get_path() % app.name.value)
        tp.app = app
        
        return tp

    # this is a bit tricky that we don't use cls.path to create a prop file, use 'configs/conf' instead.
    @classmethod
    def create(cls, propfile, stanza = 'default', **kwargs):
        path = 'servicesNS/nobody/%s/configs/conf-%s' % (cls.app.name, propfile)
        postargs = dict(name=stanza)
        if len(kwargs)>0:
            postargs.update(kwargs)
            
        cls.resource.set_entity(path, postargs)
        
    def stanzas(self):
        if not hasattr(self, 'm_pstanza'):
            self.m_pstanza = ConfigStanzas.build(self)

        return self.m_pstanza
    
@RESTResource(path='servicesNS/nobody/%s/properties/%s')        
class ConfigStanzas(PaladinModel):
    name        = PaladinField('title')
    id          = PaladinField('id')
    href        = PaladinField('links', 'alternate', 'href')
        
    @classmethod
    def build(cls, props):
        tp = cls.new_type()
        tp.set_runner(props)
        tp.set_path(tp.get_path() % (props.app.name.value, props.name.value))
        tp.__config_path = 'servicesNS/nobody/%s/configs/conf-%s' % (props.app.name.value, props.name.value)

        tp.stanza = props.name
        tp.propfile = props
        
        return tp

    @classmethod
    def all(cls):
        ents = [cls(ent) for ent in cls.get_entities(cls.get_path())]
        
        for enty in ents:
            enty.properties = dict()
            vals = cls.get_entities(enty.id.value)
            for val in vals:
                enty.properties.update({ val['title']: val['content']})
                
        return ents
        

    @classmethod
    def get (cls, stanza):
        for ent in cls.all():
            if ent.name.value==stanza:
                obj = cls(ent)
                obj.stanza = copy.deepcopy(ent.name)
                obj.properties = dict()

                props = cls.get_entities('%s/%s' % (cls.get_path(), stanza))       
                for p in props:
                    obj.properties.update({p['title'] : p['content']})
         
                return obj
    
    @classmethod
    def create(cls, stanza, **kwargs):
        postargs = dict(__stanza=stanza)
        cls.set_entity(cls.get_path(), postargs)
        if len(kwargs)>0: 
            cls.get(stanza).update(**kwargs)

    def update(self, **kwargs):
        path = '%s/%s' % (self.get_path(), self.stanza.value)
        postargs = dict()
        postargs.update(self.properties)
        if len(kwargs)>0: postargs.update(kwargs)
        self.set_entity(path, postargs)

    def delete(self):
        path = '%s/%s' % (self.__config_path, self.stanza.value)
        self.remove_entity(path)

class RepoAppDesc(PaladinModel):
    name            = PaladinField('stanza')
    appid           = PaladinField('appid')
    id              = PaladinField('id')
    version         = PaladinField('version')
    platform        = PaladinField('platform')
    splunk_version  = PaladinField('splunk_version')
    
