import pytest
import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from unittest.mock import patch, MagicMock
from workflows.storyboard_workflow import (
    StoryboardWorkflow,
    merge_scenes,
    _load_prompt,
)


class TestMergeScenes:
    def test_renumbers_scenes_and_shots(self):
        input_scenes = [
            [{"id": "scene-1", "title": "A", "summary": "s", "shots": [{"shot_number": "001"}]}],
            [{"id": "scene-1", "title": "B", "summary": "s", "shots": [{"shot_number": "001"}]}],
        ]
        merged = merge_scenes(input_scenes)
        assert merged[0]["id"] == "scene-1"
        assert merged[1]["id"] == "scene-2"
        assert merged[0]["shots"][0]["shot_number"] == "001"
        assert merged[1]["shots"][0]["shot_number"] == "002"

    def test_handles_empty_input(self):
        assert merge_scenes([]) == []

    def test_handles_empty_chunk_result(self):
        assert merge_scenes([[]]) == []


class TestLoadPrompt:
    def test_loads_existing_prompt(self):
        content = _load_prompt("screenplay/screenplay_conversion.md")
        assert len(content) > 100
        assert "JSON 安全" in content

    def test_raises_for_missing_prompt(self):
        with pytest.raises(FileNotFoundError):
            _load_prompt("nonexistent/prompt.md")


class TestWorkflowInit:
    def test_initializes_without_error(self):
        workflow = StoryboardWorkflow()
        assert workflow is not None

    def test_has_required_prompts(self):
        workflow = StoryboardWorkflow()
        assert hasattr(workflow, '_prompts')
        assert 'screenplay' in workflow._prompts
        assert 'plan_panels' in workflow._prompts
        assert 'cinematographer' in workflow._prompts
        assert 'acting_direction' in workflow._prompts
        assert 'detail_refiner' in workflow._prompts


class TestWorkflowExecution:
    def test_process_single_clip_returns_scene_dict(self):
        """_process_single_clip returns a dict with shots key"""
        from workflows.storyboard_workflow import StoryboardWorkflow

        wf = StoryboardWorkflow()

        panels_json = json.dumps([
            {"panel_number": 1, "description": "CU on face", "shot_type": "CU",
             "camera_move": "static", "source_text": "李明抬头", "scene_type": "dialogue",
             "characters": ["李明"], "location": "咖啡馆"}
        ])
        cine_json = json.dumps([
            {"panel_number": 1, "composition": "rule of thirds",
             "lighting": "natural", "color_palette": "warm", "atmosphere": "calm"}
        ])
        acting_json = json.dumps([
            {"panel_number": 1, "acting": [{"character": "李明", "expression": "surprised", "action": "looks up"}]}
        ])
        shots_json = json.dumps([
            {"shot_number": 1, "description": "CU on face", "shot_type": "CU",
             "camera_move": "static", "characters": ["李明"],
             "locations": ["咖啡馆"], "scene_type": "dialogue", "source_text": "李明抬头",
             "cinematography": {"composition": "rule of thirds", "lighting": "natural",
                                "color_palette": "warm", "atmosphere": "calm"},
             "acting_direction": [{"character": "李明", "expression": "surprised", "action": "looks up"}]}
        ])

        # Return different values for each phase call
        side_effects = [
            MagicMock(content=panels_json),
            MagicMock(content=cine_json),
            MagicMock(content=acting_json),
            MagicMock(content=shots_json),
        ]

        clip = {"clip_id": "clip-001", "location": "咖啡馆", "content": [{"type": "action", "text": "李明抬头"}]}

        with patch("workflows.storyboard_workflow.get_model_from_config") as mock_get_model, \
             patch("workflows.storyboard_workflow.Agent") as MockAgent:
            mock_get_model.return_value = MagicMock()
            instance = MockAgent.return_value
            instance.run.side_effect = side_effects

            llm_config = {"model_id": "gemini-2.0-flash", "api_key": "sk-test", "base_url": "https://aihubmix.com/v1"}
            result = wf._process_single_clip(0, clip, 1, {}, llm_config)

        assert isinstance(result, dict)
        assert "shots" in result

    def test_merge_step_renumbers_shots_globally(self):
        """merge_step renumbers shots across all clips sequentially"""
        from workflows.storyboard_workflow import merge_scenes

        scenes = [
            {"id": "scene-1", "title": "场景1", "shots": [
                {"shot_number": 1, "description": "shot A"},
                {"shot_number": 2, "description": "shot B"},
            ]},
            {"id": "scene-2", "title": "场景2", "shots": [
                {"shot_number": 1, "description": "shot C"},
            ]},
        ]

        result = merge_scenes([[s] for s in scenes])
        shot_numbers = [s["shot_number"] for scene in result for s in scene["shots"]]
        assert shot_numbers == ["001", "002", "003"]
