"""Revise in-scope screenplay nodes. Returns JSON { nodes: ScreenplayNode[] }."""
from agno.agent import Agent
from agno.workflow import Workflow, WorkflowExecutionInput
from typing import Any, Dict, List, Set
import logging
import json
import re
import uuid

from config import get_model_from_config

from lib.json_utils import safe_parse_json, parse_workflow_input
from lib.prompt_loader import load_prompt as _load_prompt

logger = logging.getLogger(__name__)

NODE_TYPES = {
    "scene_heading",
    "action",
    "character",
    "dialogue",
    "parenthetical",
    "transition",
    "comment",
    "subtitle",
}


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]*>", "", text)


def _new_node_id() -> str:
    return f"n_{uuid.uuid4().hex[:12]}"


def sanitize_revise_nodes(raw: Any, _allowed_ids: Set[str]) -> List[Dict[str, str]]:
    """Accept rewritten rows (original ids) and in-range additions (new ids)."""
    if not isinstance(raw, list):
        return []

    out: List[Dict[str, str]] = []
    seen: Set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            return []
        node_type = item.get("type")
        if not isinstance(node_type, str) or node_type not in NODE_TYPES:
            return []
        text = item.get("text")
        if not isinstance(text, str):
            return []

        raw_id = item.get("id")
        node_id = raw_id.strip() if isinstance(raw_id, str) else ""
        if not node_id:
            node_id = _new_node_id()
        if node_id in seen:
            return []
        seen.add(node_id)
        out.append({
            "id": node_id,
            "type": node_type,
            "text": _strip_html(text),
        })
    return out


class ReviseWorkflow(Workflow):
    """Replace in-scope screenplay nodes from a user instruction."""

    description: str = "Revises in-scope screenplay nodes and returns replacement JSON"

    def __init__(self):
        self._system_prompt = _load_prompt("screenplay/revise.md")
        super().__init__(
            name="ReviseWorkflow",
            description=self.description,
            steps=self._revise_nodes,
        )

    def _revise_nodes(
        self,
        workflow: "ReviseWorkflow",
        execution_input: WorkflowExecutionInput,
        **kwargs: Any,
    ) -> str:
        params = parse_workflow_input(execution_input.input)
        instruction = params.get("instruction") or ""
        if not isinstance(instruction, str):
            instruction = str(instruction)
        nodes = params.get("nodes") or []
        fmt = params.get("format") or "hollywood"
        llm_config = params.get("_llm_config")

        if not isinstance(nodes, list) or len(nodes) == 0:
            raise ValueError("nodes is required")
        if not llm_config:
            raise ValueError("LLM configuration is required.")

        allowed_ids = {
            str(node.get("id")).strip()
            for node in nodes
            if isinstance(node, dict) and node.get("id")
        }

        model = get_model_from_config(llm_config)
        agent = Agent(
            name="Screenplay Reviser",
            model=model,
            instructions=self._system_prompt,
            markdown=False,
        )

        user_payload = {
            "instruction": instruction,
            "format": fmt,
            "nodes": nodes,
        }
        logger.info("[ReviseWorkflow] Revising %s nodes (format=%s)", len(nodes), fmt)
        response = agent.run(
            "请按指令修订以下范围内的剧本节点，只返回 JSON。\n\n"
            + json.dumps(user_payload, ensure_ascii=False)
        )

        parsed = safe_parse_json(response.content, expected_type=dict, fallback=None)
        raw_nodes = None
        if isinstance(parsed, dict):
            raw_nodes = parsed.get("nodes")
        if raw_nodes is None:
            as_list = safe_parse_json(response.content, expected_type=list, fallback=None)
            if isinstance(as_list, list):
                raw_nodes = as_list

        sanitized = sanitize_revise_nodes(raw_nodes, allowed_ids)
        if not sanitized:
            logger.warning("[ReviseWorkflow] Model output unusable; echoing scoped nodes")
            sanitized = sanitize_revise_nodes(nodes, allowed_ids)

        return json.dumps({"nodes": sanitized}, ensure_ascii=False)
