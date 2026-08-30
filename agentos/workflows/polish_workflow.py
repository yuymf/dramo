"""Polish and refine script text."""
from agno.agent import Agent
from agno.workflow import Workflow, WorkflowExecutionInput
from typing import Any
import logging
import json

from config import get_model_from_config

from lib.json_utils import safe_parse_json, parse_workflow_input
from lib.prompt_loader import load_prompt as _load_prompt

logger = logging.getLogger(__name__)

_OPERATION_HINTS = {
    "simplify": "请简化表达，去掉冗余，保留核心信息。",
    "expand": "请扩写，增加具体细节和画面感。",
    "rewrite": "请换一种表达重写，保持核心意思。",
    "adjust_style": "请调整文风，让对话和叙述更自然。",
}


class PolishWorkflow(Workflow):
    description: str = "Polishes drama scripts for better readability and dramatic effect"

    def __init__(self):
        self._system_prompt = _load_prompt("polish/system.md")
        super().__init__(
            name="PolishWorkflow",
            description=self.description,
            steps=self._polish_text,
        )

    def _polish_text(self, workflow: "PolishWorkflow",
                     execution_input: WorkflowExecutionInput, **kwargs: Any) -> str:
        params = parse_workflow_input(execution_input.input)
        project_id = params.get("projectId", "")
        text = params.get("text", "")
        operation = params.get("operation") or "adjust_style"
        llm_config = params.get("_llm_config")

        if not text:
            raise ValueError("text is required")
        if not llm_config:
            raise ValueError("LLM configuration is required.")

        model = get_model_from_config(llm_config)
        agent = Agent(
            name="Script Polisher",
            model=model,
            instructions=self._system_prompt,
            markdown=False,
        )

        hint = _OPERATION_HINTS.get(operation, _OPERATION_HINTS["adjust_style"])
        logger.info(f"Polishing script for project {project_id} ({operation})")
        response = agent.run(f"{hint}\n\n请优化以下剧本片段：\n\n{text}")
        parsed = safe_parse_json(response.content, expected_type=dict, fallback=None)
        if not isinstance(parsed, dict):
            parsed = {"polished_text": response.content or text, "changes": []}

        output = {
            "projectId": project_id,
            "original_text": text,
            "polished_text": parsed.get("polished_text") or text,
            "changes": parsed.get("changes") or [],
        }
        return json.dumps(output, ensure_ascii=False)
