import pytest
import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from workflows.locations_workflow import LocationsWorkflow, _parse_input
from unittest.mock import patch, MagicMock


class TestLocationsWorkflowInit:
    def test_initializes_without_error(self):
        wf = LocationsWorkflow()
        assert wf is not None

    def test_has_prompt_with_new_fields(self):
        wf = LocationsWorkflow()
        assert hasattr(wf, '_system_prompt')
        assert "atmosphere" in wf._system_prompt
        assert "era_context" in wf._system_prompt
        assert "lighting_default" in wf._system_prompt
        assert "JSON 安全" in wf._system_prompt


class TestParseInput:
    def test_parses_dict(self):
        result = _parse_input({"text": "hello"})
        assert result == {"text": "hello"}

    def test_parses_json_string(self):
        result = _parse_input('{"text": "hello"}')
        assert result == {"text": "hello"}

    def test_returns_text_on_invalid_json(self):
        result = _parse_input("not json")
        assert result == {"text": "not json"}

    def test_returns_empty_on_none(self):
        result = _parse_input(None)
        assert result == {}


class TestExtractLocations:
    def test_handles_list_response(self):
        """LLM returns list of location objects"""
        wf = LocationsWorkflow()
        payload = [{"name": "咖啡馆", "description": "现代咖啡馆", "atmosphere": "温馨", "era_context": "现代", "lighting_default": "暖光"}]
        mock_resp = MagicMock()
        mock_resp.content = json.dumps(payload)

        with patch("workflows.locations_workflow.Agent") as MockAgent:
            MockAgent.return_value.run.return_value = mock_resp
            with patch("workflows.locations_workflow.get_model_from_config", return_value=MagicMock()):
                execution_input = MagicMock()
                execution_input.input = {"projectId": "p1", "text": "剧本内容", "_llm_config": {"provider": "openai"}}
                result_str = wf._extract_locations(wf, execution_input)

        result = json.loads(result_str)
        assert result["projectId"] == "p1"
        assert len(result["locations"]) == 1
        assert result["locations"][0]["name"] == "咖啡馆"

    def test_handles_empty_response(self):
        """LLM returns empty or invalid — should return empty list"""
        wf = LocationsWorkflow()
        mock_resp = MagicMock()
        mock_resp.content = "not valid json"

        with patch("workflows.locations_workflow.Agent") as MockAgent:
            MockAgent.return_value.run.return_value = mock_resp
            with patch("workflows.locations_workflow.get_model_from_config", return_value=MagicMock()):
                execution_input = MagicMock()
                execution_input.input = {"projectId": "p2", "text": "剧本", "_llm_config": {"provider": "openai"}}
                result_str = wf._extract_locations(wf, execution_input)

        result = json.loads(result_str)
        assert result["locations"] == []
