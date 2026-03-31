"""
Configuration management for AgentOS
"""
import os
import logging
from pathlib import Path
from dotenv import set_key, find_dotenv

try:
    from .env_loader import DEFAULT_ENV_PATH, load_backend_env
except ImportError:
    from env_loader import DEFAULT_ENV_PATH, load_backend_env

logger = logging.getLogger(__name__)

# Load environment variables
load_backend_env()

def get_ai_provider() -> str:
    """Get current AI provider"""
    return os.getenv("AI_PROVIDER", "openai").lower()

def set_ai_provider(provider: str) -> bool:
    """
    Set AI provider in .env file
    
    Args:
        provider: 'openai' or 'hunyuan'
    
    Returns:
        True if successful, False otherwise
    """
    provider = provider.lower()
    if provider not in ["openai", "hunyuan"]:
        logger.error(f"Invalid provider: {provider}")
        return False
    
    try:
        env_path: Path | None = None

        if DEFAULT_ENV_PATH.exists():
            env_path = DEFAULT_ENV_PATH
        else:
            found = find_dotenv()
            if found:
                env_path = Path(found)

        if not env_path:
            logger.error(".env file not found")
            return False
        
        set_key(str(env_path), "AI_PROVIDER", provider)
        os.environ["AI_PROVIDER"] = provider
        logger.info(f"AI provider set to: {provider}")
        return True
    except Exception as e:
        logger.error(f"Failed to set AI provider: {e}")
        return False

def get_provider_config() -> dict:
    """Get configuration for current AI provider"""
    provider = get_ai_provider()
    
    if provider == "hunyuan":
        return {
            "provider": "hunyuan",
            "model_id": os.getenv("HUNYUAN_MODEL_ID", "hunyuan-turbos-latest"),
            "api_key": os.getenv("HUNYUAN_OPENAPI_KEY"),
            "base_url": os.getenv("HUNYUAN_OPENAPI_URL")
        }
    else:  # Default to OpenAI
        return {
            "provider": "openai",
            "model_id": os.getenv("OPENAI_MODEL_ID", "gpt-4-turbo-preview"),
            "api_key": os.getenv("OPENAI_API_KEY"),
            "base_url": os.getenv("OPENAI_API_BASE")
        }

def get_available_providers() -> list:
    """Get list of available AI providers with their status"""
    providers = []

    # Check OpenAI
    openai_available = bool(os.getenv("OPENAI_API_KEY"))
    providers.append({
        "name": "openai",
        "display_name": "OpenAI",
        "available": openai_available,
        "model": os.getenv("OPENAI_MODEL_ID", "gpt-4-turbo-preview"),
        "active": get_ai_provider() == "openai"
    })

    # Check Hunyuan
    hunyuan_available = bool(os.getenv("HUNYUAN_OPENAPI_KEY") and os.getenv("HUNYUAN_OPENAPI_URL"))
    providers.append({
        "name": "hunyuan",
        "display_name": "Hunyuan",
        "available": hunyuan_available,
        "model": os.getenv("HUNYUAN_MODEL_ID", "hunyuan-turbos-latest"),
        "active": get_ai_provider() == "hunyuan"
    })

    return providers

def _needs_system_role(base_url: str) -> bool:
    """Check if the API endpoint requires 'system' role instead of 'developer'.

    Agno >= 2.5 defaults to sending system prompts as role='developer' (OpenAI convention),
    but many OpenAI-compatible providers (Hunyuan, DeepSeek, Moonshot, etc.) only accept
    the standard 'system' role.
    """
    if not base_url:
        return False
    lower = base_url.lower()
    # Known providers that require 'system' role
    _NON_OPENAI_HOSTS = ("hunyuan", "deepseek", "moonshot", "kimi", "dashscope", "zhipu", "baichuan")
    return any(host in lower for host in _NON_OPENAI_HOSTS)


def get_model_from_config(llm_config: dict) -> "OpenAIChat":
    """
    Create an OpenAIChat model from per-request LLM config.

    Args:
        llm_config: dict with api_key, base_url, model_id

    Returns:
        OpenAIChat instance configured with user's credentials
    """
    from agno.models.openai import OpenAIChat

    timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "90"))
    max_retries = int(os.getenv("LLM_MAX_RETRIES", "2"))

    base_url = llm_config["base_url"]

    # Override role_map for providers that don't support 'developer' role.
    # Must include ALL roles — partial maps cause KeyError in Agno.
    role_map = (
        {"system": "system", "user": "user", "assistant": "assistant", "tool": "tool", "model": "assistant"}
        if _needs_system_role(base_url)
        else None
    )

    return OpenAIChat(
        id=llm_config["model_id"],
        api_key=llm_config["api_key"],
        base_url=base_url,
        timeout=timeout,
        max_retries=max_retries,
        role_map=role_map,
    )


def get_long_timeout_model(llm_config: dict) -> "OpenAIChat":
    """Create an OpenAIChat model with extended timeout for heavy prompts.

    Used by detail_refiner (Phase 3) which concatenates panels + cinematography +
    acting + clip content into a single large prompt that can exceed the standard
    90s timeout on slower API providers.

    Reads from LLM_TIMEOUT_LONG_SECONDS (default: 180s).
    """
    from agno.models.openai import OpenAIChat

    timeout = float(os.getenv("LLM_TIMEOUT_LONG_SECONDS", "180"))
    max_retries = int(os.getenv("LLM_MAX_RETRIES", "2"))

    base_url = llm_config["base_url"]
    role_map = (
        {"system": "system", "user": "user", "assistant": "assistant", "tool": "tool", "model": "assistant"}
        if _needs_system_role(base_url)
        else None
    )

    return OpenAIChat(
        id=llm_config["model_id"],
        api_key=llm_config["api_key"],
        base_url=base_url,
        timeout=timeout,
        max_retries=max_retries,
        role_map=role_map,
    )

