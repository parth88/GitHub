import os
import logging.handlers

import splunk.entity as entity
import splunk.admin as admin

def setup_logging(app):
    LOG_FILENAME = os.path.join(os.environ.get('SPLUNK_HOME'), 'var','log','splunk','%s.log' % app)
    logger = logging.getLogger(app)
    logger.setLevel(logging.DEBUG)
    handler = logging.handlers.RotatingFileHandler(LOG_FILENAME, maxBytes=1024000, backupCount=5)
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    handler.setLevel(logging.DEBUG)
    logger.addHandler(handler)
    
    return logger

logger = setup_logging('paladin')

ACTION_ARCHIVE = 64
ACTION_RESTORE = 128

class ManagerEndpoint(admin.MConfigHandler):
    def setup(self):
        pass

    '''    
    def add_action(self, confItem, action):
        confItem.actions |= action
        
    def remove_action(self, confItem, action):
        confItem.actions &= ~action 
    
    def reloadEndpoint(self, endpoint):
        splunk.rest.simpleRequest("%s/_reload" % endpoint, method="POST", postargs=dict(),
                                  sessionKey=self.getSessionKey())
    '''
    
    def handleCreate(self, confInfo):
        """Called when user invokes the "create" action."""
        self.actionNotImplemented()
    def handleEdit(self, confInfo):
        """Called when user invokes the "edit" action."""
        self.actionNotImplemented()
    def handleList(self, confInfo):
        """Called when user invokes the "list" action."""
        self.actionNotImplemented()
    def handleMembers(self, confInfo):
        """Called when user invokes the "members" action."""
        self.actionNotImplemented()
    def handleReload(self, confInfo):
        """Called when user invokes the "reload" action."""
        self.actionNotImplemented()
    def handleRemove(self, confInfo):
        """Called when user invokes the "remove" action."""
        self.actionNotImplemented()
    def handleCustom(self, confInfo):
        """
          Called when user invokes a custom action.  Implementer can find out which
          action is requested by checking self.customAction and self.requestedAction.
          The former is a string, the latter an action type (create/edit/delete/etc).
        """
    
    def get_local_host(self):
        return entity.getEntity('/server/info', 'server-info', sessionKey=self.getSessionKey()).properties['serverName']

    
    
