from distutils.version import LooseVersion
import distutils.dir_util as dir_util
import logging
import logging.handlers
import os
import sys

import splunk
import splunk.entity
import splunk.appserver.mrsparkle.lib.util as app_util
from splunk.rest import simpleRequest

LOG_FILENAME = os.path.join(os.environ.get('SPLUNK_HOME'),'var','log','splunk','unix_installer.log')
logger = logging.getLogger('unix_installer')
logger.setLevel(logging.DEBUG)
handler = logging.handlers.RotatingFileHandler(LOG_FILENAME, maxBytes=1024000, backupCount=5)
handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
handler.setLevel(logging.DEBUG)
logger.addHandler(handler)

APP_NAME = 'splunk_app_for_nix'
APPS_DIR = app_util.get_apps_dir()
INSTALL_DIR = os.path.join(APPS_DIR, APP_NAME, 'install')
DEPENDENCIES = ['SA-nix', 'Splunk_TA_nix']

def install_dependency(dep):
    src = os.path.join(INSTALL_DIR, dep)
    dst = os.path.join(APPS_DIR, dep)
    try:
        dir_util.copy_tree(src, dst)
        logger.info("%s was successfully copied to %s" % (src, dst)) 
    except Exception, ex:
        logger.error("unable to copy %s to %s" % (src, dst)) 
        logger.exception(ex)

if __name__ == '__main__':

    token = sys.stdin.readlines()[0]
    token = token.strip()

    logger.info("Splunk App for *Nix Dependency Manager: Starting...")
   
    en = splunk.entity.getEntities('/apps/local', sessionKey=token)
    keys = en.keys()
    version = en[APP_NAME]['version']

    for dep in DEPENDENCIES:
        if not dep in keys:
            logger.info("dependency %s not found - installing..." % dep)
            install_dependency(dep)
        else:
            dep_version = en[dep]['version']
            if LooseVersion(version) > LooseVersion(dep_version):
                logger.info("installed version of %s is %s, which is older than required version %s - updating..." % (dep, dep_version, version))
                install_dependency(dep)        

    # Refresh the endpoint
    logger.info("Refreshing apps endpoint...");
    status, contents = simpleRequest("apps/local/_reload", sessionKey=token, method='POST')
    logger.info(status)
    logger.info(content)

    logger.info("Splunk App for *Nix Dependency Manager: Exiting...") 
      
