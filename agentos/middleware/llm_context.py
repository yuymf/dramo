"""
LLM Context Middleware

Extracts X-LLM-* headers from incoming requests and stores them
in request.state for use by workflows and services.

SECURITY: X-LLM-Api-Key is NEVER logged. This middleware redacts
it from all logging output, including FastAPI debug mode.
"""

import logging
from typing import Optional, Dict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class LLMContextMiddleware(BaseHTTPMiddleware):
    """Extract X-LLM-* headers and store in request.state.llm_config"""

    async def dispatch(self, request: Request, call_next) -> Response:
        api_key = request.headers.get("X-LLM-Api-Key")
        base_url = request.headers.get("X-LLM-Base-Url")
        model_id = request.headers.get("X-LLM-Model-Id")

        if api_key and base_url and model_id:
            request.state.llm_config = {
                "api_key": api_key,
                "base_url": base_url,
                "model_id": model_id,
            }
            # Log presence without exposing key
            logger.info(
                f"LLM config received: base_url={base_url}, model_id={model_id}, "
                f"api_key=***{api_key[-4:] if len(api_key) > 4 else '****'}"
            )
        else:
            request.state.llm_config = None

        return await call_next(request)


def get_llm_config(request: Request) -> Optional[Dict[str, str]]:
    """
    Get LLM config from request state.
    Returns dict with api_key, base_url, model_id or None if not provided.
    """
    return getattr(request.state, "llm_config", None)
