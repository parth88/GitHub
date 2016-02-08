import splunk.admin as admin
import sc_rest 
import core.manager 

logger = core.manager.setup_logging('scHeadlinesHandler')

class ScHeadlinesHandler(sc_rest.BaseResource):
    required_args = ['alert_name', 'message', 'label']
    optional_args = ['description', 'disabled']
    endpoint = 'admin/conf-headlines'

if __name__ == "__main__":
    admin.init(sc_rest.ResourceHandler(ScHeadlinesHandler), admin.CONTEXT_APP_ONLY)
