"""
JSON 容错解析 + AgentOS workflow 入参解析。
"""
import json
import re
import logging
from typing import Any, Dict, Optional, Type, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar('T')

_PARSE_FAILED = object()


def strip_markdown_fences(text: str) -> str:
    """移除 LLM 输出中的 markdown 代码块标记"""
    text = text.strip()
    text = re.sub(r'^```[a-zA-Z]*\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    return text.strip()


def safe_parse_json(
    text: str,
    expected_type: Type[T] = dict,
    fallback: Optional[Any] = None,
) -> Any:
    """
    容错解析 LLM 输出的 JSON 字符串。

    处理 markdown 代码块、空白、期望 list 但收到 dict 时自动包装。
    """
    if not isinstance(text, str):
        if isinstance(text, expected_type):
            return text
        return fallback

    cleaned = strip_markdown_fences(text)

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.warning(f"[safe_parse_json] JSON parse failed: {e}. Input preview: {cleaned[:200]}")
        if fallback is None and expected_type == list:
            return []
        if fallback is None and expected_type == dict:
            return {}
        return fallback

    if expected_type == list and isinstance(result, dict):
        logger.info("[safe_parse_json] Got dict but expected list, wrapping in list")
        return [result]

    return result


def parse_workflow_input(raw_input: Any) -> Dict[str, Any]:
    """Parse Agno workflow input (dict or JSON/text string) into a dict."""
    if isinstance(raw_input, dict):
        return raw_input
    if isinstance(raw_input, str):
        result = safe_parse_json(raw_input, expected_type=dict, fallback=_PARSE_FAILED)
        if result is not _PARSE_FAILED and isinstance(result, dict):
            return result
        return {"text": raw_input}
    return {}
