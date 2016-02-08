import os
import sys

import splunk
import splunk.search

SSLIST = ['__generate_lookup_dropdowns']

APP_NAME = __file__.split(os.sep)[-4]
APP_DIR = (os.sep).join(__file__.split(os.sep)[0:-4])
CSV = os.path.join(APP_DIR, APP_NAME, 'lookups', 'dropdowns.csv')

if __name__ == '__main__':

    token = sys.stdin.readlines()[0]
    token = token.strip()

    if not os.path.isfile(CSV):
        for ss in SSLIST:
            job = splunk.search.dispatch(' | savedsearch %s' % ss, sessionKey=token, namespace=APP_NAME)
            splunk.search.waitForJob(job)
            job.cancel()

