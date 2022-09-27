import math, base64, binascii, argparse
from urllib.parse import urlsplit, urlunsplit, urlencode, parse_qsl
from .exceptions import Base32DecodingError, StatusCodeNotInRangeError, WrongEncodedURLFormat, TooLongTarget

MAX_DOMAIN_LENGTH = 253
MAX_SUBDOMAIN_LENGTH = 63
IGNORE_PART_SEP = "--"

def _attach(url: str, path: str = "", query: str = "", fragment: str = "") -> str:
    parsed_url = urlsplit(url)
    updated_url = parsed_url._replace(path = parsed_url.path + path,
                                        query = parsed_url.query + query,
                                        fragment = parsed_url.fragment + fragment)
    return urlunsplit(updated_url)

def _chunkstring(string: str, length: int) -> tuple[str, int]:
    return (string[0+i:length+i] for i in range(0, len(string), length))

def _b32encode_dns(string: str) -> tuple:
    encoded_string = base64.b32encode(string.encode('UTF-8')).decode('ascii')
    encoded_string = encoded_string.rstrip("=").lower()
    subdomains = _chunkstring(encoded_string, MAX_SUBDOMAIN_LENGTH)
    return tuple(subdomains)

def _b32decode_dns(subdomains: tuple) -> str:
    encoded_string = "".join(subdomains)
    pad_length = math.ceil(len(encoded_string) / 8) * 8 - len(encoded_string)
    encoded_target = encoded_string + "=" * pad_length
    decoded_string = base64.b32decode(encoded_target, casefold = True).decode('UTF-8')
    return decoded_string

def _max_target_length(main_domain: str, status_code: int, ignore_part: str = None, https: bool = False) -> int:
    if https:
        return math.floor(MAX_SUBDOMAIN_LENGTH*(5/8))

    result = MAX_DOMAIN_LENGTH - (1 + len(str(status_code)) + 1 + len(main_domain))
    if ignore_part:
        result -= (len(ignore_part) + len(IGNORE_PART_SEP) + 2)
    result = (result - result // (MAX_SUBDOMAIN_LENGTH + 1))*(5/8)

    return math.floor(result)

def encode(target: str, status_code: int, main_domain: str, 
            ignore_part: str = None, full_url_allowed: bool = True, https_enforced: bool = False) -> str:
    mtl = _max_target_length(main_domain, status_code, ignore_part, https_enforced)
    splited = False

    if len(target) > mtl:
        if not full_url_allowed:
            raise TooLongTarget(f"The target length {len(target)} is longer than maximum allowed: {mtl}. Remove ignoring part, allow path attaching or short the target.")
        else:
            splited = True
            splited_target = urlsplit(target)
            striped_target = splited_target._replace(path = "", query = "", fragment = "").geturl()
            st_length = len(striped_target)
            if st_length > mtl:
                raise TooLongTarget(f"The target without the path and query: {st_length} is longer than maximum allowed: {mtl}. Remove ignoring part or short the target.")
            target = striped_target
     
    subdomains = ".".join(_b32encode_dns(target))
    
    if ignore_part:
        encoded_domain = f"{ignore_part}.{IGNORE_PART_SEP}.{subdomains}.{status_code}.{main_domain}"
    else:
        encoded_domain = f"{subdomains}.{status_code}.{main_domain}"


    if splited:
        encoded_host = _attach(f"//{encoded_domain}", f"/--attach{splited_target.path}", splited_target.query, splited_target.fragment)
        encoded_domain = encoded_host.lstrip("/")
        
    return encoded_domain

def decode(url: str, main_domain: str) -> tuple[str, int]:
    parsed_url = urlsplit(url)

    domain_parts = parsed_url.hostname.split('.')

    main_domain_chunk_count = len(main_domain.split('.'))
    
    start_of_encoded_target = 0
    if IGNORE_PART_SEP in domain_parts:
        start_of_encoded_target = len(domain_parts) - domain_parts[::-1].index(IGNORE_PART_SEP)
    
    subdomains = domain_parts[start_of_encoded_target : -main_domain_chunk_count]

    try:
        status_code = int(subdomains[-1])
    except (IndexError, ValueError) as e:
        raise WrongEncodedURLFormat("Can't read status code.")
    if status_code not in range(200, 600):
        raise StatusCodeNotInRangeError("Status code is not in [200, 600) range")
    
    try:
        decoded_string = _b32decode_dns(subdomains[:-1])
    except (UnicodeDecodeError, binascii.Error) as e:
        raise Base32DecodingError("Base32-encoded target decoding error")

    if parsed_url.path.startswith("/--attach/"): 
        target = _attach(decoded_string, parsed_url.path.replace('/--attach/', '', 1), parsed_url.query, parsed_url.fragment)
    else:
        target = decoded_string
    
    return target, status_code


def main():
    argParser = argparse.ArgumentParser(description='Encoded/decoder CLI tool for r3dir service')
    subparsers = argParser.add_subparsers(dest='mode', required=True, description="Encoding/decoding mode")

    encoder = subparsers.add_parser('encode', help="r3dir CLI encoder")

    https_opts = encoder.add_mutually_exclusive_group()

    encoder.add_argument('target_url', type = str,
                            help = "Target URL which r3dir tool should redirect to.")
    encoder.add_argument('-c', '--status_code', type = int,
                            default = 302,
                            help = f"HTTP status code of a redirect response.")
    encoder.add_argument('-d', '--main_domain', type = str,
                            default = "r3dir.me",
                            help = f"Domain where r3dir tool is hosted on.")
    encoder.add_argument("-a", '--attach', help="generate with /--attach/ feature",
                            action="store_true")                        
    https_opts.add_argument('-i', '--ignore_part', type = str,
                            default = None,
                            help = f"String, which will be ignored during decoding. Used to bypass weak REGEXs.")
    https_opts.add_argument("-s", "--https", help="HTTPS enforced encoding(TLS certificate length limitation)",
                            action="store_true")

    decoder = subparsers.add_parser('decode', help="r3dir CLI decoder")        

    decoder.add_argument('encoded_url', type = str,
                            help = "r3dir encoded URL to decode")
    decoder.add_argument('-d', '--main_domain', type = str,
                            default = "r3dir.me",
                            help = f"Domain where r3dir tool is hosted on.")

    args = argParser.parse_args()

    if args.mode == 'encode':
        print(encode(args.target_url, args.status_code, args.main_domain, args.ignore_part, full_url_allowed=args.attach, https_enforced = args.https))
    elif args.mode == 'decode':
        print(decode(args.encoded_url, args.main_domain))
