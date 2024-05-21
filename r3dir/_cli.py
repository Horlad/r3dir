import os, re
import pyperclip
import pprint
import argparse
import json
from r3dir.encoder import encode, decode

hackvertor_tags_folder = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'hackvertor')

hackvertor_encoder = os.path.join(hackvertor_tags_folder, 'encoder.js')

tags = [
    {
        "argument1Default": "302",
        "argument2Default": "",
        "code": 'const mainDomain = "[[MAIN_DOMAIN]]";\nconst httpsEnforced = false;\noutput = encode(input, statusCode, mainDomain, ignorePart, httpsEnforced, true);',
        "argument1Type": "Number",
        "numberOfArgs": 2,
        "argument1": "statusCode",
        "argument2Type": "String",
        "argument2": "ignorePart",
        "language": "JavaScript",
        "tagName": "_r3dir_encode"
    },
    {
        "code": 'const mainDomain = "[[MAIN_DOMAIN]]";\noutput = decode(input, mainDomain);',
        "numberOfArgs": 0,
        "language": "JavaScript",
        "tagName": "_r3dir_decode"
    },
    {
        "argument1Default": "302",
        "argument2Default": "",
        "code": 'const mainDomain = "[[MAIN_DOMAIN]]";\nconst httpsEnforced = true;\noutput = encode(input, statusCode, mainDomain, ignorePart, httpsEnforced, true);',
        "argument1Type": "Number",
        "numberOfArgs": 2,
        "argument1": "statusCode",
        "argument2Type": "String",
        "argument2": "ignorePart",
        "language": "JavaScript",
        "tagName": "_r3dir_encode_https"
    }
]


def _prepare_hackvertor_tags(main_domain: str):
    """Prepare Hackvertor tags for given main domain"""

    # JS code injection prevetion
    if re.fullmatch("[A-Za-z0-9-\.]+", main_domain) is None:
        main_domain = "r3dir.me"
        
    with open(hackvertor_encoder, 'r', encoding='utf-8') as file:
        encoder_content = file.read()
    
    for tag in tags:
        #Append encode/decode functions to each tag
        path_to_tag = os.path.join(hackvertor_tags_folder, tag["tagName"] + ".js")
        code_to_append = tag['code'].replace("[[MAIN_DOMAIN]]", main_domain)
        with open(path_to_tag, 'w', encoding='utf-8') as file:
            file.write(f"{encoder_content}\n{code_to_append}")
        #Saving PATH to the tag into Hackvertor json
        tag['code'] = path_to_tag
    return tags

def _cli():
    argParser = argparse.ArgumentParser(description='Encoded/decoder CLI tool for r3dir service')

    argParser.add_argument('-d', '--main_domain', type = str,
                            default = "r3dir.me",
                            help = f"Domain where r3dir tool is hosted on (default: %(default)s)")
    
    subparsers = argParser.add_subparsers(dest='mode', required=True, description="Encoding/decoding mode or Hackvertor tags generation")

    encoder = subparsers.add_parser('encode', help="r3dir CLI encoder")

    https_opts = encoder.add_mutually_exclusive_group()

    encoder.add_argument('target_url', type = str,
                            help = "Target URL which r3dir tool should redirect to")
    encoder.add_argument('-c', '--status_code', type = int,
                            default = 302,
                            help = f"HTTP status code of a redirect response (default: %(default)s)")
                       
    https_opts.add_argument('-i', '--ignore_part', type = str,
                            default = None,
                            help = f"String, which will be ignored during decoding. Used to bypass weak REGEXs")
    https_opts.add_argument("-s", "--https", help="HTTPS enforced encoding(TLS certificate length limitation)",
                            action="store_true")
    encoder.add_argument("--slient_mode", help="Slient mode for automations (e.g Hackvertor tags)",
                            action="store_true")

    decoder = subparsers.add_parser('decode', help="r3dir CLI decoder")        

    decoder.add_argument('encoded_domain', type = str,
                            help = "r3dir encoded domain to decode")
    
    hackvertor = subparsers.add_parser('hackvertor', help="Generate r3dir Hackvertor tags and copy them to clipboard")

    hackvertor.add_argument("--print", help="Output Hackvertor tags into terminal",
                            action="store_true")

    args = argParser.parse_args()

    if args.mode == 'encode':
        print(encode(args.target_url, args.status_code, args.main_domain, args.ignore_part, https_enforced = args.https, slient_mode=args.slient_mode))
    elif args.mode == 'decode':
        print(decode(args.encoded_domain, args.main_domain))
    elif args.mode == 'hackvertor':
        prepared_tags = _prepare_hackvertor_tags(args.main_domain)
        pyperclip.copy(json.dumps(prepared_tags))
        print("[+] Hackvertor tags were copied to a clipboard.")
        if args.print:
            pprint.pprint(prepared_tags)


