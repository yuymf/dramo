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

    return OpenAIChat(
        id=llm_config["model_id"],
        api_key=llm_config["api_key"],
        base_url=llm_config["base_url"],
        timeout=timeout,
        max_retries=max_retries,
    )

