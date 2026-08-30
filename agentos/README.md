# Dramo AgentOS

FastAPI + Agno 工作流。只跑 AI，不碰数据库。

## 工作流

全部走 Agno 原生接口：`POST /workflows/{id}/runs`（id 为小写，如 `storyboardworkflow`）。

| Workflow | 作用 |
|----------|------|
| StoryboardWorkflow | 台本 → 分镜（编剧 → 分镜 → 摄影/表演并行 → 细化） |
| ScriptWorkflow | 大纲 → 台本 |
| CharactersWorkflow | 提取角色 |
| LocationsWorkflow | 提取场景 |
| PolishWorkflow | 润色 |
| ClarificationWorkflow | 对话澄清需求 |
| InspirationsWorkflow | 灵感条目 |

自定义路由（不走 workflow）：

- `GET /health` — 探活
- `POST /api/generate-image` — Seedream 生图

## 本地

```bash
cd agentos
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 12322 --reload
```

LLM 密钥由 Node 后端按用户配置加密存储，调用时写入 `message` JSON 的 `_llm_config`。不要依赖进程环境变量跑工作流。

## 测试

```bash
pip install -r requirements-dev.txt
pytest
```
