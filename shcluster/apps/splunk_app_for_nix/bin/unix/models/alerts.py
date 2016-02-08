from splunk.models.base import SplunkAppObjModel
from splunk.models.field import Field, BoolField, IntField

'''
Provides object mapping for the alerts overlays used in the unix app
'''

class AlertOverlay(SplunkAppObjModel):
    
    resource              = 'unix/alert_overlay'
    description           = Field()
    business_impact       = Field()
    remediation           = Field()
    escalation            = Field()
    threshold_max         = IntField()
    threshold_min         = IntField()
    threshold_type        = Field()
    threshold_unit        = Field()

