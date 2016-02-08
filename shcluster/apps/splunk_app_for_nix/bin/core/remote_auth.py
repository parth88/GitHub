import base64
import md5
import os
import random
import string
import time

from M2Crypto import RSA

import splunk.rest as rest
import splunk.entity as en
from core.manager import logger

#ENDPOINT = 'configs/conf-remote_peers'
REMOTE_ENDPOINT = '/services/admin/auth-tokens'
SPLUNK_HOME = os.environ['SPLUNK_HOME']
PRIV_KEY_PATH = os.path.join(SPLUNK_HOME, 'etc', 'auth', 'distServerKeys', 'private.pem') 

def call_peer(remote_host, remote_user, local_host, local_user, ts, nonce, signature):
    ''' make remote REST call to retreive foreign sessionKey '''
    postargs = {
        'name': '_create',
        'userid': local_user,
        'peername': local_host,
        'username': remote_user,
        'ts': ts,
        'nonce': nonce,
        'sig': signature
    }
    
    resp, cont = rest.simpleRequest(remote_host + REMOTE_ENDPOINT, postargs=postargs)

    if resp.status not in [200, 201]:
        logger.error('unable to get session key from remote peer %s' % remote_host)
        
        return None

    try:
        atomEntry = rest.format.parseFeedDocument(cont)
        ret = atomEntry.toPrimitive()[remote_user][remote_user]
        return ret
    except Exception, ex:
        logger.error('unable to parse response from remote peer %s' % remote_host)
        logger.exception(ex) 
        return None

def gen_nonce(local_user):
    ''' generate a nonce '''
    asc_time = time.asctime(time.localtime())
    rand_num = gen_rand()
    return md5.md5(''.join([asc_time, local_user, rand_num])).hexdigest()

def gen_rand(size=256, chars=string.ascii_uppercase + string.digits):
    ''' 
    http://stackoverflow.com/questions/2257441/python-random-string-generation-with-upper-case-letters-and-digits 
    '''
    return ''.join(random.choice(chars) for x in range(size))

def gen_sig(rsa, local_user, remote_user, nonce, ts):
    ''' generate a signature '''
    plain_text = ''.join([local_user, remote_user, nonce, ts])
    return base64.b64encode(rsa.private_encrypt(plain_text, RSA.pkcs1_padding))

def get_private_key():
    ''' load local instance private key and return rsa instance ''' 
    try:
        return RSA.load_key(PRIV_KEY_PATH)
    except Exception, ex:
        logger.error('unable to load private key %s' % PRIV_KEY_PATH)
        logger.debug(ex)
        return None 

def get_remote_token(remote_host, remote_user, local_host, local_user):
    nonce = gen_nonce(local_user)
    ts = str(time.mktime(time.gmtime()))[:-2]
    rsa = get_private_key()
    if rsa is None:
        return rsa 
    signature = gen_sig(rsa, local_user, remote_user, nonce, ts)
    
    return call_peer(remote_host, remote_user, local_host, local_user, ts, nonce, signature) 

def get_local_host(host_path, sessionKey):
    return en.getEntity('/server/info', 'server-info', sessionKey=sessionKey, hostPath=host_path).properties['serverName']
    
