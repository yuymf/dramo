"""
Clarification Workflow

Creative brainstorming agent for requirement clarification.
Converses with the user to understand their creative intent,
then outputs structured requirements for the generation pipeline.
"""

from agno.agent import Agent
from agno.workflow import Workflow, WorkflowExecutionInput
from typing import Any, Dict, List
import logging
import json

from config import get_model_from_config

try:
    from ..lib.prompt_loader import load_prompt as _load_prompt
except ImportError:
    from lib.prompt_loader import load_prompt as _load_prompt

try:
    from ..lib.json_utils import safe_parse_json, parse_workflow_input
except ImportError:
    from lib.json_utils import safe_parse_json, parse_workflow_input

logger = logging.getLogger(__name__)


class ClarificationWorkflow(Workflow):
    """Creative brainstorming for requirement clarification"""

    description: str = "Helps users clarify their creative intent through brainstorming dialogue"

    def __init__(self):
        self._system_prompt = _load_prompt("clarification/system.md")

        super().__init__(
            name="ClarificationWorkflow",
            description="Helps users clarify their creative intent through brainstorming dialogue",
            steps=self._clarify,
        )

    def _clarify(
        self,
        workflow: "ClarificationWorkflow",
        execution_input: WorkflowExecutionInput,
        **kwargs: Any,
    ) -> str:
        """Run one round of clarification dialogue"""
        params = parse_workflow_input(execution_input.input)
        messages: List[Dict[str, str]] = params.get("messages", [])
        llm_config = params.get("_llm_config")

        if not llm_config:
            raise ValueError("LLM configuration is required.")

        if not messages:
            raise ValueError("messages is required")

        model = get_model_from_config(llm_config)

        clarification_agent = Agent(
            name="Creative Consultant",
            model=model,
            description="Creative brainstorming consultant for script creation",
            instructions=self._system_prompt,
            markdown=False,
        )

        # Build conversation context
        conversation = "\n\n".join(
            f"{'用户' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')}"
            for m in messages
        )

        logger.info(f"[ClarificationWorkflow] Processing {len(messages)} messages")

        response = clarification_agent.run(conversation)
        result = response.content

        # Parse JSON response
        if isinstance(result, str):
            parsed = safe_parse_json(result, expected_type=dict, fallback=None)
            if not parsed:
                logger.warning(
                    f"[ClarificationWorkflow] Non-JSON response: {result[:200]}"
                )
                parsed = {
                    "content": result,
                    "options": None,
                    "clarificationComplete": None,
                }
            result = parsed

        output = {
            "content": result.get("content", ""),
            "options": result.get("options"),
            "clarificationComplete": result.get("clarificationComplete"),
        }

        logger.info(
            f"[ClarificationWorkflow] "
            f"hasOptions={output['options'] is not None}, "
            f"complete={output['clarificationComplete'] is not None}"
        )

        return json.dumps(output, ensure_ascii=False)
