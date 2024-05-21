import math, base64, binascii
import unishox2
import hashlib

from .exceptions import Base32DecodingError, StatusCodeNotInRangeError, WrongEncodedURLFormat, TooLongTarget

MAX_DOMAIN_LENGTH = 253
MAX_SUBDOMAIN_LENGTH = 63
IGNORE_PART_SEP = "--"
MAX_COMPRESSION_TARGET_SIZE = 1024 # we assume that compression rate can't go futher than 85% on usefull links(1024*0.15*8/5=245,76)

def _chunkstring(string: str, length: int) -> tuple[str]:
    """Helper function, which split string in several chunks not great than indicated lenght"""

    return (string[0+i:length+i] for i in range(0, len(string), length))

def _b32encode_dns(string: str) -> tuple:
    """Base32 encoding of string with Unishox2 compression. Accept string to encode.
       Returns tuple of chunked encoded data, spllited to be used as subdomains"""

    data, _ = unishox2.compress(string)
    encoded_string = base64.b32encode(data).decode('ascii')

    #stripping '=' to save characters in subdomains
    encoded_string = encoded_string.rstrip("=").lower()
    #splitting in chunks due to subdomain length limitations
    subdomains = _chunkstring(encoded_string, MAX_SUBDOMAIN_LENGTH)
    return tuple(subdomains)

def _b32decode_dns(subdomains: tuple | list) -> str:
    """Base32 decoding with unishox2 compression. Accept tuple of subdomains,
       containing encoded string. Returns decoded and decompresed string"""
    
    encoded_string = "".join(subdomains)

    #padding Base32 for error-less decoding
    pad_length = math.ceil(len(encoded_string) / 8) * 8 - len(encoded_string)
    encoded_target = encoded_string + "=" * pad_length

    decoded_data = base64.b32decode(encoded_target, casefold = True)
    decompresed_data = unishox2.decompress(decoded_data, MAX_COMPRESSION_TARGET_SIZE)
    return decompresed_data

def _is_too_long_target_error(encoded_subdomains: tuple | list):
    """Detects targets, which was too long to encode but tool was used in """
    for domain in encoded_subdomains:
        if domain.startswith("too-long-target-"):
            target_url_hash = domain.replace("too-long-target-", "") 
            return target_url_hash
    return False

def encode(target: str, status_code: int, main_domain: str, 
            ignore_part: str | None = None, https_enforced: bool = False, slient_mode: bool = False) -> str:
    """"r3dir encoder method. Accepts redirection target, status code of redirect
        and main_domain of used redirection server. Returns domain with encoded target.
        For optional parameters description, reference CLI tool help."""

    subdomains = ".".join(_b32encode_dns(target))
    
    encoded_domain = f"{subdomains}.{status_code}.{main_domain}"

    #check whether encoded domain length corresponds to limitations of DNS and TLS certificates
    try:
        if https_enforced:
            if ignore_part or len(subdomains) > MAX_SUBDOMAIN_LENGTH:
                raise TooLongTarget(f"The target length is longer than maximum allowed for HTTPS mode. Remove ignoring part, or short the target.")
        elif ignore_part:
            encoded_domain = f"{ignore_part}.{IGNORE_PART_SEP}.{encoded_domain}"

        if len(encoded_domain) > MAX_DOMAIN_LENGTH:
            raise TooLongTarget(f"The target length is longer than maximum allowed. Remove ignoring part or short the target.")
    except TooLongTarget:
        if not slient_mode:
            raise
        target_hash = hashlib.sha1(target.encode("UTF-8")).hexdigest()
        error_domain = f"too-long-target-{target_hash}.{status_code}.{main_domain}"
        return error_domain
    
    return encoded_domain

def decode(domain: str, main_domain: str) -> tuple[str, int]:
    """"r3dir decoder method. Accepts encoded domain and main domain of the redirection server.
        Returns redirection target and status code for redirect responce"""

    subdomains = domain.split('.')

    main_domain_chunk_count = len(main_domain.split('.'))

    subdomains_without_main = subdomains[:-main_domain_chunk_count]
    
    start_of_encoded_target = 0
    if IGNORE_PART_SEP in subdomains_without_main:
        start_of_encoded_target = len(subdomains_without_main) - subdomains_without_main[::-1].index(IGNORE_PART_SEP)
    
    encoded_subdomains = subdomains_without_main[start_of_encoded_target:]

    if target_url_hash := _is_too_long_target_error(encoded_subdomains):
        raise TooLongTarget(f"The target length has been too long for encoder. Target's SHA-1: {target_url_hash}")

    try:
        status_code = int(encoded_subdomains[-1])
    except (IndexError, ValueError) as e:
        raise WrongEncodedURLFormat("Can't read status code.")
    if status_code not in range(200, 600):
        raise StatusCodeNotInRangeError("Status code is not in [200, 600) range")
    
    try:
        target = _b32decode_dns(encoded_subdomains[:-1])
    except (UnicodeDecodeError, binascii.Error) as e:
        raise Base32DecodingError("Base32-encoded target decoding error")
    
    return target, status_code

