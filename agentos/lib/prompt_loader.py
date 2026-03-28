"""Shared prompt loading utility for AgentOS workflows."""
import os

PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")


def load_prompt(relative_path: str) -> str:
    """Load a prompt markdown file from the prompts directory."""
    full_path = os.path.join(PROMPTS_DIR, relative_path)
    if not os.path.exists(full_path):
        raise FileNotFoundError(f"Prompt not found: {full_path}")
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()
