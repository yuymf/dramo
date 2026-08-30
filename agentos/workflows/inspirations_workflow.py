"""Generate short inspiration items from script context."""
from agno.agent import Agent
from agno.workflow import Workflow, WorkflowExecutionInput
from typing import Any
import logging
import json

from config import get_model_from_config

from lib.json_utils import safe_parse_json, parse_workflow_input
from lib.prompt_loader import load_prompt as _load_prompt

logger = logging.getLogger(__name__)


class InspirationsWorkflow(Workflow):
    description: str = "Generates categorized inspiration items from a script"

    def __init__(self):
        self._system_prompt = _load_prompt("inspirations/system.md")
        super().__init__(
            name="InspirationsWorkflow",
            description=self.description,
            steps=self._generate,
        )

    def _generate(self, workflow: "InspirationsWorkflow",
                  execution_input: WorkflowExecutionInput, **kwargs: Any) -> str:
        params = parse_workflow_input(execution_input.input)
        project_id = params.get("projectId", "")
        category = params.get("category")
        script = params.get("script")
        llm_config = params.get("_llm_config")

        if not llm_config:
            raise ValueError("LLM configuration is required.")

        model = get_model_from_config(llm_config)
        agent = Agent(
            name="Inspiration Writer",
            model=model,
            instructions=self._system_prompt,
            markdown=False,
        )

        user_prompt = "请根据以下台本生成灵感：\n\n"
        if category:
            user_prompt += f"分类限制：{category}\n"
        user_prompt += json.dumps(script, ensure_ascii=False) if script else "（无台本，按通用直播/短视频给出灵感）"

        logger.info(f"[InspirationsWorkflow] generating for project {project_id}")
        response = agent.run(user_prompt)
        parsed = safe_parse_json(response.content, expected_type=dict, fallback={})
        items = parsed.get("inspirations") if isinstance(parsed, dict) else None
        if not isinstance(items, list):
            items = []

        cleaned = []
        for item in items:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text", "")).strip()
            if not text:
                continue
            cat = str(item.get("category") or category or "topics")
            cleaned.append({"text": text, "category": cat})

        return json.dumps({"projectId": project_id, "inspirations": cleaned}, ensure_ascii=False)
