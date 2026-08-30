import json
import sys
import os
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from workflows.revise_workflow import ReviseWorkflow, sanitize_revise_nodes


class TestReviseWorkflowInit:
    def test_initializes_and_loads_prompt(self):
        wf = ReviseWorkflow()
        assert wf.name == "ReviseWorkflow"
        assert "只返回 JSON" in wf._system_prompt
        assert "nodes" in wf._system_prompt


class TestSanitizeReviseNodes:
    def test_keeps_input_ids_and_new_ids(self):
        raw = [
            {"id": "a", "type": "dialogue", "text": "你好"},
            {"id": "n_new1", "type": "action", "text": "他转身"},
        ]
        result = sanitize_revise_nodes(raw, {"a"})
        assert result == raw

    def test_rejects_invalid_type(self):
        raw = [{"id": "a", "type": "shot", "text": "x"}]
        assert sanitize_revise_nodes(raw, {"a"}) == []

    def test_strips_html_and_fills_missing_id(self):
        raw = [{"id": "", "type": "action", "text": "<b>走</b>"}]
        result = sanitize_revise_nodes(raw, set())
        assert len(result) == 1
        assert result[0]["text"] == "走"
        assert result[0]["id"].startswith("n_")


class TestReviseStep:
    def test_returns_json_nodes_from_model(self):
        wf = ReviseWorkflow()
        payload = {
            "nodes": [
                {"id": "n1", "type": "dialogue", "text": "改过了"},
            ]
        }
        mock_resp = MagicMock()
        mock_resp.content = json.dumps(payload)

        with patch("workflows.revise_workflow.Agent") as MockAgent:
            MockAgent.return_value.run.return_value = mock_resp
            with patch(
                "workflows.revise_workflow.get_model_from_config",
                return_value=MagicMock(),
            ):
                execution_input = MagicMock()
                execution_input.input = {
                    "instruction": "更口语",
                    "format": "hollywood",
                    "nodes": [{"id": "n1", "type": "dialogue", "text": "你好"}],
                    "_llm_config": {"api_key": "k", "base_url": "http://x", "model_id": "m"},
                }
                result_str = wf._revise_nodes(wf, execution_input)

        result = json.loads(result_str)
        assert result == payload
