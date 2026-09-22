"""
AgentOS runtime — ReviseWorkflow only.
"""
from env_loader import load_backend_env

load_backend_env()

from agno.os import AgentOS
from fastapi import FastAPI
import logging
import os

from workflows.revise_workflow import ReviseWorkflow

logging.basicConfig(level=logging.INFO)

revise_workflow = ReviseWorkflow()

custom_app = FastAPI(title="Dramo AgentOS", version="2.0.0")


@custom_app.get("/health")
async def health_check():
    return {"ok": True, "status": "ok", "service": "agentos"}


agent_os = AgentOS(
    name="Dramo AgentOS",
    workflows=[revise_workflow],
    base_app=custom_app,
    telemetry=False,
)

app = agent_os.get_app()

if __name__ == "__main__":
    port = int(os.getenv("AGENTOS_PORT", os.getenv("PORT", 12322)))
    agent_os.serve(app="app:app", host="0.0.0.0", port=port, reload=True)
