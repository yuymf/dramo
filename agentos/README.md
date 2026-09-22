# Dramo AgentOS

FastAPI + Agno 工作流。只跑 AI，不碰数据库。

## 工作流

Agno 原生接口：`POST /workflows/{id}/runs`（id 小写，如 `reviseworkflow`）。

产品路径是剧本修订：

| Workflow | 作用 |
|----------|------|
| ReviseWorkflow | 按 `nodeIds` 范围改剧本节点 |

仓库里仍注册了 Storyboard / Script / Characters / Locations / Polish / Clarification / Inspirations，但产品写作用 revise。

自定义路由：

- `GET /health` — 探活
- `POST /api/generate-image` — 遗留 Seedream 端点，**不是**出图主路径。静帧走 Node `SD_WORKERS` 池。

## 本地

```bash
cd agentos
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 12322 --reload
```

LLM 密钥由 Node 按用户配置加密存储，调用时写入 `message` JSON 的 `_llm_config`。工作流不读 `AI_PROVIDER` / `OPENAI_*` / `ARK_API_KEY`。

## 测试

```bash
pip install -r requirements-dev.txt
pytest
```
