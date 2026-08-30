# 第一期任务拆分（多 agent 协同）

范围只做 PRD 第一期。演示闭环：

**新建剧本项目 → 手写两场 → 角色/地点自动出现 → 选中对白让 AI 改 → 出一张角色图 → 导出 PDF。**

契约以 [phase1-contracts.md](./phase1-contracts.md) 为准。未写进契约的接口不要私自发明。文件所有权如下，禁止跨组改别人的主文件；要动共享文件先读契约再做最小补丁。

---

## 轨道总览

```
Track 0  契约 / Prisma / 共享类型     （先合入，其它轨道的前置）
Track A  账号会话 + 项目/集 CRUD
Track B  剧本节点 API + 推导 + 版本 + 修订
Track C  工作区四层壳 + 新建入口降级
Track D  语义编辑器 + 封面 + 两种格式
Track E  角色/地点页 + 出图按钮
Track F  SD worker 池 + GenerationTask
Track G  选区 AI（AgentOS + 浮层对话）
Track H  节点导出 TXT/PDF/DOCX
```

依赖：

```
0 → A, B, F
A + B → C, D, E, G, H
C + D + E + F + G + H → 联调验收
```

---

## Track 0 — 契约与数据模型

**状态：已合入本分支，后续 agent 不要改 schema / 类型字段名。**

- [x] 写死节点类型、封面、项目类型、API 路径（`docs/phase1-contracts.md`）
- [x] 重写 [`server/src/db/schema.prisma`](../server/src/db/schema.prisma)
- [x] 共享类型两端对齐
- [x] 新 migration `20260830140000_phase1_screenplay_workspace`（无旧数据兼容）

---

## Track A — 账号与项目

**主文件：** `server/src/middleware/session.ts`（新建）、`server/src/routes/auth.ts`、`server/src/routes/projects.ts`、`server/src/services/project.service.ts`、`server/src/server.ts`、`server/src/app.ts`

- [x] 删除 `default-user.ts` / `defaultUserMiddleware` / `ensureDefaultUser`
- [x] Cookie 会话：`POST /auth/register`、`POST /auth/login`、`POST /auth/logout`、`GET /auth/me`
- [x] 未登录 401；密码用 Node `scrypt`，不新增依赖
- [x] 项目 `type=script|cinema|spoken`，`format=hollywood|asian`
- [x] 创建 Script 项目时：当前用户为 OWNER，并建默认 Episode + 空 Screenplay
- [x] 前端：登录/注册页；`api()` 带 cookie（`credentials: 'include'`）

**不要动：** 编辑器、出图、AgentOS。

---

## Track B — 剧本 API 与推导

**主文件：** `server/src/routes/screenplay.ts`、`server/src/services/screenplay.service.ts`、`server/src/services/derive.service.ts`

- [x] `GET/PUT` 当前集剧本（nodes + cover）
- [x] PUT 后跑推导：场次标题 → Location；角色 cue → Character；同名合并
- [x] `GET` 项目角色/地点列表（新表，不再走 CharacterAsset 提取）
- [x] 版本：保存时自动快照；`GET versions`、`POST versions/:id/revert`
- [x] `POST .../revise`：只替换请求里的 nodeIds，禁止改范围外节点

**不要动：** Prisma schema、工作区壳、TipTap。

---

## Track C — 工作区壳

**主文件：** `web/app/projects/[id]/ProjectLayoutClient.tsx`、`web/app/projects/[id]/layout.tsx`、`web/components/workspace/*`、`web/components/home/CreativeInput.tsx`、`web/components/projects/NewProjectDialog.tsx`

- [x] 四层：窄轨 + 项目面板 + 中央 + 可拖 AI 浮层
- [x] 轨：剧本、角色、地点；底部「更多 → 口播」
- [x] 项目面板：项目名、格式、默认集（第一期只一集）
- [x] 拆掉右侧固定 Chat 分栏
- [x] 新建默认只给「剧本项目」；口播弱化
- [x] 删除假路由 `scripts/hollywood`、`scripts/dialogue`、`scripts/script`
- [x] 更新 `web/DESIGN.md` 工作区段落

**不要动：** 节点 schema、后端路由。

---

## Track D — 语义编辑器

**主文件：** `web/components/screenplay/*`、`web/app/projects/[id]/@content/scripts/page.tsx`

- [x] 一行一个语义节点，Tab 切换类型
- [x] 好莱坞（Courier 等宽 + 行业缩进）/ 亚洲（中文剧本缩进）由项目 format 切换
- [x] 封面与正文两个视图
- [x] 自动保存 PUT nodes
- [x] 光标/选区暴露给 AI 浮层（nodeIds）
- [x] 只读页数轴（约 1 页 ≈ 1 分钟）

**不要动：** 工作区轨/面板结构（只填中央画布）。

---

## Track E — 角色 / 地点页

**主文件：** `web/app/projects/[id]/@content/characters/page.tsx`、`.../locations/page.tsx`、对应 list 组件

- [x] 只读推导结果 + 可补描述
- [x] 改场次标题后刷新，地点是同一条不是新提取
- [x] 「生成肖像 / 生成场景图」只创建 GenerationTask，不改剧本

**不要动：** SD 调度实现（调 `POST /images/generations` 即可）。

---

## Track F — SD 池

**主文件：** `server/src/services/sd-pool.service.ts`、`server/src/services/job-runner.service.ts`、`server/src/routes/generation-jobs.ts`

- [x] 环境变量 `SD_WORKERS`：至少 2 个配置位（A1111 兼容 `POST /sdapi/v1/txt2img`）
- [x] 最短队列 + 探活；连续失败摘流
- [x] 同一 characterId 粘滞同一 worker
- [x] 删除 Seedream / AgentOS `runImageGeneration` 主路径
- [x] 任务状态：queued / running / completed / failed；结果写入 Asset 并挂到 Character/Location.images

**不要动：** 前端编辑器。

---

## Track G — 选区 AI

**主文件：** `agentos/workflows/revise_workflow.py`、`agentos/prompts/screenplay/revise.md`、`web/components/workspace/FloatingAI.tsx`、`server/src/routes/chat.ts`（或 screenplay revise 代理）

- [x] 请求必须带 scope（selection / scene）和 nodeIds
- [x] 模型只返回范围内的替换节点
- [x] 浮层发送时带上当前集、format、选区文本
- [x] Script 主路径禁止「生成整本」pipeline

**不要动：** 推导算法、SD 池。

---

## Track H — 导出与收口

**主文件：** `web/lib/utils/exporter.ts`、`web/lib/hooks/useScriptExport.ts`、`web/components/editor/ExportMenu.tsx`

- [x] 只从 nodes 生成 TXT / PDF / DOCX
- [x] Script 菜单不出现 Fountain / SRT / 提词器
- [x] 口播若未做完，导出入口不进默认剧本页

**不要动：** 节点类型定义。

---

## 联调验收（编排者）

1. [x] 注册登录 → 新建剧本项目进入四层壳
2. [x] 写两场（含场次标题与角色 cue）→ 角色/地点页出现对应实体
3. [x] 选中一句对白 → AI 只改这些节点（无 LLM 时范围内原样保留并写回）
4. [x] 对角色点出图 → 任务进池（无 worker 时失败原因：「没有可用的 Stable Diffusion worker」）
5. [x] 导出 TXT / PDF / DOCX 只从 nodes 生成（Playwright 覆盖 TXT 下载）
6. [x] 默认新建走不到直播 pipeline / 分支画布 / 假 hollywood 路由；`/storyboard` 重定向回剧本
