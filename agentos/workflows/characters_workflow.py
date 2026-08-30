"""
Characters Workflow v2
Extracts character profiles with richer schema: role_level, visual_keywords, aliases, appearances.
Uses new characters_system.md prompt with delta output (new/updated separation).
"""
from agno.agent import Agent
from agno.workflow import Workflow, WorkflowExecutionInput
from typing import Any, Dict
import logging
import json

from config import get_model_from_config

from lib.json_utils import safe_parse_json, parse_workflow_input
from lib.prompt_loader import load_prompt as _load_prompt

logger = logging.getLogger(__name__)



# ============ Characters Workflow ============

class CharactersWorkflow(Workflow):
    """Extract character profiles with richer schema (v2)"""

    description: str = "Extracts detailed character profiles from drama scripts (v2 schema)"

    def __init__(self):
        self._system_prompt = _load_prompt("characters/characters_system.md")

        super().__init__(
            name="CharactersWorkflow",
            description="Extracts detailed character profiles from drama scripts (v2 schema)",
            steps=self._extract_characters,
        )

    def _extract_characters(self, workflow: "CharactersWorkflow",
                             execution_input: WorkflowExecutionInput, **kwargs: Any) -> str:
        """Callable steps function invoked by Agno framework"""
        params = parse_workflow_input(execution_input.input)
        project_id = params.get("projectId", "")
        text = params.get("text", "")
        llm_config = params.get("_llm_config")

        if not text:
            raise ValueError("text is required")
        if not llm_config:
            raise ValueError("LLM configuration is required.")

        model = get_model_from_config(llm_config)
        agent = Agent(
            name="Character Extractor",
            model=model,
            instructions=self._system_prompt,
            markdown=False,
        )

        logger.info(f"[CharactersWorkflow] Extracting characters for project {project_id}")
        response = agent.run(f"请提取以下剧本中的所有角色信息：\n\n{text}")

        raw = safe_parse_json(response.content, expected_type=dict, fallback=None)

        if isinstance(raw, dict):
            result_data = raw
        elif isinstance(raw, list):
            # LLM returned a bare list
            result_data = {"characters": [], "new_characters": raw, "updated_characters": []}
        else:
            # Parse failed entirely — try as list
            chars = safe_parse_json(response.content, expected_type=list, fallback=[])
            result_data = {"characters": [], "new_characters": chars, "updated_characters": []}

        if "new_characters" not in result_data:
            # Old format: move characters → new_characters
            result_data = {
                "characters": [],
                "new_characters": result_data.get("characters", []),
                "updated_characters": [],
            }

        result = {"projectId": project_id, **result_data}
        return json.dumps(result, ensure_ascii=False)
