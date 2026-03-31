# Content Generation E2E Tests

## Overview

这个测试套件覆盖了 Dramo 的核心内容生成流程：
- **输入流程** (Input) - 用户提供创作素材
- **剧本生成** (Script Generation) - AI 生成剧本
- **分镜创建** (Storyboard) - 创建分镜版本
- **角色管理** (Characters) - 管理角色信息
- **场景管理** (Locations) - 管理场景位置

## Test Structure

### Test Suite 1: Content Generation Flow (8 tests)

#### 1. Navigate to Project and Input Form
- 从项目列表进入项目
- 导航到输入表单页面
- 验证URL和导航正确

#### 2. Access Input Page
- 访问输入页面
- 验证页面加载成功
- 检查表单元素存在

#### 3. Display Script Editor
- 访问脚本编辑器
- 验证编辑器UI加载
- 检查编辑控制按钮

#### 4. Display Storyboard Interface
- 访问分镜页面
- 验证分镜UI加载
- 检查分镜特定元素

#### 5. Navigate Between Script Modes
- 测试三种脚本模式：`script`, `dialogue`, `hollywood`
- 验证每种模式都能加载
- 至少一种模式应该成功加载

#### 6. Handle Character Management
- 访问角色管理页面
- 验证页面内容加载
- 检查角色相关UI

#### 7. Handle Location Management
- 访问场景管理页面
- 验证页面内容加载
- 检查场景相关UI

#### 8. Maintain Authentication While Navigating
- 在所有功能页面之间导航
- 验证始终保持认证状态
- 确保不会被重定向到登录页

### Test Suite 2: Content Creation with Data Input (3 tests)

#### 1. Load Forms for Content Creation
- 验证表单元素存在
- 检查输入字段、下拉菜单、按钮

#### 2. Handle Form Interactions
- 填充文本输入框
- 验证输入值正确保存
- 测试表单交互不出错

#### 3. Navigate to Script After Generation
- 导航到脚本页面
- 验证脚本编辑器加载
- 检查编辑控制按钮

### Test Suite 3: Responsive Layout (3 tests)

#### 1. Load Content on Desktop
- 设置桌面视口 (1920x1080)
- 验证内容正确显示
- 检查main元素可访问

#### 2. Load Content on Tablet
- 设置平板视口 (768x1024)
- 验证响应式布局工作
- 检查内容正确显示

#### 3. Remain Authenticated on All Pages
- 跨多个功能页面验证认证
- 检查没有意外重定向
- 验证所有页面返回200/304状态码

## Test Strategy

### Flexible Selector Approach
由于组件还没有 `data-testid` 属性，测试使用灵活的选择器：
- `a[href*="/projects/"]` - 项目链接
- `button, a` 与 `hasText()` 过滤 - 按文本查找按钮
- Direct URL navigation - 直接URL导航到已知路由

### Skip on Missing Data
测试会自动 `skip` 如果：
- 没有项目存在（无法测试项目功能）
- 项目ID无法从URL提取
- 特定功能页面不可访问

这保证了测试的鲁棒性，不会因为缺少测试数据而失败。

### Test Isolation
每个测试都独立登录，不依赖其他测试的状态。

## Running the Tests

### Run Content Generation Tests Only
```bash
npm run e2e:chromium -- content-generation.spec.ts
```

### Run with Debug Mode
```bash
npm run e2e:debug -- content-generation.spec.ts
```

### Run with Visual Mode (see browser)
```bash
npm run e2e:headed -- content-generation.spec.ts
```

### Run Specific Test
```bash
npm run e2e:chromium -- content-generation.spec.ts -g "should navigate to project"
```

## Key Routes Tested

| Route | Purpose | Test |
|-------|---------|------|
| `/projects` | Project list | Navigate to Project |
| `/projects/[id]` | Project dashboard | Navigate to Project |
| `/projects/[id]/input` | Input form | Access Input Page |
| `/projects/[id]/scripts` | Script editor | Display Script Editor |
| `/projects/[id]/scripts/dialogue` | Branching mode | Navigate Between Modes |
| `/projects/[id]/scripts/hollywood` | Storyboard mode | Navigate Between Modes |
| `/projects/[id]/characters` | Character management | Handle Characters |
| `/projects/[id]/locations` | Location management | Handle Locations |
| `/projects/[id]/storyboard` | Storyboard frames | Display Storyboard |

## Dependencies

- `helpers.ts` - 登录函数
- Playwright API - 页面交互

## Known Limitations

### 1. No data-testid Attributes
组件没有测试ID，所以使用了灵活的选择器。为了更好的可靠性，应该添加：
```tsx
data-testid="project-card"
data-testid="input-form"
data-testid="script-editor"
```

### 2. No Form Submission Tests
测试只验证表单元素存在和交互工作，不测试提交和后端响应。需要模拟API或实际数据。

### 3. No Real Generation Tests
不测试实际的AI剧本生成（需要长时间等待或模拟）。

### 4. Skips on Missing Data
如果没有项目，大多数测试会跳过。建议创建测试夹具。

## Future Improvements

### Phase 2: Add Component Test IDs
```tsx
// ProjectCard
<div data-testid="project-card" data-testid-id={project.id}>

// Input Form
<textarea data-testid="input-form-topic" />
<button data-testid="input-form-submit" />

// Script Editor
<div data-testid="script-editor" />
<button data-testid="script-editor-save" />

// Storyboard
<div data-testid="storyboard-scene" data-scene-id={scene.id} />
```

### Phase 3: Add Form Submission Tests
```typescript
test('should submit input form and generate script', async ({ page }) => {
  const response = page.waitForResponse(
    res => res.url().includes('/api/scripts') && res.status() === 201
  );

  await page.fill('[data-testid="input-form-topic"]', '有趣的故事');
  await page.click('[data-testid="input-form-submit"]');

  await response;
  // Verify script was created
});
```

### Phase 4: Add API Mocking
```typescript
import { mock } from 'msw';

test.beforeEach(async ({ page }) => {
  // Mock script generation API
  await page.addInitScript(() => {
    window.MSW?.useHandlers([
      http.post('/api/scripts', () => {
        return HttpResponse.json({
          id: 'script_123',
          content: '生成的剧本内容'
        });
      })
    ]);
  });
});
```

### Phase 5: Visual Regression Testing
```typescript
test('input form should look correct', async ({ page }) => {
  await page.goto('/projects/proj_123/input');
  await expect(page).toHaveScreenshot('input-form.png');
});
```

## Troubleshooting

### Test Skipped?
如果大多数测试被跳过，可能是：
1. 没有项目存在 - 创建测试项目或使用测试夹具
2. 用户没有正确登录 - 检查认证流程
3. URL结构不匹配 - 验证路由配置

### Test Timeout?
如果测试超时：
1. 检查应用是否在 http://localhost:12323 运行
2. 检查后端在 http://localhost:12321 是否启动
3. 增加超时时间

### Selectors Not Found?
如果找不到元素：
1. 运行 `npm run e2e:headed` 查看浏览器
2. 使用浏览器开发工具检查DOM
3. 更新选择器以匹配实际HTML

## Metrics

| Metric | Value |
|--------|-------|
| Tests | 14 |
| Skip on Missing Data | Yes |
| Browser Coverage | Chromium |
| Authentication | Yes |
| Responsive Testing | Yes |
| Form Testing | Basic |
| API Testing | Navigation only |

## Status

- ✅ Created
- ⏳ Running tests
- ⏸️ Waiting for results

## Next Phase

1. 查看测试运行结果
2. 修复任何失败的测试
3. 考虑添加 `data-testid` 属性以改进选择器
4. 扩展测试以包括表单提交
5. 添加API模拟进行完整的生成流程测试
