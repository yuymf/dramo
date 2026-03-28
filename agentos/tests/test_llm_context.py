import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from middleware.llm_context import LLMContextMiddleware, get_llm_config


@pytest.fixture
def app():
    app = FastAPI()
    app.add_middleware(LLMContextMiddleware)

    @app.get("/test")
    async def test_route(request: Request):
        config = get_llm_config(request)
        return {"config": config}

    return app


@pytest.fixture
def client(app):
    return TestClient(app)


def test_extracts_llm_headers(client):
    response = client.get("/test", headers={
        "X-LLM-Api-Key": "sk-test123",
        "X-LLM-Base-Url": "https://api.openai.com/v1",
        "X-LLM-Model-Id": "gpt-4o",
    })
    assert response.status_code == 200
    data = response.json()["config"]
    assert data["api_key"] == "sk-test123"
    assert data["base_url"] == "https://api.openai.com/v1"
    assert data["model_id"] == "gpt-4o"


def test_returns_none_when_no_headers(client):
    response = client.get("/test")
    assert response.status_code == 200
    assert response.json()["config"] is None


def test_returns_none_when_partial_headers(client):
    response = client.get("/test", headers={
        "X-LLM-Api-Key": "sk-test123",
    })
    assert response.status_code == 200
    assert response.json()["config"] is None
