# AgentOS 调用约定

前端不直连 AgentOS。浏览器 → `/api/*` → Hono → `POST {AGENTOS}/workflows/{id}/runs`。

工作流 id 为名称小写：`storyboardworkflow`、`scriptworkflow`、`charactersworkflow`、`locationsworkflow`、`polishworkflow`、`clarificationworkflow`、`directorworkflow`、`inspirationsworkflow`。

生图走自定义路由：`POST {AGENTOS}/api/generate-image`。

LLM 密钥由 Hono 按用户解密后写入 `message` JSON 的 `_llm_config`，不靠 AgentOS 进程环境变量。
