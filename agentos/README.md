# Dramo AgentOS

FastAPI + Agno。只跑 AI，不碰数据库。生产只注册 **ReviseWorkflow**。

Agno 原生接口：`POST /workflows/reviseworkflow/runs`。

| Workflow | 作用 |
|----------|------|
| ReviseWorkflow | 按 `nodeIds` 范围改剧本节点 |

探活：`GET /health`（AgentOS 自带；compose 与 `checkAgentOSHealth` 都打这条）。

## 本地

```bash
cd agentos
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 12322 --reload
```

LLM 密钥由 Node 按用户配置加密存储，调用时写入 `message` JSON 的 `_llm_config`。

## 测试

```bash
pip install -r requirements-dev.txt
pytest
```
