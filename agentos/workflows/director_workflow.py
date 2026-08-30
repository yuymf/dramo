"""
AI Director Workflow — analyzes script context and suggests structural improvements.
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


def _parse_input(raw_input: Any) -> Dict[str, Any]:
    if isinstance(raw_input, dict):
        return raw_input
    if isinstance(raw_input, str):
        return safe_parse_json(raw_input, expected_type=dict, fallback={})
    return {}


class DirectorWorkflow(Workflow):
    """Analyze a script and return structured director suggestions."""

    description: str = "Analyzes script pacing, character arcs, and conflict"

    def __init__(self):
        super().__init__(
            name="DirectorWorkflow",
            description="Analyzes script pacing, character arcs, and conflict",
            steps=self._analyze,
        )

    def _analyze(self, workflow: "DirectorWorkflow", execution_input: WorkflowExecutionInput, **kwargs: Any) -> str:
        params = _parse_input(execution_input.input)
        project_id = params.get("projectId") or params.get("project_id", "")
        script_context = params.get("scriptContext") or params.get("script_context") or {}
        llm_config = params.get("_llm_config")

        if not llm_config:
            raise ValueError("LLM configuration is required.")

        model = get_model_from_config(llm_config)
        agent = Agent(
            name="AI Director",
            model=model,
            description="Script structure analyst",
            instructions="""你是影视导演顾问。根据给定台本结构，给出可执行的修改建议。
只返回 JSON 数组，每项包含:
- type: pacing | character | conflict
- suggestion: 具体建议
- sceneIndex: 相关场景序号（从 0 开始）
- severity: low | medium | high""",
            markdown=False,
        )

        logger.info(f"Director workflow starting for project {project_id}")
        response = agent.run(f"请分析以下台本并给出建议：\n\n{json.dumps(script_context, ensure_ascii=False)}")
        parsed = response.content
        if isinstance(parsed, str):
            parsed = safe_parse_json(parsed, expected_type=list, fallback=[])

        if not isinstance(parsed, list):
            parsed = []

        return json.dumps({"projectId": project_id, "suggestions": parsed}, ensure_ascii=False)
