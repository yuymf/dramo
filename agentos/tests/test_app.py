import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient

from app import app, agent_os, revise_workflow

client = TestClient(app)


def test_health_matches_compose_and_server():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body.get("ok") is True or body.get("status") == "ok"


def test_dead_custom_routes_gone():
    assert client.get("/api/health").status_code == 404
    assert client.get("/api/generate-image").status_code == 404


def test_only_revise_workflow_registered():
    assert revise_workflow.name == "ReviseWorkflow"
    assert [workflow.name for workflow in agent_os.workflows] == ["ReviseWorkflow"]
    res = client.get("/workflows")
    assert res.status_code == 200
    assert [item["id"] for item in res.json()] == ["reviseworkflow"]
