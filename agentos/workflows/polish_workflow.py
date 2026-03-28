"""
Polish Workflow

Polishes and refines script text for better readability and dramatic effect.
Uses Agno's callable steps pattern for framework compatibility.
"""

from agno.agent import Agent
from agno.workflow import Workflow, WorkflowExecutionInput
from pydantic import BaseModel, Field
from typing import Any, Dict, List
import logging
import json

from config import get_model_from_config

logger = logging.getLogger(__name__)

# ============ Models ============

class PolishOutput(BaseModel):
    projectId: str
    original_text: str
    polished_text: str
    changes: List[str]  # List of key changes made

# ============ Workflow Steps Function ============

def _parse_input(raw_input: Any) -> Dict[str, Any]:
    """Parse input from Agno workflow runner (string JSON or dict)"""
    if isinstance(raw_input, dict):
        return raw_input
    if isinstance(raw_input, str):
        try:
            return json.loads(raw_input)
        except json.JSONDecodeError:
            return {"text": raw_input}
    return {}

# ============ Polish Workflow ============

class PolishWorkflow(Workflow):
    """Polish and refine script text"""

    description: str = "Polishes drama scripts for better readability and dramatic effect"

    def __init__(self):
        super().__init__(
            name="PolishWorkflow",
            description="Polishes drama scripts for better readability and dramatic effect",
            steps=self._polish_text,
        )

    def _polish_text(self, workflow: "PolishWorkflow", execution_input: WorkflowExecutionInput, **kwargs: Any) -> str:
        """Callable steps function invoked by Agno framework"""
        params = _parse_input(execution_input.input)
        project_id = params.get("projectId", "")
        text = params.get("text", "")
        llm_config = params.get("_llm_config")

        if not text:
            raise ValueError("text is required")

        if not llm_config:
            raise ValueError("LLM configuration is required. User must configure API keys before using AI features.")
        model = get_model_from_config(llm_config)

        polish_agent = Agent(
            name="Script Polisher",
            model=model,
            description="Polishes and refines script text",
            instructions="""你是一个专业的剧本编辑。请优化提供的剧本片段。

优化重点：
1. 对话自然流畅
2. 场景描述生动具体
3. 情节节奏合理
4. 人物刻画鲜明
5. 删除冗余内容

返回JSON格式：
{
  "polished_text": "优化后的文本",
  "changes": ["主要修改点1", "主要修改点2", ...]
}""",
            markdown=False,
        )

        logger.info(f"Polishing script for project {project_id}")

        response = polish_agent.run(f"请优化以下剧本片段：\n\n{text}")
        result = response.content

        if isinstance(result, str):
            try:
                result = json.loads(result)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse AI response as JSON: {result[:200]}")
                result = {"polished_text": result, "changes": []}

        output = {
            "projectId": project_id,
            "original_text": text,
            "polished_text": result.get("polished_text", ""),
            "changes": result.get("changes", [])
        }
        return json.dumps(output, ensure_ascii=False)
