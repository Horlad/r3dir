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

import app.coder.redirect_encoder as domain_coder
from app.coder.exceptions import Base32DecodingError, StatusCodeNotInRangeError, WrongEncodedURLFormat

async def parameter_redirect(request):
    input_url = str(request.url)
    try:
        _, code = domain_coder.decode(input_url, MAIN_DOMAIN)
    except (Base32DecodingError, StatusCodeNotInRangeError, WrongEncodedURLFormat) as e:
        raise HTTPException(400, detail = f"{input_url} -> {e}\n" + PARAMETER_BASED_CORRECT_FORMAT)
    try:
        redirect_target = request.query_params['url']
    except KeyError:
        raise HTTPException(400, detail = f"Follow next format: IGNORING.PART.--.STATUS_CODE.{MAIN_DOMAIN}/--to/?url=TARGET_URL")
    logger.success(f"{input_url} -> {redirect_target, code}")
    return RedirectResponse(redirect_target, status_code = code)

async def domain_redirect(request):
    input_url = str(request.url)
    try:
        redirect_target, code = domain_coder.decode(input_url, MAIN_DOMAIN)
    except (Base32DecodingError, StatusCodeNotInRangeError, WrongEncodedURLFormat) as e:
        raise HTTPException(400, detail = f"{input_url} -> {e}\n" + DOMAIN_BASED_CORRECT_FORMAT)
    logger.success(f"{input_url} -> {redirect_target, code}")
    return RedirectResponse(redirect_target, status_code = code)

config = Config()

MAIN_DOMAIN = config("MAIN_DOMAIN")

DOMAIN_BASED_CORRECT_FORMAT = f"Follow next format: IGNORING.PART.--.BASE32.ENCODED.TARGET.STATUS_CODE.{MAIN_DOMAIN}/--attach/ATTACHED/PATH?attached=ATTACKED_QUERY"
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
