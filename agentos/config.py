"""Per-request OpenAI-compatible model factory."""
import os


def _needs_system_role(base_url: str) -> bool:
    """Many OpenAI-compatible hosts reject Agno's default role='developer'."""
    if not base_url:
        return False
    lower = base_url.lower()
    hosts = ("hunyuan", "deepseek", "moonshot", "kimi", "dashscope", "zhipu", "baichuan")
    return any(host in lower for host in hosts)


def get_model_from_config(llm_config: dict) -> "OpenAIChat":
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
