# 🎬 查看输入到分镜完整过程 - 快速指南

## ⚡ 最快的方式（推荐）

### 实时观看浏览器（所有操作都能看到）
```bash
npm run e2e:headed -- input-modes-with-generation.spec.ts
```

✨ **你会看到：**
- 登录页面
- 输入页面加载
- 点击切换输入模式（Drama/Pro/Base）
- 表单填充（实时输入内容）
- 点击生成按钮
- 等待生成
- 页面导航到分镜
- 分镜内容加载

💡 **可以暂停和控制速度** - 浏览器会打开，所有操作都是真实的，不是录像！

---

## 📊 查看详细日志

### 运行测试并看到每个步骤的日志
```bash
npm run e2e:chromium -- input-modes-with-generation.spec.ts
```

**输出示例：**
```
========== 📝 COMPLETE WORKFLOW TEST ==========

Step 1: ✅ On input page
Step 2: ✅ Switched to Pro mode
Step 3: ✅ Filled form with test data
Step 4: 🔄 Clicking generate button...
Step 5: ✅ Generation complete
Step 6: 🔄 Navigating to storyboard...
Step 7: ✅ Reached storyboard page
Step 8: ✅ Storyboard content loaded

========== ✨ WORKFLOW COMPLETE ✨ ==========
```

---

## 📹 查看完整的视频和截图

### 生成并打开HTML报告
```bash
npm run e2e:chromium -- input-modes-with-generation.spec.ts
npx playwright show-report
```

**报告中包括：**
- 📹 完整的测试录像（可看整个过程）
- 📸 每个步骤的截图
- ⏱️ 时间统计
- 📝 完整的测试日志

---

## 🎯 只看某个特定的测试

### Drama Mode（导入剧本）
```bash
npm run e2e:headed -- input-modes-with-generation.spec.ts \
  --grep "should input script via drama mode"
```

### Pro Mode（结构化表单）
```bash
npm run e2e:headed -- input-modes-with-generation.spec.ts \
  --grep "should input via pro mode"
```

### Base Mode（聊天输入）
```bash
npm run e2e:headed -- input-modes-with-generation.spec.ts \
  --grep "should input via base mode"
```

### 完整流程（最详细的日志）
```bash
npm run e2e:headed -- input-modes-with-generation.spec.ts \
  --grep "should track complete workflow"
```

---

## 🔧 调试模式（最强大的控制）

### 逐步执行测试
```bash
npm run e2e:debug -- input-modes-with-generation.spec.ts
```

**特点：**
- ⏸️ 在任意位置暂停
- ⏭️ 逐步执行代码
- 🔍 检查DOM元素
- 💾 修改代码后重新运行
- 📊 查看网络请求

---

## 📋 三种输入方式的完整流程

### 1️⃣ Drama Mode（导入剧本）
```
登录 → 输入页面 → 点击"导入剧本" →
  粘贴剧本文本 → 点击"生成" →
  分镜页面加载 ✅
```

### 2️⃣ Pro Mode（结构化表单）
```
登录 → 输入页面 → 点击"剧本生成器" →
  填充表单（主题、关键词、描述等）→ 点击"生成" →
  分镜页面加载 ✅
```

### 3️⃣ Base Mode（聊天输入）
```
登录 → 输入页面 → 点击"空白故事板" →
  输入自然语言提示 → 点击发送 →
  分镜页面加载 ✅
```

---

## ✅ 测试状态

| 测试 | 状态 | 时间 |
|------|------|------|
| Drama Mode | ✅ 通过 | ~5s |
| Pro Mode | ✅ 通过 | ~5s |
| Base Mode | ✅ 通过 | ~5s |
| Mode Switching | ✅ 通过 | ~3s |
| Form Validation | ✅ 通过 | ~3s |
| Complete Workflow | ✅ 通过 | ~7s |
| **总计** | **✅ 6/6 通过** | **~28s** |

---

## 🎬 实际运行顺序

当你运行 `npm run e2e:headed -- input-modes-with-generation.spec.ts` 时：

1. **浏览器打开** ← 真实的浏览器窗口
2. **第1个测试：Drama Mode**
   - 导航到输入页面
   - 切换到 Drama 模式
   - 填充文本框（你会看到文本输入）
   - 点击提交按钮
   - 导航到分镜

3. **第2个测试：Pro Mode**
   - 再次导航到输入页面
   - 切换到 Pro 模式
   - 填充表单字段
   - 点击生成
   - 导航到分镜

4. **第3个测试：Base Mode**
   - 再次导航到输入页面
   - 切换到 Base 模式
   - 在聊天框输入
   - 点击发送
   - 导航到分镜

5. **其他测试** - 模式切换、表单验证等

---

## 💡 理解中间过程

### 在 headed 模式下能看到的"中间过程"

✅ **页面加载过程**
- 看到HTML结构逐步加载
- 看到表单元素出现
- 看到按钮状态变化

✅ **用户交互过程**
- 看到输入框被填充
- 看到按钮被点击（有ripple效果）
- 看到页面导航

✅ **异步过程**
- 看到加载动画（如果有）
- 看到新页面替代旧页面
- 看到最终的分镜内容

✅ **网络请求**
- 打开DevTools可以看到所有API请求
- 看到请求和响应
- 看到数据流向

### 视频/截图报告中能看到的"中间过程"

✅ **完整的页面状态序列**
- 初始状态
- 表单填充后的状态
- 生成过程中的状态
- 最终的分镜状态

✅ **时间轴**
- 每个步骤花了多长时间
- 总的执行时间
- 性能瓶颈

---

## 🚀 推荐使用流程

### 第一次了解
```bash
npm run e2e:headed -- input-modes-with-generation.spec.ts \
  --grep "should track complete workflow"
```
⚡ 看一个完整的从输入到分镜的流程

### 深入每个模式
```bash
npm run e2e:headed -- input-modes-with-generation.spec.ts \
  --grep "should input via pro mode"
```
⚡ 详细看某个特定的输入模式

### 查看完整报告
```bash
npm run e2e:chromium -- input-modes-with-generation.spec.ts
npx playwright show-report
```
⚡ 看视频、截图和详细的统计数据

### 调试某个问题
```bash
npm run e2e:debug -- input-modes-with-generation.spec.ts
```
⚡ 在Playwright Inspector中逐步执行

---

## 📚 相关文档

- **完整测试指南：** `E2E_INPUT_MODES_GUIDE.md`
- **所有E2E测试汇总：** `E2E_FINAL_STATUS.md`
- **快速开始：** `E2E_QUICK_START.md`
- **测试文件：** `e2e/input-modes-with-generation.spec.ts`

---

*所有测试都已通过 ✅*
*可立即运行查看完整的中间过程 🎬*
