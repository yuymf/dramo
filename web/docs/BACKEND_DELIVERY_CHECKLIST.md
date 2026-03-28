# 后端交付清单

## 文档概览

本次更新已完成后端 API 规范的全面统一与高并发架构方案设计。所有文档已同步更新至 v3.0。

---

## 📁 已更新文档

### 1. API 接口规范
- **文件**: `docs/BACKEND_API_SPEC.md` (v2.0) + `docs/BACKEND_API_SPEC_V3_ADDENDUM.md` (v3.0)
- **版本**: 3.0
- **更新内容**:
  - ✅ **v3.0**: 单项目单台本架构，15个新增接口
  - ✅ **v3.0**: 台本三种形式（linear/branching/storyboard）
  - ✅ **v3.0**: AI对话、角色/地点资产生成、历史版本管理
  - ✅ **v3.0**: 灵感推荐 v2（轻量GET + 重上下文POST）
  - ✅ **v3.0**: 文本润色增强（4种操作）
  - ✅ 引入 Bearer Token 认证机制
  - ✅ 统一错误响应模型（含错误码空间）
  - ✅ 异步任务模型（202 + taskId + 轮询）
  - ✅ 幂等性保证（Idempotency-Key）
  - ✅ 限流规范（X-RateLimit-* 响应头）
  - ✅ 健康检查接口
  - ✅ 新增任务查询接口 `GET /api/tasks/{taskId}`
  - ✅ 统一响应包封（`{ data }` / `{ data, pagination }`）
  - ✅ 废弃接口标记与迁移指引
  - ✅ 详细的输入输出示例
  - ✅ 迁移指南（v2.0 → v3.0）

### 1.1 API 变更总结 ⭐ 新增
- **文件**: `docs/API_CHANGES_SUMMARY.md`
- **版本**: 3.0
- **内容**:
  - ✅ v2.0 → v3.0 核心架构变更
  - ✅ 完整的新增/废弃接口清单
  - ✅ 数据模型变更对比
  - ✅ 迁移指南与示例代码
  - ✅ 向后兼容性说明

### 2. OpenAPI 规范（JSON）
- **文件**: `public/openapi.json`
- **版本**: 2.0.0
- **更新内容**:
  - ✅ 全局 Bearer 认证（除 `/api/health`）
  - ✅ 完整的错误响应定义
  - ✅ 任务相关 Schema（TaskResponse, TaskStatus）
  - ✅ 幂等键参数定义
  - ✅ 限流响应头定义
  - ✅ 所有接口支持异步模式（202）
  - ✅ 统一 InspirationsResponse 包封
  - ✅ 详细的参数校验规则

### 3. OpenAPI 规范（YAML）
- **文件**: `specs/001-ai-ai-ai/contracts/openapi.yaml`
- **版本**: 2.0.0
- **更新内容**: 与 JSON 版本完全一致

### 4. 高并发架构方案 ⭐ 新增
- **文件**: `docs/BACKEND_ARCHITECTURE.md`
- **版本**: 1.1
- **内容**:
  - ✅ 完整技术栈选型（含原因）
  - ✅ 详细架构图与数据流
  - ✅ 核心代码示例（TypeScript）
  - ✅ 数据库 Schema（Prisma）
  - ✅ 缓存策略与多级缓存
  - ✅ Docker Compose 配置
  - ✅ Kubernetes 部署配置（含 HPA）
  - ✅ 监控告警规则（Prometheus）
  - ✅ 性能优化建议
  - ✅ 安全措施
  - ✅ 成本估算（小规模/中规模）
  - ✅ **Python AgentOS 融合方案**（可选）

### 5. AgentOS 集成示例 ⭐ 新增
- **文件**: `docs/AGENTOS_INTEGRATION.md`
- **版本**: 1.0
- **内容**:
  - ✅ 完整 Python AgentOS 实现（FastAPI + Agno）
  - ✅ Node.js Worker 集成代码
  - ✅ 错误映射与重试逻辑
  - ✅ 灰度策略实现
  - ✅ Docker Compose 配置
  - ✅ 监控与故障排查指南
  - ✅ 性能调优建议

---

## 🎯 关键对齐点

### 认证机制
- **方式**: Bearer Token (JWT)
- **格式**: `Authorization: Bearer <token>`
- **例外**: `/api/health` 无需认证
- **实现**: 开发环境可使用固定 token 或跳过验证

### 异步任务模型

**触发接口**（返回 202）:
- `POST /api/scripts` - 生成台本
- `POST /api/scripts/{id}/regenerate` - 重新生成场景
- `POST /api/inspirations/refresh` - 刷新灵感

**轮询接口**:
- `GET /api/tasks/{taskId}` - 查询任务状态

**任务状态**:
- `queued` - 排队中
- `running` - 执行中
- `succeeded` - 成功（含 result）
- `failed` - 失败（含 error）

### 统一响应格式

**列表响应**:
```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  }
}
```

**单项响应**:
```json
{ "id": "...", "name": "..." }
```

**错误响应**:
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "请求频率超限",
    "details": {},
    "retryable": true
  },
  "requestId": "req_abc123"
}
```

### 灵感接口统一

**之前**（不一致）:
- `openapi.yaml`: `GET /api/inspirations?scriptId=...`
- `openapi.json`: `GET /api/inspirations?projectId=...`

**现在**（统一）:
- 所有文档: `GET /api/inspirations?projectId=...`
- 刷新响应: `{ data: Inspiration[] }` （统一包封）

---

## 🚀 推荐后端方案

### 技术栈

| 组件 | 推荐方案 | 原因 |
|------|---------|------|
| **网关** | Nginx / Cloudflare | 限流、缓存、SSL 终止 |
| **API 服务** | Node.js (Fastify) + TypeScript | 与前端同栈、高性能 I/O |
| **队列** | Redis + BullMQ | 简单可靠、重试/延时易用 |
| **Worker** | 独立进程池 | 隔离 AI 调用、可扩展 |
| **数据库** | PostgreSQL | ACID、JSON 支持 |
| **缓存** | Redis | 高性能、持久化 |
| **观测** | OpenTelemetry + Prometheus | 标准化追踪与指标 |
| **部署** | Docker + Kubernetes | 水平扩展、HPA |

### 为什么选择这套方案

1. **I/O 密集特性**: Node.js 事件循环天然适合高并发 I/O
2. **队列解耦**: 长耗时任务异步化，释放 API 吞吐
3. **成本可控**: 高峰期队列缓冲，Worker 按需扩展
4. **可观测性**: 统一追踪链路，快速定位瓶颈
5. **渐进式扩展**: 初期单机部署，后期水平扩展

### 性能指标（SLO）

| 接口类型 | P95 延迟 | 说明 |
|---------|---------|------|
| 查询接口 | < 200ms | 项目/台本列表、详情 |
| 变更接口 | < 500ms | 创建/更新/删除 |
| 异步任务 | 队列等待 < 5s<br>总时长 < 120s | 完整台本生成 |
| 灵感推荐 | < 2s | 实时推荐 |

### 并发能力

- **小规模**（< 1000 用户）: 2 API + 2 Worker = ~$330/月
- **中规模**（1000-10000 用户）: 5 API + 5 Worker = ~$1950/月
- **大规模**: HPA 自动扩缩至 10+ 实例

---

## 📋 接口清单（v3.0: 30+ 个）

### 核心接口 (保留自 v2.0)

| 模块 | 方法 | 路径 | 异步 | 认证 |
|------|------|------|------|------|
| 系统 | GET | /api/health | - | ❌ |
| 项目 | GET | /api/projects | - | ✅ |
| 项目 | POST | /api/projects | - | ✅ |
| 项目 | GET | /api/projects/{id} | - | ✅ |
| 项目 | PUT | /api/projects/{id} | - | ✅ |
| 项目 | DELETE | /api/projects/{id} | - | ✅ |
| 灵感 | POST | /api/inspirations/favorite | - | ✅ |
| 灵感 | GET | /api/inspirations/favorites | - | ✅ |
| 润色 | POST | /api/polish | - | ✅ |
| 任务 | GET | /api/tasks/{taskId} | - | ✅ |

### 新增接口 (v3.0)

| 模块 | 方法 | 路径 | 异步 | 认证 |
|------|------|------|------|------|
| **项目台本** | GET | /api/projects/{id}/script | - | ✅ |
| **项目台本** | POST | /api/projects/{id}/script | ✅ | ✅ |
| **项目台本** | PATCH | /api/projects/{id}/script/content | - | ✅ |
| **场景重生** | POST | /api/projects/{id}/script/scenes/{sceneId}/regenerate | ✅ | ✅ |
| **灵感轻量** | GET | /api/inspirations/{projectId} | - | ✅ |
| **灵感重量** | POST | /api/inspirations/{projectId}/recommend | ✅ | ✅ |
| **AI对话** | GET | /api/chat/{projectId}/messages | - | ✅ |
| **AI对话** | POST | /api/chat/{projectId}/messages | - | ✅ |
| **AI对话** | POST | /api/chat/{projectId}/reset | - | ✅ |
| **角色资产** | POST | /api/projects/{id}/characters/generate-3view | ✅ | ✅ |
| **角色资产** | GET | /api/projects/{id}/characters/assets | - | ✅ |
| **地点资产** | POST | /api/projects/{id}/locations/generate-image | ✅ | ✅ |
| **地点资产** | GET | /api/projects/{id}/locations/assets | - | ✅ |
| **历史版本** | GET | /api/projects/{id}/script/versions | - | ✅ |
| **历史版本** | POST | /api/projects/{id}/script/versions/{versionId}/revert | - | ✅ |
| **角色管理** | GET | /api/characters | - | ✅ |
| **角色管理** | GET | /api/characters/{id} | - | ✅ |

### 已删除接口 (v3.0)

以下接口的代码已从代码库中完全移除：

| 模块 | 方法 | 路径 | 状态 | 迁移至 |
|------|------|------|------|--------|
| ~~台本~~ | ~~GET~~ | ~~/api/scripts~~ | **已删除** | GET /api/projects/{id}/script |
| ~~台本~~ | ~~POST~~ | ~~/api/scripts~~ | **已删除** | POST /api/projects/{id}/script |
| ~~灵感~~ | ~~POST~~ | ~~/api/inspirations/refresh~~ | **已删除** | POST /api/inspirations/{id}/recommend |

> **重要**: 这些接口的代码已完全移除，不再提供任何响应。所有调用方必须迁移到新接口。

---

## ✅ 实施检查清单

### 阶段 1: 基础设施（1-2 周）

- [ ] 搭建 PostgreSQL 主从集群
- [ ] 部署 Redis 实例（缓存 + 队列）
- [ ] 配置 Nginx 反向代理与限流
- [ ] 设置 CI/CD 流水线
- [ ] 配置监控（Prometheus + Grafana）

### 阶段 2: 核心 API（2-3 周）

- [ ] 实现认证中间件（JWT）
- [ ] 实现限流中间件（Redis）
- [ ] 实现项目管理接口（CRUD）
- [ ] 实现台本管理接口（CRUD）
- [ ] 实现健康检查接口
- [ ] 统一错误处理

### 阶段 3: 异步任务（2-3 周）

- [ ] 搭建 BullMQ 队列
- [ ] 实现 Worker 进程
- [ ] 实现任务查询接口
- [ ] 集成 AI 服务（OpenAI/自建）
- [ ] 实现台本生成任务
- [ ] 实现场景重生成任务
- [ ] 实现灵感刷新任务

### 阶段 4: 优化与测试（1-2 周）

- [ ] 数据库索引优化
- [ ] 缓存策略实施
- [ ] 性能压测（JMeter/k6）
- [ ] 安全审计
- [ ] 文档完善
- [ ] 集成测试

### 阶段 5: 上线准备（1 周）

- [ ] 生产环境部署
- [ ] 监控告警配置
- [ ] 备份恢复测试
- [ ] 灰度发布计划
- [ ] 应急预案

---

## 📊 验收标准

### 功能验收

- ✅ 所有 19 个接口按规范实现
- ✅ 异步任务正常排队与执行
- ✅ 认证与限流正常工作
- ✅ 错误响应符合规范
- ✅ 健康检查可用

### 性能验收

- ✅ 查询接口 P95 < 200ms（100 并发）
- ✅ 变更接口 P95 < 500ms（50 并发）
- ✅ 任务队列等待 < 5s（10 并发生成）
- ✅ 完整台本生成 < 120s
- ✅ 系统可用性 > 99.5%（7 天）

### 安全验收

- ✅ JWT Token 正常验证
- ✅ 限流正常触发（429 响应）
- ✅ SQL 注入防护有效
- ✅ 敏感数据加密
- ✅ HTTPS 强制启用

---

## 📞 支持与联系

### 文档位置

详细文档索引请查看 [docs/README.md](README.md)

- API 规范: `docs/BACKEND_API_SPEC.md` + `docs/BACKEND_API_SPEC_V3_ADDENDUM.md`
- 架构方案: `docs/BACKEND_ARCHITECTURE.md`
- API 变更: `docs/API_CHANGES_SUMMARY.md`
- OpenAPI (JSON): `public/openapi.json`
- OpenAPI (YAML): `specs/001-ai-ai-ai/contracts/openapi.yaml`

### 在线工具

- **Swagger UI**: 导入 `openapi.json` 查看交互式文档
- **Postman**: 导入 OpenAPI 规范生成请求集合
- **OpenAPI Generator**: 自动生成客户端 SDK

### 示例请求

```bash
# 健康检查
curl http://localhost:3000/api/health

# 创建项目（需认证）
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "测试项目"}'

# 生成台本（异步）
# 注意：此接口已删除，请使用 POST /api/projects/{projectId}/script
# curl -X POST http://localhost:3000/api/projects/proj_123/script \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "structured",
    "form": "linear",
    "contentType": "short_video",
    "title": "直播带货·新品发布",
    "parameters": {
      "topic": "智能手表",
      "goal": "展示功能，引导下单"
    }
  }'

# 查询任务状态
curl http://localhost:3000/api/tasks/task_abc123 \
  -H "Authorization: Bearer <token>"
```

---

## 🤖 AgentOS 融合方案（可选增强）

### 概述

对于需要复杂多智能体编排、快速迭代 AI 逻辑的场景，可选择引入 [Agno AgentOS](https://docs.agno.com/introduction) 作为 AI 计算侧车微服务。

**核心优势**:
- 多智能体能力与复杂工作流编排
- Python 生态丰富的 LLM/向量/评估工具链
- AI 迭代速度提升 50%+
- 解耦 AI 逻辑与 API 契约，降低变更风险

**核心原则**:
- Node.js 保持统一 API 门面、鉴权、限流、幂等
- AgentOS 专注 AI 生成逻辑
- 对外 OpenAPI 契约不变，前端无感知

### 融合架构

```
[前端] → [Node API] → [BullMQ] → [Node Worker]
                                        ↓
                                 ┌──────┴──────┐
                                 ↓             ↓
                          [Node 实现]  [AgentOS (FastAPI)]
                          (回退方案)        ↓
                                        [Agno Agent]
                                            ↓
                                        [LLM API]
```

### 实施步骤

**阶段 1: 基础搭建**（1 周）
- [ ] 搭建 Python AgentOS 服务（FastAPI + Agno）
- [ ] 实现 3 个核心接口（生成/重生成/刷新）
- [ ] 配置 Docker Compose 开发环境
- [ ] 健康检查与基础监控

**阶段 2: Node 集成**（1 周）
- [ ] 实现 AgentOS HTTP 客户端
- [ ] 错误映射与重试逻辑
- [ ] 断路器与回退机制
- [ ] 灰度策略实现（10% 流量）

**阶段 3: 监控与调优**（1 周）
- [ ] Prometheus 指标采集
- [ ] OpenTelemetry 分布式追踪
- [ ] 性能压测与调优
- [ ] 告警规则配置

**阶段 4: 灰度上线**（1-2 周）
- [ ] 10% → 50% → 100% 流量切换
- [ ] 对比 P95 延迟与成本
- [ ] 稳定性观察与优化
- [ ] 文档与运维手册更新

### 成本对比

| 方案 | 小规模 | 中规模 | 增量 |
|------|--------|--------|------|
| 纯 Node | $330/月 | $1950/月 | 基线 |
| Node + AgentOS | $370/月 | $2150/月 | +10-12% |

**收益**:
- AI 迭代速度提升 50%+
- 多智能体能力
- Python 生态工具链
- 解耦 AI 逻辑变更风险

### 何时推荐

✅ **推荐使用**:
- 需要复杂多智能体协作
- AI 逻辑迭代频繁
- 团队有 Python 经验
- 需要快速实验新模型/工具

❌ **不推荐使用**:
- AI 逻辑简单
- 团队缺少 Python 运维经验
- 对统一技术栈有强要求
- 短期无法投入额外成本

### 参考文档

- [AgentOS 融合方案详解](BACKEND_ARCHITECTURE.md#python-agentos-融合方案可选)
- [完整集成示例代码](AGENTOS_INTEGRATION.md)
- [内部服务集成规范](BACKEND_API_SPEC.md#附录内部服务集成规范可选)
- [Agno 官方文档](https://docs.agno.com/introduction)

---

## 🎉 总结

本次更新完成了以下目标：

1. ✅ **统一规范**: 所有文档对齐至 v2.0，消除不一致
2. ✅ **异步模型**: 引入 202 + taskId 轮询，支持高并发
3. ✅ **错误规范**: 统一错误模型与错误码空间
4. ✅ **认证机制**: Bearer Token 全局认证
5. ✅ **限流保护**: 明确限流规则与响应头
6. ✅ **架构方案**: 提供完整的高并发实施方案
7. ✅ **代码示例**: 包含 TypeScript 核心代码
8. ✅ **部署配置**: Docker Compose + Kubernetes
9. ✅ **成本估算**: 小规模/中规模成本参考
10. ✅ **AgentOS 融合**: 可选的 Python 多智能体增强方案

**后端团队可直接基于本文档开始实施：**
- **纯 Node 方案**: 预计 6-8 周完成全部开发与测试
- **Node + AgentOS 方案**: 预计 8-10 周（含 AgentOS 集成）

---

*交付日期*: 2025-10-16  
*文档版本*: 2.1  
*维护者*: Frontend Team

