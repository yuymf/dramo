# 🚀 快速参考 - E2E 测试命令速查

## ⚡ 最常用命令（复制粘贴）

### 1. 看完整的生成过程（Pro Mode）
```bash
npm run e2e:headed -- complete-generation-flow.spec.ts --grep "Pro Mode"
```
⏱️ 7秒 | 📺 看完整的表单填充→生成→页面导航

### 2. 看所有模式和页面转换
```bash
npm run e2e:headed -- complete-generation-flow.spec.ts
```
⏱️ 22秒 | 📺 看Pro/Drama/Base模式和页面转换监控

### 3. 看详细的日志输出
```bash
npm run e2e:chromium -- complete-generation-flow.spec.ts
```
📊 查看11个步骤的详细日志和URL变化

### 4. 生成完整的视频报告
```bash
npm run e2e:chromium -- complete-generation-flow.spec.ts
npx playwright show-report
```
🎥 含视频、截图和时间统计的HTML报告

---

## 📺 按输入模式查看

### Pro Mode（结构化表单）
```bash
npm run e2e:headed -- complete-generation-flow.spec.ts --grep "Pro Mode"
```

### Drama Mode（导入剧本）
```bash
npm run e2e:headed -- complete-generation-flow.spec.ts --grep "Drama Mode"
```

### Base Mode（聊天输入）
```bash
npm run e2e:headed -- complete-generation-flow.spec.ts --grep "Base Mode"
```

### 页面转换监控
```bash
npm run e2e:headed -- complete-generation-flow.spec.ts --grep "page transitions"
```

---

## 🔧 其他选项

### 调试模式（逐步执行）
```bash
npm run e2e:debug -- complete-generation-flow.spec.ts
```

### 只看第一个测试
```bash
npm run e2e:headed -- complete-generation-flow.spec.ts --grep "Pro Mode" --max-failures=1
```

### 查看完整的三种输入方式
```bash
npm run e2e:headed -- input-modes-with-generation.spec.ts
```

---

## 📋 可观看的页面序列

完整的生成流程包括这些页面（按顺序）：

1. ✅ 登录页面 (`/login`)
2. ✅ 输入页面 (`/projects/:id/input?mode=pro`)
3. ✅ 表单填充过程（实时看到输入）
4. ✅ 生成过程（⏳ 检测到加载指示器）
5. ✅ 脚本编辑页面 (`/projects/:id/scripts`)
6. ✅ 分镜页面 (`/projects/:id/storyboard`)
7. ✅ 字符管理页面 (`/projects/:id/characters`)
8. ✅ 位置管理页面 (`/projects/:id/locations`)

**所有这些页面都会在浏览器中顺序显示！** 🎬

---

## 💾 核心 Mock 数据

所有测试使用同一个项目：
```javascript
const TEST_PROJECT_ID = 'cmnao4tu9000166e5qg59gno4';
```

**Mock 故事数据：**
- **标题:** 魔法学院的冒险故事
- **角色:** 艾丽丝（学生）、导师
- **三幕故事:**
  - 第一幕：开场（魔法学院大厅）
  - 第二幕：训练（魔法训练室）
  - 第三幕：高潮（魔法竞技场对决）

---

## ✨ 关键特性

✅ **完整的中间过程可视化**
- 不跳过任何页面
- 看到加载动画
- 看到所有页面转换

✅ **11个详细步骤（Pro Mode）**
- 每步都有清晰的状态
- 每步都记录URL变化
- 每步都有验证

✅ **4种查看方式**
- 🖥️ 实时浏览器（最直观）
- 📝 控制台日志（最详细）
- 🎥 HTML报告（最完整）
- 🔧 调试工具（最强大）

✅ **生成过程监控**
- 检测加载指示器
- 追踪页面转换
- 验证内容加载

---

## 🎯 不同场景的推荐命令

| 场景 | 命令 | 时间 |
|------|------|------|
| 快速了解生成过程 | `npm run e2e:headed -- complete-generation-flow.spec.ts --grep "Pro Mode"` | 7s |
| 查看所有模式 | `npm run e2e:headed -- complete-generation-flow.spec.ts` | 22s |
| 分析细节和日志 | `npm run e2e:chromium -- complete-generation-flow.spec.ts` | 28s |
| 生成报告 | `npm run e2e:chromium -- complete-generation-flow.spec.ts && npx playwright show-report` | 30s |
| 调试问题 | `npm run e2e:debug -- complete-generation-flow.spec.ts` | ⏸️ 手动 |

---

## 📖 了解更多

- **详细指南:** `E2E_COMPLETE_GENERATION_GUIDE.md`
- **快速指南:** `E2E_VIEW_PROCESS.md`
- **输入模式详解:** `E2E_INPUT_MODES_GUIDE.md`
- **测试总结:** `E2E_INPUT_MODES_SUMMARY.md`
- **主要指南:** `README_E2E_TESTS.md`

---

## ✅ 测试状态

```
✅ 4 tests passed (100%)
✅ Pro Mode - 11 detailed steps
✅ Drama Mode - Full flow
✅ Base Mode - Chat input
✅ Page Transitions - Monitoring

Execution time: ~22s (headed), ~28s (chromium)
```

---

**立即开始：**
```bash
npm run e2e:headed -- complete-generation-flow.spec.ts --grep "Pro Mode"
```

在浏览器中观看完整的生成过程！🎬
