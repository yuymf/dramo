"""
Configuration management for AgentOS
"""
import os
import logging

from env_loader import load_backend_env

logger = logging.getLogger(__name__)

load_backend_env()


def _needs_system_role(base_url: str) -> bool:
    """Check if the API endpoint requires 'system' role instead of 'developer'.

    Agno >= 2.5 defaults to sending system prompts as role='developer' (OpenAI convention),
    but many OpenAI-compatible providers (Hunyuan, DeepSeek, Moonshot, etc.) only accept
    the standard 'system' role.
    """
    if not base_url:
        return False
    lower = base_url.lower()
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
