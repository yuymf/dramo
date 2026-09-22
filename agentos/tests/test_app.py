import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import agent_os, custom_app, health_check, revise_workflow


def _paths(fastapi_app):
    return {getattr(route, "path", "") for route in fastapi_app.routes}


def test_health_payload():
    result = asyncio.run(health_check())
    assert result == {"ok": True, "status": "ok", "service": "agentos"}


def test_compose_health_route_only():
    paths = _paths(custom_app)
    assert "/health" in paths
    assert "/api/health" not in paths
    assert "/api/generate-image" not in paths


def test_only_revise_workflow_registered():
    assert revise_workflow.name == "ReviseWorkflow"
    names = [workflow.name for workflow in agent_os.workflows]
    assert names == ["ReviseWorkflow"]
