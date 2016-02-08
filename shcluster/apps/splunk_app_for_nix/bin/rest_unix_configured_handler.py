import logging
import logging.handlers
import splunk.admin as admin
import splunk.rest
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path

# constants for logger
HANDLER_NAME = "unix_configured_handler"
LOG_FILE_NAME = "unix_configured_handler.log"

# setup the logger
def setup_logger():
    logger = logging.getLogger(HANDLER_NAME)
    logger.propagate = False  # Prevent the log messages from being duplicated in the python.log file
    logger.setLevel(logging.DEBUG)

    file_handler = logging.handlers.RotatingFileHandler(make_splunkhome_path(['var', 'log',
      'splunk', LOG_FILE_NAME]), maxBytes=5000000, backupCount=1)
    formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
    file_handler.setFormatter(formatter)

    logger.addHandler(file_handler)

    return logger

logger = setup_logger()

APP_NAME = "splunk_app_for_nix"

# constants for conf file names
SETUP_CONF_Name = "unix_setup"
APP_CONF_NAME = "app"

# constants for setup conf file
STANZA_CONFIGURED_VERSION = "install"
KEY_CONFIGURED_VERSION = "configured_version"

# constants for app conf file
STANZA_VERSION = "launcher"
KEY_VERSION = "version"

class ResetApp(admin.MConfigHandler):

    def setup(self):
        pass

    def getVersions(self):
        logger.info("Requester: %s %s" % (self.appName, self.userName))

        # enforce appName because trigger associated with configuration replication will be from "system"
        if self.appName != APP_NAME:
            self.appName = APP_NAME
            logger.info("Enforce Requester to %s" % self.appName)

        setupConf = self.readConf(SETUP_CONF_Name)
        appConf = self.readConf(APP_CONF_NAME)
        configured = None
        current = None

        # obtain configured_version from setup conf file
        if STANZA_CONFIGURED_VERSION in setupConf:
            stanza = setupConf[STANZA_CONFIGURED_VERSION]
            logger.info("%s %s" % (STANZA_CONFIGURED_VERSION, stanza))
            if KEY_CONFIGURED_VERSION in stanza:
                configured = stanza[KEY_CONFIGURED_VERSION]

        # obtain version from app conf file
        if STANZA_VERSION in appConf:
            stanza = appConf[STANZA_VERSION]
            logger.info("%s %s" % (STANZA_VERSION, stanza))
            if KEY_VERSION in stanza:
                current = stanza[KEY_VERSION]

        logger.info("configured %s, current %s" % (configured, current))

        return (configured, current)

    # handler for reload
    def handleReload(self, confInfo):
        logger.info("reset requested %s" % self.requestedAction)

        (configured, current) = self.getVersions()

        if configured == current:
            # reset is_configured to true in app.conf when configured_version value in setup conf file is equal to version value in app conf file.
            postargs = {'configured': True}
            response, content = splunk.rest.simpleRequest(
                '/apps/local/splunk_app_for_nix',
                self.getSessionKey(), postargs=postargs)

            logger.info("reset completed %s" % (response, ))

# initialize the handler
admin.init(ResetApp, admin.CONTEXT_APP_AND_USER)