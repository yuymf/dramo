"""Analyze script context and suggest structural improvements."""
from agno.agent import Agent
from agno.workflow import Workflow, WorkflowExecutionInput
from typing import Any
import logging
import json

from config import get_model_from_config

try:
    from ..lib.json_utils import safe_parse_json, parse_workflow_input
    from ..lib.prompt_loader import load_prompt as _load_prompt
except ImportError:
    from lib.json_utils import safe_parse_json, parse_workflow_input
    from lib.prompt_loader import load_prompt as _load_prompt

logger = logging.getLogger(__name__)


class DirectorWorkflow(Workflow):
    description: str = "Analyzes script pacing, character arcs, and conflict"

    def __init__(self):
        self._system_prompt = _load_prompt("director/system.md")
        super().__init__(
            name="DirectorWorkflow",
            description=self.description,
            steps=self._analyze,
        )

    def _analyze(self, workflow: "DirectorWorkflow",
                 execution_input: WorkflowExecutionInput, **kwargs: Any) -> str:
        params = parse_workflow_input(execution_input.input)
        project_id = params.get("projectId") or params.get("project_id", "")
        script_context = params.get("scriptContext") or params.get("script_context") or {}
        llm_config = params.get("_llm_config")

        if not llm_config:
            raise ValueError("LLM configuration is required.")

        model = get_model_from_config(llm_config)
        agent = Agent(
            name="AI Director",
            model=model,
            instructions=self._system_prompt,
            markdown=False,
        )

        logger.info(f"Director workflow starting for project {project_id}")
        response = agent.run(
            f"请分析以下台本并给出建议：\n\n{json.dumps(script_context, ensure_ascii=False)}"
        )
        parsed = safe_parse_json(response.content, expected_type=list, fallback=[])
        if not isinstance(parsed, list):
            parsed = []

        return json.dumps({"projectId": project_id, "suggestions": parsed}, ensure_ascii=False)
