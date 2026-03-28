# AgentOS Storyboard Workflow

This directory contains the AgentOS native workflow implementation for storyboard generation.

## Architecture

We use [AgentOS](https://docs.agno.com/introduction) as the agentic runtime for processing long-form drama scripts into structured storyboards. The workflow includes:

1. **Text Chunking**: Long texts are split into manageable chunks (~1200 tokens each)
2. **Parallel Processing**: Each chunk is processed independently to extract scenes and shots
3. **Merging**: All scenes are merged and renumbered sequentially
4. **Validation**: Output is validated against the storyboard schema
5. **SSE Streaming**: Progress events are emitted during processing

## Files

- `storyboard_workflow.py` - Main AgentOS workflow definition
- `requirements.txt` - Python dependencies (agno, openai, pydantic, fastapi)
- `Dockerfile` - Container image for AgentOS runtime

## Environment Variables

Set these in `docker-compose.yml` or the repository root `.env` file (shared with the backend):

```bash
# Hunyuan AI Provider
HUNYUAN_OPENAPI_URL=http://hunyuanapi.woa.com/openapi/v1/
HUNYUAN_OPENAPI_KEY=your-key-here
HUNYUAN_MODEL_ID=hunyuan-turbos-latest

# AgentOS Security (optional)
AGENTOS_SECURITY_KEY=your-security-key
```

## Workflow API

The workflow exposes the following AgentOS API endpoint:

```bash
POST /workflows/StoryboardWorkflow/runs
Content-Type: application/x-www-form-urlencoded

projectId=<id>&text=<drama-text>&chunk_tokens=1200&stream=True
```

### Parameters

- `projectId`: Project identifier
- `text`: Full drama script text
- `chunk_tokens`: Max tokens per chunk (default: 1200)
- `stream`: Enable SSE progress streaming (True/False)

### Response (Non-streaming)

```json
{
  "projectId": "...",
  "scenes": [
    {
      "id": "scene-1",
      "title": "场景标题",
      "summary": "场景概述",
      "shots": [
        {
          "shot_number": "001",
          "shot_size": "中景",
          "duration_seconds": 5,
          "scene_description": "画面描述",
          "director_notes": "导演提示",
          "audio_description": "音频描述",
          "camera_angle": "平视",
          "camera_movement": "固定",
          "focal_length": "50mm"
        }
      ]
    }
  ]
}
```

### SSE Progress Events

When `stream=True`, the workflow emits progress events:

```json
{"type": "progress", "phase": "chunks_ready", "total_chunks": 5, "progress": 0}
{"type": "progress", "phase": "chunk_done", "chunk_index": 0, "progress": 16}
{"type": "progress", "phase": "chunk_done", "chunk_index": 1, "progress": 32}
...
{"type": "progress", "phase": "merge_start", "progress": 85}
{"type": "progress", "phase": "complete", "progress": 100, "scene_count": 12}
```

## Performance

| Text Length | Processing Time | Chunks |
|-------------|-----------------|--------|
| ~200 chars  | 5-10 seconds    | 1      |
| ~2000 chars | 1-2 minutes     | 2-3    |
| ~13000 chars| 5-8 minutes     | 10-15  |

## Development

### Local Run

```bash
cd backend/agentos
pip install -r requirements.txt

export HUNYUAN_OPENAPI_URL=...
export HUNYUAN_OPENAPI_KEY=...
export PORT=12322

python storyboard_workflow.py
```

### Docker Run

```bash
cd backend
docker-compose build agentos
docker-compose up agentos
```

### Health Check

```bash
curl http://localhost:12322/api/health
```

## Caching

The backend API caches storyboard results in Redis with a 7-day TTL. Cache keys are based on:

```
storyboard:{projectId}:{sha256(text).substring(0,16)}
```

## Integration

The backend integrates with AgentOS via:

- `backend/src/lib/agentos-client.ts` - HTTP client for AgentOS API
- `backend/src/api/routes/storyboard.ts` - Fastify routes with cache + SSE proxy
- `app/api/projects/[projectId]/storyboard/import/route.ts` - Next.js API route proxy
- `components/input/DramaTextInput.tsx` - Frontend SSE consumer

## References

- [AgentOS Documentation](https://docs.agno.com/introduction)
- [AgentOS API Reference](https://docs.agno.com/agent-os/api)

