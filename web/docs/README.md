# 项目文档索引

本文档提供项目文档的完整索引和导航。

## 📚 文档分类

### 核心规范文档

1. **[后端 API 接口规范](BACKEND_API_SPEC.md)** (v2.0 基础)
   - 完整的 REST API 接口定义
   - 认证、限流、错误处理规范
   - 异步任务模型（202 + taskId 轮询）
   - 详细的请求/响应示例

2. **[后端 API 接口规范 v3.0 补充](BACKEND_API_SPEC_V3_ADDENDUM.md)** ⭐
   - v3.0 新增接口（15个）
   - 单项目单台本架构
   - 三种台本形式（linear/branching/storyboard）
   - 数据模型变更

3. **[API 变更总结](API_CHANGES_SUMMARY.md)** ⭐
   - v2.0 → v3.0 核心架构变更
   - 迁移指南与兼容性说明
   - 完整接口对比表
   - 已删除接口说明

### 架构与实施文档

4. **[高并发架构方案](BACKEND_ARCHITECTURE.md)**
   - 推荐技术栈（Node.js + Fastify + PostgreSQL + Redis）
   - 完整架构图与数据流
   - 核心代码示例（TypeScript）
   - Docker Compose + Kubernetes 部署配置
   - 监控告警与性能优化

5. **[后端交付清单](BACKEND_DELIVERY_CHECKLIST.md)**
   - 实施检查清单（5 个阶段）
   - 验收标准（功能/性能/安全）
   - 成本估算（小规模/中规模）
   - 测试用例示例

### AgentOS 集成文档

6. **[AgentOS 迁移总结](AGENTOS_MIGRATION_SUMMARY.md)**
   - AgentOS Native API 迁移实现总结
   - 架构变更与文件变更清单
   - 性能对比与用户体验改进
   - 部署步骤

7. **[AgentOS 集成示例](AGENTOS_INTEGRATION.md)**
   - 最小可运行示例
   - Python AgentOS 实现
   - Node.js Worker 集成
   - 完整代码示例

### 功能指南

8. **[分镜 Schema 指南](STORYBOARD_SCHEMA_GUIDE.md)**
   - Storyboard 数据结构说明
   - 前端映射规则
   - Schema 变更指南

9. **[测试指南](TESTING_GUIDE.md)**
   - Landing Page 测试清单
   - 功能测试步骤
   - 测试用例

10. **[Landing Page 说明](LANDING_PAGE_README.md)**
    - Landing Page 实现说明
    - 登录流程
    - 路由流程
    - 核心文件清单

## 🗂️ 文档使用指南

### 后端开发人员

**开始开发前**：
1. 阅读 [API 变更总结](API_CHANGES_SUMMARY.md) 了解 v3.0 架构变更
2. 阅读 [后端 API 接口规范 v3.0 补充](BACKEND_API_SPEC_V3_ADDENDUM.md) 了解新增接口
3. 参考 [后端 API 接口规范](BACKEND_API_SPEC.md) 了解基础规范
4. 查看 [高并发架构方案](BACKEND_ARCHITECTURE.md) 了解技术选型

**实施阶段**：
1. 使用 [后端交付清单](BACKEND_DELIVERY_CHECKLIST.md) 跟踪进度
2. 参考 [AgentOS 集成示例](AGENTOS_INTEGRATION.md) 如果需要集成 AgentOS

### 前端开发人员

**开始开发前**：
1. 阅读 [API 变更总结](API_CHANGES_SUMMARY.md) 了解 API 变更
2. 查看 [分镜 Schema 指南](STORYBOARD_SCHEMA_GUIDE.md) 了解分镜数据结构

**开发阶段**：
1. 参考 [后端 API 接口规范](BACKEND_API_SPEC.md) 和 [v3.0 补充](BACKEND_API_SPEC_V3_ADDENDUM.md) 了解接口详情
2. 使用 [测试指南](TESTING_GUIDE.md) 进行测试

### 运维人员

1. 参考 [高并发架构方案](BACKEND_ARCHITECTURE.md) 了解部署架构
2. 查看 [AgentOS 迁移总结](AGENTOS_MIGRATION_SUMMARY.md) 了解 AgentOS 部署
3. 使用 [后端交付清单](BACKEND_DELIVERY_CHECKLIST.md) 进行验收

## 📝 文档维护

### 文档更新原则

1. **及时性**: 代码变更后及时更新相关文档
2. **准确性**: 确保文档与代码实现一致
3. **完整性**: 重要变更需要更新所有相关文档
4. **清晰性**: 使用清晰的语言和结构

### 文档版本

- **v2.0**: 基础 API 规范（`BACKEND_API_SPEC.md`）
- **v3.0**: 单项目单台本架构（`BACKEND_API_SPEC_V3_ADDENDUM.md`）

### 已删除文档

以下文档已合并或删除，信息已整合到其他文档中：

- ~~`backend_consolidated.md`~~ - 内容已整合到 `BACKEND_ARCHITECTURE.md` 和 `BACKEND_DELIVERY_CHECKLIST.md`
- ~~`V3_IMPLEMENTATION_SUMMARY.md`~~ - 内容已整合到 `API_CHANGES_SUMMARY.md`
- ~~`DOCUMENTATION_UPDATE_SUMMARY.md`~~ - 临时文档，已删除

详细整理说明请查看 [文档整理总结](DOCUMENTATION_CLEANUP_SUMMARY.md)

## 🔗 外部资源

- [OpenAPI 规范 (JSON)](../public/openapi.json)
- [OpenAPI 规范 (YAML)](../specs/001-ai-ai-ai/contracts/openapi.yaml)
- [Agno AgentOS 文档](https://docs.agno.com/introduction)

---

**最后更新**: 2025-01-XX  
**维护者**: AI Assistant

