"""
AgentOS runtime — ReviseWorkflow only.
"""
from env_loader import load_backend_env

load_backend_env()

from agno.os import AgentOS
import logging
import os

from workflows.revise_workflow import ReviseWorkflow

logging.basicConfig(level=logging.INFO)

revise_workflow = ReviseWorkflow()

agent_os = AgentOS(
    name="Dramo AgentOS",
    workflows=[revise_workflow],
    telemetry=False,
)

app = agent_os.get_app()

if __name__ == "__main__":
    port = int(os.getenv("AGENTOS_PORT", os.getenv("PORT", 12322)))
    agent_os.serve(app="app:app", host="0.0.0.0", port=port, reload=True)
