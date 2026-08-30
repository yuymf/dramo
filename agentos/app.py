"""
Unified AgentOS Runtime

Exposes multiple workflows, agents, and teams through a single API:
- Storyboard Workflow: Generate storyboards from drama scripts
- Characters Workflow: Extract character profiles and relationships
- Locations Workflow: Extract location descriptions and requirements
- Polish Workflow: Polish and refine script text
- Image Generation API: Unified image generation using Seedream AI (custom route)
- Research Team: Web-augmented analysis and research

All workflows support SSE streaming for long-running tasks.
"""

from agno.workflow import Workflow
from agno.os import AgentOS
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
import os
import json

# Import workflows
from workflows.storyboard_workflow import StoryboardWorkflow
from workflows.characters_workflow import CharactersWorkflow
from workflows.locations_workflow import LocationsWorkflow
from workflows.polish_workflow import PolishWorkflow
from workflows.script_workflow import ScriptWorkflow
from workflows.clarification_workflow import ClarificationWorkflow
from workflows.director_workflow import DirectorWorkflow

# Import image generation service
from services.image_service import ImageGenerationService

# Import config
from config import get_ai_provider, set_ai_provider, get_available_providers, get_provider_config

# Import LLM context middleware
from middleware.llm_context import LLMContextMiddleware, get_llm_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ Create Workflows ============

# Create workflow instances
storyboard_workflow = StoryboardWorkflow()
characters_workflow = CharactersWorkflow()
locations_workflow = LocationsWorkflow()
polish_workflow = PolishWorkflow()
script_workflow = ScriptWorkflow()
clarification_workflow = ClarificationWorkflow()
director_workflow = DirectorWorkflow()

# ============ Custom FastAPI App with Image Generation ============

# Create custom FastAPI app
custom_app = FastAPI(
    title="Story Agent Custom API",
    description="Custom routes for image generation",
    version="1.0.0"
)

# Note: image_service singleton is not used — endpoints create per-request instances
# with user-provided LLM config. Removed eager initialization to avoid startup crash
# when ARK_API_KEY is not configured.

# ============ Health Endpoints ============
# Both `/health` (used by docker-compose healthcheck) and `/api/health`
# (used by Dockerfile HEALTHCHECK and nginx upstream probes) point to the
# same handler. Keep this trivial — must not depend on LLM config.

@custom_app.get("/health")
@custom_app.get("/api/health")
async def health_check():
    """Liveness probe — returns 200 if the process is up."""
    return {"ok": True, "status": "ok", "service": "agentos"}

# ============ Request/Response Models ============

class ImageGenerationRequest(BaseModel):
    prompt: str
    reference_images: Optional[List[str]] = Field(default_factory=list)
    mode: str = 'single'  # 'single' or 'sequence'
    stream: bool = False
    generation_type: Optional[str] = None  # 前端可明确指定类型
    size: str = "2K"
    watermark: bool = False
    max_images: int = 3

# ============ Custom Routes - Image Generation API ============

@custom_app.post("/api/generate-image")
async def generate_image(request: ImageGenerationRequest, raw_request: Request):
    """
    统一图像生成端点

    根据参数智能选择生成方式：
    - 0张参考图 + single → text_to_image
    - 1张参考图 + single → image_to_image
    - 多张参考图 + single → merge_images
    - 0张参考图 + sequence → text_to_sequence
    - 1张参考图 + sequence → image_to_sequence
    - 多张参考图 + sequence → images_to_sequence

    支持流式输出（SSE）
    """
    logger.info(f"[POST /api/generate-image] prompt={request.prompt[:50]}..., "
                f"refs={len(request.reference_images)}, mode={request.mode}, stream={request.stream}")

    llm_config = get_llm_config(raw_request)

    # Create image service with per-request config (no fallback — spec requirement)
    if not llm_config:
        raise HTTPException(status_code=403, detail="LLM configuration is required. Please configure your image generation API key first.")

    svc = ImageGenerationService(
        api_key=llm_config["api_key"],
        base_url=llm_config["base_url"],
        model=llm_config["model_id"],
    )

    try:
        if request.stream:
            # 流式输出 - 返回 SSE
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
                        max_images=request.max_images
                    ):
                        # 发送 SSE 格式数据
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
                    "X-Accel-Buffering": "no"
                }
            )

        else:
            # 非流式输出 - 返回 JSON
            result = svc.generate(
                prompt=request.prompt,
                reference_images=request.reference_images,
                mode=request.mode,
                stream=False,
                generation_type=request.generation_type,
                size=request.size,
                watermark=request.watermark,
                max_images=request.max_images
            )

            return result

    except Exception as e:
        logger.error(f"[POST /api/generate-image] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============ AI Provider Management ============

@custom_app.get("/api/ai/providers")
async def list_providers():
    """List available AI providers and their status"""
    try:
        providers = get_available_providers()
        return {
            "success": True,
            "providers": providers,
            "current": get_ai_provider()
        }
    except Exception as e:
        logger.error(f"Failed to list providers: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@custom_app.get("/api/ai/provider")
async def get_current_provider():
    """Get current AI provider configuration"""
    try:
        return {
            "success": True,
            "config": get_provider_config()
        }
    except Exception as e:
        logger.error(f"Failed to get provider config: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@custom_app.post("/api/ai/provider")
async def switch_provider(request: dict):
    """
    Switch AI provider

    Request body:
    {
        "provider": "openai" | "hunyuan"
    }
    """
    try:
        provider = request.get("provider")
        if not provider:
            return {
                "success": False,
                "error": "Provider name is required"
            }

        success = set_ai_provider(provider)
        if success:
            return {
                "success": True,
                "message": f"AI provider switched to {provider}",
                "config": get_provider_config(),
                "note": "Please restart the AgentOS service for changes to take effect"
            }
        else:
            return {
                "success": False,
                "error": "Failed to switch provider"
            }
    except Exception as e:
        logger.error(f"Failed to switch provider: {e}")
        return {
            "success": False,
            "error": str(e)
        }

# ============ AgentOS Setup ============

# Create team instances (optional)
# research_team = ResearchTeam()

# Create unified AgentOS with custom FastAPI app
agent_os = AgentOS(
    name="Story Agent OS",
    workflows=[
        storyboard_workflow,
        characters_workflow,
        locations_workflow,
        polish_workflow,
        script_workflow,
        clarification_workflow,
        director_workflow,
    ],
    # teams=[research_team],  # Uncomment if needed
    base_app=custom_app,  # Pass custom FastAPI app
    telemetry=False,  # Disable telemetry
)

# Get the combined app with both AgentOS routes and custom routes
app = agent_os.get_app()

# Apply middlewares to the combined app (Starlette middleware is LIFO: last added runs first)
# Note: _llm_config is now embedded client-side in the `message` JSON payload by agentos-client.ts.
# LLMContextMiddleware is kept to extract X-LLM-* headers into request.state for any custom
# FastAPI routes that may read them directly.
app.add_middleware(LLMContextMiddleware)  # Extracts X-LLM-* headers into request.state

# ============ Run AgentOS ============

if __name__ == "__main__":
    port = int(os.getenv("AGENTOS_PORT", os.getenv("PORT", 12322)))
    agent_os.serve(
        app="app:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )
