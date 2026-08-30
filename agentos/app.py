"""
AgentOS runtime — Agno workflows + custom image/provider routes.
"""
from agno.os import AgentOS
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import logging
import os
import json

from workflows.storyboard_workflow import StoryboardWorkflow
from workflows.characters_workflow import CharactersWorkflow
from workflows.locations_workflow import LocationsWorkflow
from workflows.polish_workflow import PolishWorkflow
from workflows.script_workflow import ScriptWorkflow
from workflows.clarification_workflow import ClarificationWorkflow
from workflows.director_workflow import DirectorWorkflow
from workflows.inspirations_workflow import InspirationsWorkflow
from services.image_service import ImageGenerationService
from config import get_ai_provider, set_ai_provider, get_available_providers, get_provider_config
from middleware.llm_context import LLMContextMiddleware, get_llm_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

storyboard_workflow = StoryboardWorkflow()
characters_workflow = CharactersWorkflow()
locations_workflow = LocationsWorkflow()
polish_workflow = PolishWorkflow()
script_workflow = ScriptWorkflow()
clarification_workflow = ClarificationWorkflow()
director_workflow = DirectorWorkflow()
inspirations_workflow = InspirationsWorkflow()

custom_app = FastAPI(title="Dramo AgentOS", version="2.0.0")


@custom_app.get("/health")
@custom_app.get("/api/health")
async def health_check():
    return {"ok": True, "status": "ok", "service": "agentos"}


class ImageGenerationRequest(BaseModel):
    prompt: str
    reference_images: Optional[List[str]] = Field(default_factory=list)
    mode: str = "single"
    stream: bool = False
    generation_type: Optional[str] = None
    size: str = "2K"
    watermark: bool = False
    max_images: int = 3


@custom_app.post("/api/generate-image")
async def generate_image(request: ImageGenerationRequest, raw_request: Request):
    llm_config = get_llm_config(raw_request)
    if not llm_config:
        raise HTTPException(
            status_code=403,
            detail="LLM configuration is required. Please configure your image generation API key first.",
        )

    svc = ImageGenerationService(
        api_key=llm_config["api_key"],
        base_url=llm_config["base_url"],
        model=llm_config["model_id"],
    )

    try:
        if request.stream:
            def event_generator():
                try:
                    for event in svc.generate(
                        prompt=request.prompt,
                        reference_images=request.reference_images,
                        mode=request.mode,
                        stream=True,
                        generation_type=request.generation_type,
                        size=request.size,
                        watermark=request.watermark,
                        max_images=request.max_images,
                    ):
                        yield f"data: {json.dumps(event)}\n\n"
                except Exception as e:
                    logger.error(f"Stream error: {e}")
                    yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

            return StreamingResponse(
                event_generator(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        return svc.generate(
            prompt=request.prompt,
            reference_images=request.reference_images,
            mode=request.mode,
            stream=False,
            generation_type=request.generation_type,
            size=request.size,
            watermark=request.watermark,
            max_images=request.max_images,
        )
    except Exception as e:
        logger.error(f"[POST /api/generate-image] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@custom_app.get("/api/ai/providers")
async def list_providers():
    try:
        return {
            "success": True,
            "providers": get_available_providers(),
            "current": get_ai_provider(),
        }
    except Exception as e:
        logger.error(f"Failed to list providers: {e}")
        return {"success": False, "error": str(e)}


@custom_app.get("/api/ai/provider")
async def get_current_provider():
    try:
        return {"success": True, "config": get_provider_config()}
    except Exception as e:
        logger.error(f"Failed to get provider config: {e}")
        return {"success": False, "error": str(e)}


@custom_app.post("/api/ai/provider")
async def switch_provider(request: dict):
    try:
        provider = request.get("provider")
        if not provider:
            return {"success": False, "error": "Provider name is required"}
        if not set_ai_provider(provider):
            return {"success": False, "error": "Failed to switch provider"}
        return {
            "success": True,
            "message": f"AI provider switched to {provider}",
            "config": get_provider_config(),
        }
    except Exception as e:
        logger.error(f"Failed to switch provider: {e}")
        return {"success": False, "error": str(e)}


agent_os = AgentOS(
    name="Dramo AgentOS",
    workflows=[
        storyboard_workflow,
        characters_workflow,
        locations_workflow,
        polish_workflow,
        script_workflow,
        clarification_workflow,
        director_workflow,
        inspirations_workflow,
    ],
    base_app=custom_app,
    telemetry=False,
)

app = agent_os.get_app()
app.add_middleware(LLMContextMiddleware)

if __name__ == "__main__":
    port = int(os.getenv("AGENTOS_PORT", os.getenv("PORT", 12322)))
    agent_os.serve(app="app:app", host="0.0.0.0", port=port, reload=True)
