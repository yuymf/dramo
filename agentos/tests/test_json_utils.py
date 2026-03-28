import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.json_utils import safe_parse_json, strip_markdown_fences

class TestStripMarkdownFences:
    def test_strips_json_fence(self):
        raw = "```json\n[{\"a\": 1}]\n```"
        assert strip_markdown_fences(raw) == '[{"a": 1}]'

    def test_strips_plain_fence(self):
        raw = "```\n[{\"a\": 1}]\n```"
        assert strip_markdown_fences(raw) == '[{"a": 1}]'

    def test_passthrough_clean_json(self):
        raw = '[{"a": 1}]'
        assert strip_markdown_fences(raw) == '[{"a": 1}]'

    def test_strips_non_json_language_fence(self):
        """Fix for HIGH issue: LLMs emit ```python, ```javascript etc."""
        raw = "```python\n[{\"a\": 1}]\n```"
        assert strip_markdown_fences(raw) == '[{"a": 1}]'

class TestSafeParseJson:
    def test_parses_clean_list(self):
        result = safe_parse_json('[{"name": "李明"}]', expected_type=list)
        assert result == [{"name": "李明"}]

    def test_parses_after_stripping_fence(self):
        raw = '```json\n[{"name": "李明"}]\n```'
        result = safe_parse_json(raw, expected_type=list)
        assert result == [{"name": "李明"}]

    def test_returns_fallback_on_invalid(self):
        result = safe_parse_json("not json", expected_type=list, fallback=[])
        assert result == []

    def test_wraps_dict_in_list_when_list_expected(self):
        result = safe_parse_json('{"name": "李明"}', expected_type=list)
        assert result == [{"name": "李明"}]

    def test_parses_dict(self):
        result = safe_parse_json('{"scenes": []}', expected_type=dict)
        assert result == {"scenes": []}

    def test_implicit_list_fallback_on_invalid_json(self):
        """Implicit None→[] fallback when fallback param not provided."""
        result = safe_parse_json("not json at all", expected_type=list)
        assert result == []

    def test_implicit_dict_fallback_on_invalid_json(self):
        """Implicit None→{} fallback when fallback param not provided."""
        result = safe_parse_json("not json at all", expected_type=dict)
        assert result == {}
