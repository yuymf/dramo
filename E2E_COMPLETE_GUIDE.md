# 🧪 Dramo E2E Tests - 完整使用指南

## 📊 测试覆盖范围总览

现在你有了一套完整的E2E测试套件，覆盖了 Dramo 的核心功能：

### 测试统计
```
烟雾测试 (Smoke Tests)           - 10 个 ✅
├─ 认证流程 (3个)
├─ 导航 (3个)
├─ API集成 (2个)
└─ 会话管理 (2个)

内容生成测试 (Content Gen)      - 15 个 🎬
├─ 内容生成流程 (8个)
├─ 数据输入和表单 (3个)
└─ 响应式设计 (4个)

总计：25 个测试 ✨
```

## 🚀 快速开始

### 1. 确保应用运行

```bash
# 在项目根目录
npm run dev
```

这会启动：
- 🌐 前端 (http://localhost:12323)
- 🔌 后端 (http://localhost:12321)
- 🤖 AgentOS (http://localhost:12322)

### 2. 运行烟雾测试（推荐从这里开始）

```bash
# 快速验证核心功能 (~40秒)
npm run e2e:chromium -- smoke.spec.ts
```

**预期结果：** 10/10 通过 ✅

### 3. 运行内容生成测试

```bash
# 测试完整的创作流程 (~60-90秒)
npm run e2e:chromium -- content-generation.spec.ts
```

**预期结果：**
- 如果有项目数据：15/15 通过 ✅
- 如果没有项目数据：15/15 跳过 ⏸️ (正常行为)

### 4. 创建测试项目（可选）

如果想要内容生成测试真正运行（而不是跳过）：

```bash
cd e2e
bash setup-test-data.sh
```

然后再次运行内容生成测试。

### 5. 运行所有测试

```bash
# 运行整个E2E套件
npm run e2e:chromium

# 或生成HTML报告
npm run e2e:chromium && npx playwright show-report
```

## 🔧 高级用法

### 调试特定测试

```bash
# 在浏览器中看到测试运行过程
npm run e2e:headed -- smoke.spec.ts

# 交互式调试模式
npm run e2e:debug -- smoke.spec.ts

# 只运行匹配的测试
npm run e2e:chromium -- smoke.spec.ts -g "should load login page"
```

### 跨浏览器测试

```bash
# Chromium (默认)
npm run e2e:chromium

# Firefox
npm run e2e:firefox

# WebKit (Safari)
npm run e2e:webkit

# 所有浏览器
npm run e2e
```

### 生成报告

```bash
# HTML测试报告
npm run e2e:chromium && npx playwright show-report

# 查看失败的截图/视频
# 在 test-results/ 目录中查看
```

## 📖 测试文档

### 烟雾测试 (Smoke Tests)

**文件：** `e2e/smoke.spec.ts`
**文档：** `e2e/SESSION_SUMMARY.md`

**覆盖：**
- ✅ 登录页面加载
- ✅ 无效凭证拒绝
- ✅ 有效认证成功
- ✅ 登录后页面显示
- ✅ 导航可用
- ✅ 会话持久性
- ✅ 项目网格显示
- ✅ 页面导航
- ✅ API请求
- ✅ 认证会话中的网络请求

### 内容生成测试 (Content Generation)

**文件：** `e2e/content-generation.spec.ts`
**文档：** `e2e/CONTENT_GENERATION_TESTS.md`

**覆盖：**
- ✅ 项目导航
- ✅ 输入表单访问
- ✅ 脚本编辑器
- ✅ 分镜界面
- ✅ 脚本模式切换 (线性/分支/分镜)
- ✅ 角色管理
- ✅ 场景管理
- ✅ 认证持久性
- ✅ 表单加载
- ✅ 表单交互
- ✅ 响应式设计 (桌面/平板)

## 📋 测试凭证

```
Email:    demo@example.com
Password: demo123456
```

## 🏗️ CI/CD 集成

### GitHub Actions 示例

创建 `.github/workflows/e2e-tests.yml`：

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Start services
        run: |
          npm run dev &
          sleep 10  # Wait for services to start

      - name: Run smoke tests
        run: npm run e2e:chromium -- smoke.spec.ts

      - name: Run content generation tests
        run: npm run e2e:chromium -- content-generation.spec.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## 🐛 故障排除

### 问题：测试都被跳过了

**原因：** 没有项目存在

**解决：**
1. 在 UI 中创建项目
2. 或运行 `bash e2e/setup-test-data.sh` 创建测试项目
3. 或忽略这个 - 测试会优雅地跳过

### 问题：连接被拒绝

**原因：** 后端或前端未运行

**检查：**
```bash
# 前端应该运行在这个端口
curl http://localhost:12323

# 后端应该运行在这个端口
curl http://localhost:12321/health

# 如果都不运行，启动它们
npm run dev
```

### 问题：认证失败

**原因：** 凭证错误或后端问题

**检查：**
```bash
# 测试凭证
curl -X POST http://localhost:12321/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo123456"}'

# 应该返回token
```

### 问题：找不到元素

**调试：**
```bash
# 用浏览器查看发生了什么
npm run e2e:headed -- smoke.spec.ts

# 或使用调试模式
npm run e2e:debug -- smoke.spec.ts
```

### 问题：超时

**原因：** 应用响应慢

**解决：**
1. 增加超时时间（在测试中）
2. 检查后端是否有错误
3. 检查网络连接

## 📈 测试性能

| 测试套件 | 测试数 | 时间 | 用途 |
|--------|-------|------|------|
| 烟雾 | 10 | ~40s | CI/CD, 快速验证 |
| 内容生成 | 15 | ~80-120s | 深度测试 |
| 全部 | 25 | ~2-3m | 完整验证 |

## 🎯 最佳实践

### 1. 本地开发
```bash
# 运行烟雾测试确保基本功能工作
npm run e2e:chromium -- smoke.spec.ts

# 使用 headed 模式进行交互式调试
npm run e2e:headed -- content-generation.spec.ts
```

### 2. 提交前
```bash
# 运行所有测试
npm run e2e:chromium
```

### 3. CI/CD
```bash
# 快速检查
npm run e2e:chromium -- smoke.spec.ts

# 或完整测试
npm run e2e:chromium
```

### 4. 生成报告
```bash
# 生成HTML报告
npm run e2e:chromium && npx playwright show-report
```

## 📚 相关文件

| 文件 | 用途 |
|------|------|
| `e2e/smoke.spec.ts` | 烟雾测试 (10个) |
| `e2e/content-generation.spec.ts` | 内容生成测试 (15个) |
| `e2e/helpers.ts` | 共享测试辅助函数 |
| `e2e/helpers.ts` | 登录和项目导航 |
| `playwright.config.ts` | Playwright配置 |
| `e2e/SESSION_SUMMARY.md` | 烟雾测试文档 |
| `e2e/CONTENT_GENERATION_TESTS.md` | 内容生成文档 |
| `e2e/STRATEGY.md` | 测试策略和下一步 |
| `e2e/setup-test-data.sh` | 创建测试数据 |

## 🚀 下一步

### 短期 (现在可以做)
1. ✅ 运行烟雾测试验证基本功能
2. ✅ 创建测试项目运行内容生成测试
3. ✅ 设置 GitHub Actions CI/CD

### 中期
1. 添加 `data-testid` 到组件改进选择器
2. 添加表单提交和完整生成流程测试
3. 添加 API 模拟和拦截

### 长期
1. 视觉回归测试
2. 性能基准测试
3. 扩展到更多浏览器
4. 用户路径测试

## 💡 提示

- **快速反馈：** 使用烟雾测试做快速验证
- **隔离问题：** 使用 `-g` 只运行特定测试
- **可视化调试：** 使用 `--headed` 看浏览器操作
- **交互调试：** 使用 `--debug` 暂停和检查
- **创建项目：** 手动在UI创建或运行setup脚本

## 📞 支持

如果遇到问题：

1. 检查 `e2e/TROUBLESHOOTING.md`
2. 运行 `npm run e2e:headed` 用浏览器调试
3. 检查测试输出的错误消息
4. 查看截图/视频在 `test-results/`

---

**现在你有了一套完整的E2E测试！🎉**

开始运行：
```bash
npm run e2e:chromium -- smoke.spec.ts
```
