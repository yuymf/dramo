"""
Locations Workflow v2
Extracts location info with richer schema: atmosphere, suggested_props, era_context, lighting_default.
"""
from agno.agent import Agent
from agno.workflow import Workflow, WorkflowExecutionInput
from typing import Any, Dict
import logging
import json

from config import get_model_from_config

try:
    from ..lib.json_utils import safe_parse_json
except ImportError:
    from lib.json_utils import safe_parse_json

logger = logging.getLogger(__name__)

try:
    from ..lib.prompt_loader import load_prompt as _load_prompt
except ImportError:
    from lib.prompt_loader import load_prompt as _load_prompt

_PARSE_FAILED = object()


def _parse_input(raw_input: Any) -> Dict[str, Any]:
    """Parse input from Agno workflow runner"""
    if isinstance(raw_input, dict):
        return raw_input
    if isinstance(raw_input, str):
        result = safe_parse_json(raw_input, expected_type=dict, fallback=_PARSE_FAILED)
        if result is not _PARSE_FAILED and isinstance(result, dict):
            return result
        return {"text": raw_input}
    return {}


class LocationsWorkflow(Workflow):
    """Extract location info with richer schema (v2)"""

    description: str = "Extracts location descriptions with atmosphere, era_context, lighting_default"

    def __init__(self):
        self._system_prompt = _load_prompt("locations/locations_system.md")

        super().__init__(
            name="LocationsWorkflow",
            description="Extracts location descriptions with atmosphere, era_context, lighting_default",
            steps=self._extract_locations,
        )

    def _extract_locations(self, workflow: "LocationsWorkflow",
                           execution_input: WorkflowExecutionInput, **kwargs: Any) -> str:
        params = _parse_input(execution_input.input)
        project_id = params.get("projectId", "")
        text = params.get("text", "")
        llm_config = params.get("_llm_config")

        if not text:
            raise ValueError("text is required")
        if not llm_config:
            raise ValueError("LLM configuration is required.")

        model = get_model_from_config(llm_config)
        agent = Agent(
            name="Location Extractor",
            model=model,
            instructions=self._system_prompt,
            markdown=False,
        )

        logger.info(f"[LocationsWorkflow] Extracting locations for project {project_id}")
        response = agent.run(f"请提取以下剧本中的所有拍摄地点信息：\n\n{text}")

        locations = safe_parse_json(response.content, expected_type=list, fallback=[])

        result = {"projectId": project_id, "locations": locations}
        return json.dumps(result, ensure_ascii=False)
