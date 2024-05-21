from starlette.applications import Starlette
from starlette.routing import Route
from starlette.responses import RedirectResponse
from starlette.middleware import Middleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.config import Config
from starlette.exceptions import HTTPException
from loguru import logger
import sys

import r3dir.encoder
from r3dir.exceptions import Base32DecodingError, StatusCodeNotInRangeError, WrongEncodedURLFormat, TooLongTarget

async def parameter_redirect(request):
    domain = request.url.hostname
    try:
        _, code = r3dir.encoder.decode(domain, MAIN_DOMAIN)
    except (Base32DecodingError, StatusCodeNotInRangeError, WrongEncodedURLFormat, TooLongTarget) as e:
        raise HTTPException(400, detail = f"{request.url} -> {e}\n" + PARAMETER_BASED_CORRECT_FORMAT)
    try:
        redirect_target = request.query_params['url']
    except KeyError:
        raise HTTPException(400, detail = f"Follow next format: IGNORING.PART.--.STATUS_CODE.{MAIN_DOMAIN}/--to/?url=TARGET_URL")
    logger.success(f"{request.url} -> {redirect_target, code}")
    return RedirectResponse(redirect_target, status_code = code)

async def domain_redirect(request):
    domain = request.url.hostname
    try:
        redirect_target, code = r3dir.encoder.decode(domain, MAIN_DOMAIN)
    except TooLongTarget as e:
        raise HTTPException(414, detail = f"{e}")
    except (Base32DecodingError, StatusCodeNotInRangeError, WrongEncodedURLFormat) as e:
        raise HTTPException(400, detail = f"{domain} -> {e}\n" + DOMAIN_BASED_CORRECT_FORMAT)
    logger.success(f"{request.url} -> {redirect_target, code}")
    return RedirectResponse(redirect_target, status_code = code)

config = Config()

MAIN_DOMAIN = config("MAIN_DOMAIN")

DOMAIN_BASED_CORRECT_FORMAT = f"Follow next format: IGNORING.PART.--.ENCODED.TARGET.STATUS_CODE.{MAIN_DOMAIN}"
PARAMETER_BASED_CORRECT_FORMAT = f"Follow next format: IGNORING.PART.--.STATUS_CODE.{MAIN_DOMAIN}/--to/?url=TARGET_URL"

logger.add(sys.stdout, format="<m>{level}</>:  <b>{message}</> | {time}", colorize=True)

ALL_METHODS = ("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "CONNECT")

middleware = [
    Middleware(TrustedHostMiddleware, allowed_hosts=[f'*.{MAIN_DOMAIN}']),
    Middleware(CORSMiddleware, allow_origin_regex='.*', allow_methods = ['*'],
                allow_credentials = True, allow_headers=['*'])
]

routes = [
    Route('/--to/', parameter_redirect, methods = ALL_METHODS), 
    Route('/{rest_of_path:path}', domain_redirect, methods = ALL_METHODS) 
]

app = Starlette(routes=routes, middleware=middleware)
