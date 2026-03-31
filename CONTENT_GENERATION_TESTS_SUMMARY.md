# 🎬 Dramo E2E 测试 - 内容生成流程

## 新增功能

在已有的 **10个烟雾测试** 的基础上，现在添加了 **14个内容生成测试**，覆盖完整的用户创作流程。

### 测试总数
- ✅ 烟雾测试：10个 (认证、导航、API)
- 🎬 内容生成测试：14个 (新增)
- **总计：24个测试**

## 内容生成测试覆盖范围

### 完整创作流程 (8个测试)

```
项目列表
  ↓
进入项目
  ↓
输入页面 ←→ 脚本编辑器 ←→ 分镜页面
  ↓
角色管理 + 场景管理
  ↓
多模式脚本 (线性/分支/分镜)
```

**测试：**
1. ✅ 导航到项目和输入表单
2. ✅ 访问输入页面进行剧本生成
3. ✅ 显示脚本编辑器或生成界面
4. ✅ 显示分镜或场景界面
5. ✅ 在不同脚本模式间导航
6. ✅ 处理角色管理
7. ✅ 处理场景管理
8. ✅ 在导航功能时保持认证状态

### 数据输入和表单 (3个测试)

**测试：**
1. ✅ 为内容创建加载表单
2. ✅ 处理表单交互不出错
3. ✅ 生成工作流后导航到脚本

### 响应式设计 (3个测试)

**测试：**
1. ✅ 桌面视口加载内容 (1920x1080)
2. ✅ 平板视口加载内容 (768x1024)
3. ✅ 在所有功能页面保持认证状态

## 覆盖的URL路由

| 路由 | 功能 | 测试覆盖 |
|------|------|--------|
| `/projects` | 项目列表 | ✅ |
| `/projects/[id]` | 项目仪表板 | ✅ |
| `/projects/[id]/input` | 输入表单 | ✅ |
| `/projects/[id]/scripts` | 脚本编辑器 | ✅ |
| `/projects/[id]/scripts/dialogue` | 分支模式 | ✅ |
| `/projects/[id]/scripts/hollywood` | 分镜模式 | ✅ |
| `/projects/[id]/characters` | 角色管理 | ✅ |
| `/projects/[id]/locations` | 场景管理 | ✅ |
| `/projects/[id]/storyboard` | 分镜帧 | ✅ |

## 测试特性

### ✨ 智能跳过机制
- 没有项目时自动跳过项目相关测试
- 确保测试稳定性，不会因缺少数据而失败
- 适合在多种环境中运行

### 🔌 灵活的选择器
由于组件还没有 `data-testid` 属性：
- 使用 `a[href*="/projects/"]` 定位项目链接
- 使用 `hasText()` 按文本查找按钮
- 直接URL导航到已知路由

### 📱 响应式测试
- 测试桌面和平板视口
- 验证在所有分辨率下功能可用
- 确保并行路由 (`@sidebar`, `@content`) 工作正常

### 🔐 认证持久性
- 每个测试独立登录
- 验证导航时保持认证状态
- 确保没有意外的登录页重定向

## 运行命令

### 运行所有内容生成测试
```bash
npm run e2e:chromium -- content-generation.spec.ts
```

### 运行特定测试
```bash
npm run e2e:chromium -- content-generation.spec.ts -g "should navigate to project"
```

### 调试模式（暂停并检查）
```bash
npm run e2e:debug -- content-generation.spec.ts
```

### 有头模式（看浏览器操作）
```bash
npm run e2e:headed -- content-generation.spec.ts
```

### 生成HTML报告
```bash
npm run e2e:chromium && npx playwright show-report
```

## 运行所有E2E测试

```bash
# 烟雾测试 (10个, ~40秒)
npm run e2e:chromium -- smoke.spec.ts

# 内容生成测试 (14个, ~80-120秒)
npm run e2e:chromium -- content-generation.spec.ts

# 全部测试 (24个)
npm run e2e:chromium
```

## 测试数据需求

### 必需
- ✅ 有效的用户账户 (`demo@example.com` / `demo123456`)
- ✅ 应用运行在 http://localhost:12323
- ✅ 后端运行在 http://localhost:12321

### 可选
- 📊 至少一个项目（为了测试项目功能）
- 👤 至少一个角色（为了测试角色管理）
- 📍 至少一个场景（为了测试场景管理）

如果没有测试数据，测试会自动跳过相关用例。

## 已知限制

### 1. 没有 data-testid 属性
**影响**：选择器可能脆弱
**解决**：组件需要添加测试ID

### 2. 没有表单提交测试
**影响**：不测试实际的剧本生成
**解决**：下一阶段添加API模拟

### 3. 没有测试数据创建
**影响**：测试可能因缺少项目而跳过
**解决**：创建测试夹具或种子数据

### 4. 没有API拦截
**影响**：测试依赖真实后端
**解决**：使用Playwright网络拦截或MSW

## 下一阶段计划

### Phase 2: 改进选择器 (优先)
```tsx
// 添加 data-testid 到关键组件
<div data-testid="project-card" data-project-id={id} />
<textarea data-testid="input-form-topic" />
<button data-testid="script-editor-save" />
```

### Phase 3: 完整的生成流程测试
```typescript
// 测试从输入到生成的完整流程
test('complete generation flow', async ({ page }) => {
  // 输入主题
  // 提交表单
  // 等待生成完成
  // 验证脚本创建
});
```

### Phase 4: API模拟和拦截
```typescript
// 拦截API调用
await page.route('**/api/scripts', route => {
  route.abort('blockedByClient');
});
```

### Phase 5: 视觉回归测试
```typescript
// 验证UI外观一致
await expect(page).toHaveScreenshot('input-form.png');
```

## CI/CD 集成

### GitHub Actions 示例
```yaml
- name: Run E2E Tests
  run: |
    npm run dev &
    sleep 5
    npm run e2e:chromium -- smoke.spec.ts
    npm run e2e:chromium -- content-generation.spec.ts
```

### 失败时保留构件
```yaml
- uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## 常见问题

**Q: 测试都被跳过了怎么办？**
A: 检查是否有项目存在。如果没有，创建一个测试项目或添加种子数据。

**Q: 超时了怎么办？**
A: 增加超时时间，或检查后端是否运行。

**Q: 选择器找不到元素？**
A: 运行 `npm run e2e:headed` 用浏览器调试，检查实际的DOM结构。

**Q: 认证失败怎么办？**
A: 验证凭证正确：`demo@example.com` / `demo123456`

## 测试覆盖总结

### 功能覆盖
- ✅ 认证 (烟雾测试)
- ✅ 导航 (烟雾 + 内容生成)
- ✅ API连接 (烟雾测试)
- ✅ 项目访问 (内容生成)
- ✅ 输入表单 (内容生成)
- ✅ 脚本编辑 (内容生成)
- ✅ 分镜管理 (内容生成)
- ✅ 角色管理 (内容生成)
- ✅ 场景管理 (内容生成)

### 场景覆盖
- ✅ 登录后导航
- ✅ 功能间切换
- ✅ 响应式设计
- ✅ 表单交互
- ✅ 认证持久性

### 浏览器覆盖
- ✅ Chromium
- ⏳ Firefox (可选)
- ⏳ WebKit (可选)

## 状态

- ✅ 烟雾测试：10个通过
- ⏳ 内容生成测试：运行中...
- 📝 文档：完成
- 🔄 CI/CD：可配置

## 下一步

1. ⏳ 等待内容生成测试完成
2. 📊 查看测试结果
3. 🐛 修复任何失败
4. 📝 提交代码
5. 🚀 配置CI/CD管道
