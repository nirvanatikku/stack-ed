__author__ = "Richie Foreman <richie.foreman@gmail.com>"

import os
import time
import logging
import httplib2
import json
import base64

try:
    from Crypto.Signature import PKCS1_v1_5
    from Crypto.Hash import SHA256
    from Crypto.PublicKey import RSA
except:
    ImportError("You need to enable or install PyCrypto, if you're in AppEngine you need to declare it in app.yaml.  There's also a bug that prevents this from currently working in dev_appserver: http://code.google.com/p/googleappengine/issues/detail?id=7998")

from oauth2client.client import AssertionCredentials
from oauth2client.client import MemoryCache
# why is the decoder in oauth2client.client -- and the encoder in oauth2client.crypt?
from oauth2client.client import _urlsafe_b64decode

# oauth2client.crypt should be refactored to not expect openssl
# from oauth2client.crypt import make_signed_jwt
# from oauth2client.crypt import _urlsafe_b64encode
# from oauth2client.crypt import _json_encode

def _json_encode(data):
    return json.dumps(data, separators = (',', ':'))

def _urlsafe_b64encode(raw_bytes):
    return base64.urlsafe_b64encode(raw_bytes).rstrip('=')

def make_signed_jwt(signer, payload):
    """Make a signed JWT.

    See http://self-issued.info/docs/draft-jones-json-web-token.html.

    Args:
      signer: crypt.Signer, Cryptographic signer.
      payload: dict, Dictionary of data to convert to JSON and then sign.

    Returns:
      string, The JWT for the payload.
    """
    header = {'typ': 'JWT', 'alg': 'RS256'}

    segments = [
        _urlsafe_b64encode(_json_encode(header)),
        _urlsafe_b64encode(_json_encode(payload)),
        ]
    signing_input = '.'.join(segments)

    signature = signer.sign(signing_input)
    segments.append(_urlsafe_b64encode(signature))

    logging.debug(str(segments))

    return '.'.join(segments)


CLOCK_SKEW_SECS = 300  # 5 minutes in seconds
AUTH_TOKEN_LIFETIME_SECS = 300  # 5 minutes in seconds
MAX_TOKEN_LIFETIME_SECS = 86400  # 1 day in seconds
ID_TOKEN_VERIFICATON_CERTS = 'https://www.googleapis.com/oauth2/v1/certs'

class AppIdentityError(Exception):
    pass

class PyCryptoVerifier(object):
    """Verifies the signature on a message."""

    def __init__(self, pubkey):
        """Constructor.

        Args:
          pubkey, Crypto.PublicKey to sign with
        """
        self._pubkey = pubkey

    def verify(self, message, signature):
        """Verifies a message against a signature.

        Args:
          message: string, The message to verify.
          signature: string, The signature on the message.

        Returns:
          True if message was singed by the private key associated with the public
          key that this object was constructed with.
        """
        try:
            logging.info(message)
            logging.info(signature)
            sha = SHA256.new(message)
            verifier = PKCS1_v1_5.PKCS115_SigScheme(self._pubkey)
            verifier.verify(sha, signature)
            return True
        except:
            raise
            return False

    @staticmethod
    def from_string(key_pem, is_x509_cert=False):
        pubkey = RSA.importKey(key_pem)
        return PyCryptoVerifier(pubkey)

class PyCryptoSigner(object):
    """Uses PyCrypto to sign messages with a private key in native Python."""

    def __init__(self, pkey):
        """Constructor.

        Args:
          pkey, Crypto.PublicKey to sign with
        """
        self._key = pkey

    def sign(self, message):
        """Signs a message.

        Args:
          message: string, Message to be signed.

        Returns:
          string, The signature of the message for the given key.
        """

        # SHA256 our message
        sha = SHA256.new(message)

        # Sign it with our PKCS8 key
        signer = PKCS1_v1_5.PKCS115_SigScheme(self._key)
        return signer.sign(sha)

    @staticmethod
    def from_string(key, password='notasecret'):
        """Construct a Signer instance from a string.

        Args:
          key: string, private key in PEM format.
          password: string, password for the private key file.

        Returns:
          Signer instance.

        Raises:
          ValueError if the key is in the wrong format.
        """
        pkey = RSA.importKey(key, password)
        return PyCryptoSigner(pkey)


class PyCryptoSignedJwtAssertionCredentials(AssertionCredentials):
    """Credentials object used for OAuth 2.0 Signed JWT assertion grants.

    This object utilizes PyCrypto for native python signing that is compatible with AppEngine environments.

    Pycrypto does not support the PKCS12 mechanism used by SignedJwtAssertionCredentials, so the key must be in PEM format

    This credential does not require a flow to instantiate because it
    represents a two legged flow, and therefore has all of the required
    information to generate and refresh its own access tokens.
    """

    MAX_TOKEN_LIFETIME_SECS = 3600 # 1 hour in seconds

    def __init__(self,
                 service_account_name,
                 private_key,
                 scope,
                 private_key_password='notasecret',
                 user_agent=None,
                 token_uri='https://accounts.google.com/o/oauth2/token',
                 **kwargs):
        """Constructor for SignedJwtAssertionCredentials.

           Args:
             service_account_name: string, id for account, usually an email address.
             private_key: string, private key in P12 format.
             scope: string or list of strings, scope(s) of the credentials being
               requested.
             private_key_password: string, password for private_key.
             user_agent: string, HTTP User-Agent to provide for this application.
             token_uri: string, URI for token endpoint. For convenience
               defaults to Google's endpoints but any OAuth 2.0 provider can be used.
             kwargs: kwargs, Additional parameters to add to the JWT token, for
               example prn=joe@xample.org."""

        super(PyCryptoSignedJwtAssertionCredentials, self).__init__(
            'http://oauth.net/grant_type/jwt/1.0/bearer',
            user_agent,
            token_uri=token_uri,
            )

        if type(scope) is list:
            scope = ' '.join(scope)
        self.scope = scope

        self.private_key = private_key
        self.private_key_password = private_key_password
        self.service_account_name = service_account_name
        self.kwargs = kwargs

    @classmethod
    def from_json(cls, s):
        data = json.loads(s)
        retval = PyCryptoSignedJwtAssertionCredentials(
            data['service_account_name'],
            data['private_key'],
            data['scope'],
            data['private_key_password'],
            data['user_agent'],
            data['token_uri'],
            **data['kwargs']
        )
        retval.invalid = data['invalid']
        return retval

    def _generate_assertion(self):
        """Generate the assertion that will be used in the request."""
        now = long(time.time())
        payload = {
            'aud':self.token_uri,
            'scope':self.scope,
            'iat':now,
            'exp':now + PyCryptoSignedJwtAssertionCredentials.MAX_TOKEN_LIFETIME_SECS,
            'iss':self.service_account_name
        }
        payload.update(self.kwargs)

        logging.info(str(payload))

        jwt = make_signed_jwt(PyCryptoSigner.from_string(self.private_key, self.private_key_password), payload)

        return jwt


def verify_signed_jwt_with_certs(jwt, certs, audience):
    """Verify a JWT against public certs.

    See http://self-issued.info/docs/draft-jones-json-web-token.html.

    Args:
      jwt: string, A JWT.
      certs: dict, Dictionary where values of public keys in PEM format.
      audience: string, The audience, 'aud', that this JWT should contain. If
        None then the JWT's 'aud' parameter is not verified.

    Returns:
      dict, The deserialized JSON payload in the JWT.

    Raises:
      AppIdentityError if any checks are failed.
    """
    segments = jwt.split('.')

    if (len(segments) != 3):
        raise AppIdentityError(
            'Wrong number of segments in token: %s' % jwt)
    signed = '%s.%s' % (segments[0], segments[1])

    signature = _urlsafe_b64decode(segments[2])

    # Parse token.
    json_body = _urlsafe_b64decode(segments[1])
    try:
        parsed = json.loads(json_body)
    except:
        raise AppIdentityError('Can\'t parse token: %s' % json_body)

    # Check signature.
    verified = False
    for (keyname, pem) in certs.items():
        verifier = PyCryptoVerifier.from_string(pem, True)
        if (verifier.verify(signed, signature)):
            verified = True
            break
    if not verified:
        raise AppIdentityError('Invalid token signature: %s' % jwt)

    # Check creation timestamp.
    iat = parsed.get('iat')
    if iat is None:
        raise AppIdentityError('No iat field in token: %s' % json_body)
    earliest = iat - CLOCK_SKEW_SECS

    # Check expiration timestamp.
    now = long(time.time())
    exp = parsed.get('exp')
    if exp is None:
        raise AppIdentityError('No exp field in token: %s' % json_body)
    if exp >= now + MAX_TOKEN_LIFETIME_SECS:
        raise AppIdentityError(
            'exp field too far in future: %s' % json_body)
    latest = exp + CLOCK_SKEW_SECS

    if now < earliest:
        raise AppIdentityError('Token used too early, %d < %d: %s' %
                               (now, earliest, json_body))
    if now > latest:
        raise AppIdentityError('Token used too late, %d > %d: %s' %
                               (now, latest, json_body))

    # Check audience.
    if audience is not None:
        aud = parsed.get('aud')
        if aud is None:
            raise AppIdentityError('No aud field in token: %s' % json_body)
        if aud != audience:
            raise AppIdentityError('Wrong recipient, %s != %s: %s' %
                                   (aud, audience, json_body))

    return parsed


_cached_http = httplib2.Http(MemoryCache())

def verify_id_token(id_token, audience, http=None,
                    cert_uri=ID_TOKEN_VERIFICATON_CERTS):
    """Verifies a signed JWT id_token.


    Args:
      id_token: string, A Signed JWT.
      audience: string, The audience 'aud' that the token should be for.
      http: httplib2.Http, instance to use to make the HTTP request. Callers
        should supply an instance that has caching enabled.
      cert_uri: string, URI of the certificates in JSON format to
        verify the JWT against.

    Returns:
      The deserialized JSON in the JWT.

    Raises:
      AppIdentityError if the JWT fails to verify.
    """
    if http is None:
        http = _cached_http

    resp, content = http.request(cert_uri)

    if resp.status == 200:
        certs = json.loads(content)
        return verify_signed_jwt_with_certs(id_token, certs, audience)
    else:
        raise VerifyJwtTokenError('Status code: %d' % resp.status)