from splunk.models.base import SplunkAppObjModel
from splunk.models.field import Field

'''
Provides object mapping for the unix_setup conf file
'''

class UnixConfigured(SplunkAppObjModel):

    resource              = 'configs/conf-unix_setup'
    configured_version    = Field()
