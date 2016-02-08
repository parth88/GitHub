from splunk.models.base import SplunkRESTModel, SplunkAppObjModel
from splunk.models.field import Field, BoolField
import logging

logger = logging.getLogger('splunk')


class Macro(SplunkAppObjModel):
    ''' Provides object mapping for macro objects '''
    resource              = 'admin/macros'
    args                  = Field()
    definition            = Field() 
    disabled              = BoolField(is_mutable=False)
    errormsg              = Field()
    iseval                = BoolField()
    validation            = Field()

