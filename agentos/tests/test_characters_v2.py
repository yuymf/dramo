import pytest
import json
import sys
import os
from unittest.mock import patch, MagicMock
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from workflows.characters_workflow import CharactersWorkflow, _parse_input


class TestParseInput:
    def test_parses_dict(self):
        result = _parse_input({"text": "hello"})
        assert result == {"text": "hello"}

    def test_parses_json_string(self):
        result = _parse_input('{"text": "hello"}')
        assert result == {"text": "hello"}

    def test_returns_empty_on_invalid(self):
        result = _parse_input("not json")
        assert result == {"text": "not json"}

    def test_returns_empty_on_none(self):
        result = _parse_input(None)
        assert result == {}


class TestCharactersWorkflowInit:
    def test_initializes_without_error(self):
        wf = CharactersWorkflow()
        assert wf is not None

    def test_has_prompt_loaded(self):
        wf = CharactersWorkflow()
        assert hasattr(wf, '_system_prompt')
        assert "JSON 安全" in wf._system_prompt
        assert "role_level" in wf._system_prompt

    def test_output_schema_has_three_arrays(self):
        """Prompt should mention new_characters and updated_characters"""
        wf = CharactersWorkflow()
        assert "new_characters" in wf._system_prompt
        assert "updated_characters" in wf._system_prompt


class TestExtractCharacters:
    def _make_workflow(self):
        return CharactersWorkflow()

    def test_handles_dict_response(self):
        """LLM returns proper dict with new_characters"""
        wf = self._make_workflow()
        payload = {
            "characters": [],
            "new_characters": [{"name": "李明", "role_level": "lead"}],
            "updated_characters": [],
        }
        mock_resp = MagicMock()
        mock_resp.content = json.dumps(payload)

        with patch("workflows.characters_workflow.Agent") as MockAgent:
            MockAgent.return_value.run.return_value = mock_resp
            with patch("workflows.characters_workflow.get_model_from_config", return_value=MagicMock()):
                execution_input = MagicMock()
                execution_input.input = {"projectId": "p1", "text": "剧本内容", "_llm_config": {"provider": "openai"}}
                result_str = wf._extract_characters(wf, execution_input)

        result = json.loads(result_str)
        assert result["projectId"] == "p1"
        assert result["new_characters"] == [{"name": "李明", "role_level": "lead"}]

    def test_handles_list_response(self):
        """LLM returns bare list — should be wrapped in new_characters"""
        wf = self._make_workflow()
        payload = [{"name": "王芳", "role_level": "supporting"}]
        mock_resp = MagicMock()
        mock_resp.content = json.dumps(payload)

        with patch("workflows.characters_workflow.Agent") as MockAgent:
            MockAgent.return_value.run.return_value = mock_resp
            with patch("workflows.characters_workflow.get_model_from_config", return_value=MagicMock()):
                execution_input = MagicMock()
                execution_input.input = {"projectId": "p2", "text": "剧本内容", "_llm_config": {"provider": "openai"}}
                result_str = wf._extract_characters(wf, execution_input)

        result = json.loads(result_str)
        assert result["new_characters"] == [{"name": "王芳", "role_level": "supporting"}]
        assert result["characters"] == []

    def test_handles_old_format_dict(self):
        """LLM returns old format with 'characters' instead of 'new_characters'"""
        wf = self._make_workflow()
        payload = {"characters": [{"name": "张伟", "role_level": "supporting"}]}
        mock_resp = MagicMock()
        mock_resp.content = json.dumps(payload)

        with patch("workflows.characters_workflow.Agent") as MockAgent:
            MockAgent.return_value.run.return_value = mock_resp
            with patch("workflows.characters_workflow.get_model_from_config", return_value=MagicMock()):
                execution_input = MagicMock()
                execution_input.input = {"projectId": "p3", "text": "剧本内容", "_llm_config": {"provider": "openai"}}
                result_str = wf._extract_characters(wf, execution_input)

        result = json.loads(result_str)
        assert result["new_characters"] == [{"name": "张伟", "role_level": "supporting"}]
