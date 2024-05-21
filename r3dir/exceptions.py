class BaseCoderError(Exception):
    """Base class for r3dir encoding/decoding errors"""

class TooLongTarget(BaseCoderError):
    """Too long target to encode via domain-based redirection"""

class WrongEncodedURLFormat(BaseCoderError):
    """Wrong format of domain to decode"""

class Base32DecodingError(WrongEncodedURLFormat):
    """Base32-encoded target decoding error"""

class StatusCodeNotInRangeError(WrongEncodedURLFormat):
    """Status code is not in [200, 600) range"""