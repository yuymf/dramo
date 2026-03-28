"""
JSON 容错解析工具
处理 LLM 输出的常见格式噪声：markdown 代码块、额外空白、单dict包装等
"""
import json
import re
import logging
from typing import Any, Optional, Type, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar('T')


def strip_markdown_fences(text: str) -> str:
    """移除 LLM 输出中的 markdown 代码块标记"""
    text = text.strip()
    # 匹配 ```json ... ``` 或 ``` ... ```
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

    处理：
    - markdown 代码块包裹
    - 前后多余空白
    - 期望 list 但收到 dict 时自动包装

    Args:
        text: LLM 返回的原始字符串
        expected_type: 期望的顶层类型，list 或 dict
        fallback: 解析失败时的默认值，默认 None

    Returns:
        解析结果，失败时返回 fallback
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

    # 期望 list 但收到 dict 时自动包装
    if expected_type == list and isinstance(result, dict):
        logger.info("[safe_parse_json] Got dict but expected list, wrapping in list")
        return [result]

    return result
