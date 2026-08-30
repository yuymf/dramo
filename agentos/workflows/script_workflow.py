"""
Script Generation Workflow

Generates a structured drama script from user creative input (topic, keywords, styles, etc.)
Uses a single-step LLM call with structured JSON output.
"""

from agno.agent import Agent
from agno.workflow import Workflow, WorkflowExecutionInput
from typing import Any, Dict
import logging
import json

from config import get_model_from_config

from env_loader import load_backend_env
from lib.prompt_loader import load_prompt as _load_prompt
from lib.json_utils import safe_parse_json, parse_workflow_input

load_backend_env()
logger = logging.getLogger(__name__)


class ScriptWorkflow(Workflow):
    """Generate structured drama scripts from creative input"""

    description: str = "Generates structured drama scripts from user creative input"

    def __init__(self):
        self._prompt = _load_prompt("script/script_generation.md")

        super().__init__(
            name="ScriptWorkflow",
            description="Generates structured drama scripts from user creative input",
            steps=self._generate_script,
        )

    def _generate_script(self, workflow: "ScriptWorkflow", execution_input: WorkflowExecutionInput, **kwargs: Any) -> str:
        """Generate script via LLM"""
        params = parse_workflow_input(execution_input.input)
        project_id = params.get("projectId", "")
        llm_config = params.get("_llm_config")

        if not llm_config:
            raise ValueError("LLM configuration is required.")

        # Build user brief from available params
        brief_parts = []
        topic = params.get("topic", "")
        keyword = params.get("keyword", "")
        goal = params.get("goal", "")
        target = params.get("target", "")
        content_type = params.get("contentType", "")
        form = params.get("form", "")
        styles = params.get("styles", [])
        hot_stuffs = params.get("hot_stuffs", "")
        situation = params.get("situation", "")

        if topic:
            brief_parts.append(f"主题：{topic}")
        if keyword:
            brief_parts.append(f"关键词：{keyword}")
        if content_type:
            brief_parts.append(f"内容类型：{content_type}")
        if form:
            brief_parts.append(f"剧本形式：{form}")
        if styles:
            brief_parts.append(f"风格：{'、'.join(styles)}")
        if goal:
            brief_parts.append(f"创作目标：{goal}")
        if target:
            brief_parts.append(f"目标方向：{target}")
        if hot_stuffs:
            brief_parts.append(f"热点话题：{hot_stuffs}")
        if situation:
            brief_parts.append(f"情境描述：{situation}")

        brief_text = "\n".join(brief_parts)
        if not brief_text:
            raise ValueError("At least topic or keyword is required to generate a script")

        model = get_model_from_config(llm_config)

        script_agent = Agent(
            name="Script Writer",
            model=model,
            description="Generates structured drama scripts",
            instructions=self._prompt,
            markdown=False,
        )

        logger.info(f"[ScriptWorkflow] Generating script for project {project_id}")

        response = script_agent.run(f"请根据以下创作信息生成剧本：\n\n{brief_text}")
        result = response.content

        if isinstance(result, str):
            parsed = safe_parse_json(result, expected_type=dict, fallback={})
            if not parsed:
                logger.error(f"[ScriptWorkflow] Failed to parse AI response: {result[:200]}")
                parsed = {"scenes": [], "acts": []}
            result = parsed

        output = {
            "projectId": project_id,
            "scenes": result.get("scenes", []),
            "acts": result.get("acts", []),
        }

        logger.info(f"[ScriptWorkflow] Generated {len(output['scenes'])} scenes, {len(output['acts'])} acts")

        return json.dumps(output, ensure_ascii=False)
