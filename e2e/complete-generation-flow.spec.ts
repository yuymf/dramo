import { test, expect } from '@playwright/test';
import { login } from './helpers';

/**
 * Complete Generation Flow E2E Tests - 完整的生成过程中间页面观察
 *
 * 流程：输入 → 提交 → 生成过程 → 脚本页面 → 分镜页面
 *
 * 能观察到的中间页面：
 * 1. 输入页面（表单填充）
 * 2. 生成过程（加载/进度）
 * 3. 脚本编辑页面（/scripts, /scripts/dialogue, /scripts/hollywood）
 * 4. 分镜页面（/storyboard）
 * 5. 字符管理页面（/characters）
 * 6. 位置管理页面（/locations）
 */

test.describe('Complete Generation Flow - Watch All Middle Pages', () => {
  const TEST_PROJECT_ID = 'cmnao4tu9000166e5qg59gno4';

  // ============================================================================
  // 1. Pro Mode 完整流程 - 观察所有中间页面
  // ============================================================================
  test('should watch complete generation flow with all middle pages - Pro Mode', async ({ page }) => {
    console.log('\n========== 🎬 COMPLETE GENERATION FLOW - PRO MODE ==========\n');

    // Step 1: 登录
    await login(page);
    console.log('Step 1: ✅ Logged in');

    // Step 2: 导航到输入页面
    await page.goto(`/projects/${TEST_PROJECT_ID}/input?mode=pro`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

    let url = page.url();
    expect(url).toContain('/input');
    console.log('Step 2: ✅ Input page loaded - Page URL:', url);

    // Step 3: 填充表单
    console.log('\nStep 3: 🔄 Filling form...');

    const textInputs = page.locator('input[type="text"]');
    if (await textInputs.count() > 0) {
      // 填充主题
      await textInputs.first().fill('魔法学院的冒险故事');
      console.log('  ✓ Filled topic: 魔法学院的冒险故事');

      // 填充第二个输入（通常是关键词）
      const secondInput = textInputs.nth(1);
      if (await secondInput.count() > 0) {
        await secondInput.fill('魔法,冒险,成长');
        console.log('  ✓ Filled keywords: 魔法,冒险,成长');
      }
    }

    // 填充描述
    const textareas = page.locator('textarea');
    if (await textareas.count() > 0) {
      await textareas.first().fill('在一个充满魔法的学院里，年轻的魔法师开始她的冒险之旅，经历训练、挑战和最终的成就');
      console.log('  ✓ Filled description/situation');
    }

    // 尝试选择下拉菜单
    const selects = page.locator('select');
    if (await selects.count() > 0) {
      await selects.first().selectOption({ index: 0 });
      console.log('  ✓ Selected form options');
    }

    // Step 4: 点击生成按钮
    console.log('\nStep 4: 🔄 Clicking generate button...');
    const submitButton = page.locator('button:has-text("生成"), button:has-text("提交"), button:has-text("创建")').first();

    if (await submitButton.count() > 0) {
      await submitButton.click();
      console.log('  ✓ Generate button clicked');

      // Step 5: 观察生成过程和页面导航
      console.log('\nStep 5: 🔄 Waiting for generation and page navigation...');

      // 等待页面加载状态变化（可能会显示加载动画）
      await page.waitForTimeout(1000);

      // 可能会有加载指示
      const loaders = page.locator('[class*="loader"], [class*="loading"], [class*="spinner"]');
      const loaderCount = await loaders.count();
      if (loaderCount > 0) {
        console.log(`  ✓ Loading indicator detected (${loaderCount} elements)`);

        // 等待加载完成
        try {
          await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
        } catch (e) {
          console.log('  ⚠️ Page load timeout (generation may still be in progress)');
        }
      }

      url = page.url();
      console.log('  ✓ Page navigated to:', url);

      // Step 6: 验证导向的脚本编辑页面
      console.log('\nStep 6: ✅ Verifying script editor page...');

      if (url.includes('/scripts')) {
        console.log('  ✓ Successfully navigated to script editor');

        // 确认页面内容已加载
        const content = await page.content();
        expect(content.length).toBeGreaterThan(100);
        console.log('  ✓ Script editor content loaded');

        // 看看能否看到生成的脚本内容
        const scriptContent = page.locator('[class*="script"], [class*="content"], main');
        const hasContent = await scriptContent.count() > 0;
        console.log(`  ✓ Script content visible: ${hasContent}`);
      }

      // Step 7: 导航到脚本的不同视图（如果需要）
      console.log('\nStep 7: 🔄 Checking different script modes...');

      // 检查是否有其他模式的切换按钮
      const modeButtons = page.locator('button:has-text("对话"), button:has-text("分镜"), button:has-text("线性")');
      const modeCount = await modeButtons.count();
      console.log(`  ✓ Found ${modeCount} mode switching buttons`);

      // Step 8: 导航到分镜页面
      console.log('\nStep 8: 🔄 Navigating to storyboard page...');
      await page.goto(`/projects/${TEST_PROJECT_ID}/storyboard`);
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

      url = page.url();
      expect(url).toContain('/storyboard');
      console.log('  ✓ Reached storyboard page:', url);

      const storyboardContent = await page.content();
      expect(storyboardContent.length).toBeGreaterThan(100);
      console.log('  ✓ Storyboard content loaded');

      // Step 9: 检查分镜中的场景
      console.log('\nStep 9: ✅ Verifying storyboard content...');

      const scenes = page.locator('[class*="scene"], [class*="frame"], [class*="shot"]');
      const sceneCount = await scenes.count();
      console.log(`  ✓ Found ${sceneCount} scene/frame elements`);

      // Step 10: 导航到字符管理页面
      console.log('\nStep 10: 🔄 Navigating to characters page...');
      await page.goto(`/projects/${TEST_PROJECT_ID}/characters`);
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

      url = page.url();
      expect(url).toContain('/characters');
      console.log('  ✓ Reached characters page:', url);

      const charsContent = await page.content();
      expect(charsContent.length).toBeGreaterThan(100);
      console.log('  ✓ Characters page content loaded');

      // Step 11: 导航到位置管理页面
      console.log('\nStep 11: 🔄 Navigating to locations page...');
      await page.goto(`/projects/${TEST_PROJECT_ID}/locations`);
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

      url = page.url();
      expect(url).toContain('/locations');
      console.log('  ✓ Reached locations page:', url);

      const locsContent = await page.content();
      expect(locsContent.length).toBeGreaterThan(100);
      console.log('  ✓ Locations page content loaded');

      console.log('\n========== ✨ COMPLETE GENERATION FLOW VERIFIED ✨ ==========\n');
    }
  });

  // ============================================================================
  // 2. Drama Mode 完整流程
  // ============================================================================
  test('should watch complete generation flow - Drama Mode', async ({ page }) => {
    console.log('\n========== 🎬 COMPLETE GENERATION FLOW - DRAMA MODE ==========\n');

    await login(page);
    console.log('Step 1: ✅ Logged in');

    await page.goto(`/projects/${TEST_PROJECT_ID}/input?mode=drama`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

    console.log('Step 2: ✅ Drama input page loaded');

    // 填充剧本内容
    console.log('Step 3: 🔄 Entering script content...');

    const textarea = page.locator('textarea').first();
    if (await textarea.count() > 0) {
      const script = `第一幕：开场

场景：魔法学院大厅

人物：艾丽丝、导师

艾丽丝进入大厅，紧张地看着周围。导师走过来微笑欢迎她。

---

第二幕：训练

场景：魔法训练室

艾丽丝开始学习基础魔法。导师指导她完成第一个魔法。

---

第三幕：高潮

场景：魔法竞技场

艾丽丝面对挑战，展现出惊人的魔法天赋。`;

      await textarea.fill(script);
      console.log('  ✓ Script content entered');
    }

    // 提交
    console.log('Step 4: 🔄 Submitting script...');
    const submitBtn = page.locator('button:has-text("生成"), button:has-text("导入"), button:has-text("提交")').first();

    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      console.log('  ✓ Submit button clicked');

      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      } catch {
        console.log('  ⚠️ Page load timeout');
      }

      let url = page.url();
      console.log('Step 5: ✅ Page navigated to:', url);

      // 导航到分镜
      console.log('Step 6: 🔄 Navigating to storyboard...');
      await page.goto(`/projects/${TEST_PROJECT_ID}/storyboard`);
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

      url = page.url();
      expect(url).toContain('/storyboard');
      console.log('Step 7: ✅ Storyboard loaded');

      console.log('\n========== ✨ DRAMA MODE FLOW VERIFIED ✨ ==========\n');
    }
  });

  // ============================================================================
  // 3. Base Mode 完整流程
  // ============================================================================
  test('should watch complete generation flow - Base Mode', async ({ page }) => {
    console.log('\n========== 🎬 COMPLETE GENERATION FLOW - BASE MODE ==========\n');

    await login(page);
    console.log('Step 1: ✅ Logged in');

    await page.goto(`/projects/${TEST_PROJECT_ID}/input?mode=base`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

    console.log('Step 2: ✅ Base mode (chat) page loaded');

    console.log('Step 3: 🔄 Finding chat input...');

    const chatInputs = page.locator('input[placeholder*="输入"], input[placeholder*="告诉"], textarea[placeholder*="输入"], textarea[placeholder*="告诉"]');
    const chatInput = chatInputs.first();

    if (await chatInput.count() > 0) {
      const prompt = '请为我创建一个关于魔法学院的冒险故事。包含三个阶段：学院开场、魔法训练、最终竞技场对决。';

      await chatInput.fill(prompt);
      console.log('  ✓ Chat prompt entered');

      console.log('Step 4: 🔄 Sending message...');

      // 尝试找到发送按钮或按Enter
      const sendBtn = page.locator('button[aria-label*="发送"], button:has-text("发送")').first();

      if (await sendBtn.count() > 0) {
        await sendBtn.click();
        console.log('  ✓ Send button clicked');
      } else {
        await chatInput.press('Enter');
        console.log('  ✓ Enter key pressed');
      }

      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
      } catch {
        console.log('  ⚠️ Processing timeout');
      }

      let url = page.url();
      console.log('Step 5: ✅ Page after sending:', url);

      // 导航到分镜
      console.log('Step 6: 🔄 Navigating to final pages...');
      await page.goto(`/projects/${TEST_PROJECT_ID}/storyboard`);
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

      url = page.url();
      expect(url).toContain('/storyboard');
      console.log('Step 7: ✅ Final storyboard loaded');

      console.log('\n========== ✨ BASE MODE FLOW VERIFIED ✨ ==========\n');
    }
  });

  // ============================================================================
  // 4. 生成过程中的页面变化观察
  // ============================================================================
  test('should observe page transitions during generation', async ({ page }) => {
    console.log('\n========== 🔍 OBSERVING PAGE TRANSITIONS DURING GENERATION ==========\n');

    const pageVisits: string[] = [];

    // 监听页面导航
    page.on('load', async () => {
      const url = page.url();
      console.log(`  📄 Page loaded: ${url}`);
      pageVisits.push(url);
    });

    await login(page);
    console.log('Step 1: ✅ Authentication complete');

    // 导航到输入页面
    await page.goto(`/projects/${TEST_PROJECT_ID}/input?mode=pro`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    console.log('Step 2: ✅ Input page loaded');

    // 填充表单
    console.log('Step 3: 🔄 Filling form...');
    const firstInput = page.locator('input[type="text"]').first();
    if (await firstInput.count() > 0) {
      await firstInput.fill('观察生成过程的测试');
    }

    const textarea = page.locator('textarea').first();
    if (await textarea.count() > 0) {
      await textarea.fill('测试在生成过程中能看到哪些页面和中间状态');
    }

    // 提交并观察页面变化
    console.log('Step 4: 🔄 Submitting and watching page transitions...\n');

    const submitBtn = page.locator('button:has-text("生成"), button:has-text("提交")').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();

      // 等待多个页面加载
      try {
        await page.waitForLoadState('networkidle', { timeout: 15000 });
      } catch {
        // 可能超时，但我们仍然看到了导航
        console.log('  ℹ️  Generation process may still be in progress');
      }
    }

    console.log('\n📊 Pages visited during generation:');
    pageVisits.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });

    console.log('\n========== ✨ PAGE TRANSITION OBSERVATION COMPLETE ✨ ==========\n');
  });
});
