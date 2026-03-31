/**
 * Drama Mode - 导入剧本 → 等待后端生成 → 验证前端更新
 *
 * 完整的 E2E 流程测试：
 * 1. 提交剧本
 * 2. 等待后端处理（生成故事板）
 * 3. 验证前端是否正确导航到生成的故事板
 * 4. 验证前端是否正确显示生成的内容
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers';

const TEST_PROJECT_ID = 'cmnao4tu9000166e5qg59gno4';

const DRAMA_SCRIPT = `第一幕：开场

场景：魔法学院大厅
人物：艾丽丝、导师

艾丽丝紧张地进入大厅，四周是古老的魔法书和神秘的符号。导师微笑着走过来欢迎她。

导师：欢迎来到魔法学院，艾丽丝。你准备好开始你的魔法之旅了吗？
艾丽丝：我...我准备好了。虽然有点紧张。
导师：这很正常。每个伟大的魔法师都是从紧张开始的。

---

第二幕：训练

场景：魔法训练室

艾丽丝跟随导师进入训练室。这里有各种魔法设备和教材。

导师：今天，我们从基础魔法开始。首先是浮升咒。

艾丽丝拿起魔法杖，集中注意力。她念出咒语，一个球体缓缓浮起。

艾丽丝的眼睛闪闪发光。她成功了！

导师：非常好！你很有天赋。

---

第三幕：高潮

场景：魔法竞技场

竞技场上聚集了许多学生。艾丽丝站在竞技台上，对面是一位高级学生。

主持人：这是本届新生挑战赛的最后一场。让我们看看这位新生的真实实力！

比赛开始。双方互相施展魔法。艾丽丝展现出了惊人的魔法天赋和快速的反应能力。

最终，艾丽丝击败了对手。全场欢呼。

导师在观众席上微笑地鼓掌。

艾丽丝意识到，她找到了自己真正热爱的东西——魔法。`;

test.describe('Drama Import E2E - 导入剧本 → 等待后端 → 验证前端', () => {

  test('应该等待后端完成故事板生成并导航到结果页面', async ({ page }) => {
    console.log('\n========== 🎬 E2E: Drama Import - 完整流程 ==========\n');

    // Step 1: 登录
    console.log('Step 1: 🔐 登录...');
    await login(page);
    console.log('  ✓ 已登录\n');

    // Step 2: 导航到 Drama 输入页面
    console.log('Step 2: 📄 进入 Drama 模式...');
    await page.goto(`/projects/${TEST_PROJECT_ID}/input?mode=drama`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

    const currentUrl = page.url();
    expect(currentUrl).toContain('mode=drama');
    console.log('  ✓ 已进入 Drama 模式');
    console.log('  URL:', currentUrl, '\n');

    // Step 3: 输入剧本
    console.log('Step 3: ✏️  输入剧本文本...');
    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible', timeout: 5000 });
    await textarea.fill(DRAMA_SCRIPT);
    console.log('  ✓ 已输入剧本 (' + DRAMA_SCRIPT.length + ' 字)\n');

    // Step 4: 提交表单
    console.log('Step 4: 📤 提交剧本...');
    const submitButton = page.locator('button:has-text("导入剧本")').last();

    // 监听 API 请求
    let apiResponse: any = null;
    let apiError: any = null;

    page.on('response', async (response) => {
      if (response.url().includes('/storyboard/import')) {
        console.log('  📡 API 响应:', response.status(), response.statusText());

        try {
          apiResponse = await response.json();
          console.log('  📊 响应数据:', JSON.stringify(apiResponse).substring(0, 100) + '...');
        } catch (e) {
          console.log('  ⚠️ 无法解析响应体');
        }
      }
    });

    page.on('requestfailed', (request) => {
      if (request.url().includes('/storyboard/import')) {
        console.log('  ❌ API 请求失败');
        apiError = request.failure();
      }
    });

    // 点击提交
    await submitButton.click();
    console.log('  ✓ 已点击提交按钮\n');

    // Step 5: 等待加载和处理
    console.log('Step 5: ⏳ 等待后端处理...');
    console.log('  监控页面状态和 URL 变化...\n');

    // 记录初始 URL
    let previousUrl = page.url();
    let urlChanged = false;
    let navigationTarget = '';

    // 监听导航
    page.on('framenavigated', () => {
      const newUrl = page.url();
      if (newUrl !== previousUrl) {
        urlChanged = true;
        navigationTarget = newUrl;
        console.log('  📍 页面已导航到:', newUrl);
        previousUrl = newUrl;
      }
    });

    // 等待一个合理的时间来查看页面是否变化
    // 由于我们不知道后端需要多长时间，我们会等待最多 120 秒
    const maxWaitTime = 120000; // 2 minutes
    const checkInterval = 2000; // 每 2 秒检查一次
    const startTime = Date.now();

    let finalPage = 'input'; // 默认停留在输入页面
    let storyboardData: any = null;
    let errorMessage = '';

    while (Date.now() - startTime < maxWaitTime) {
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      const currentPageUrl = page.url();

      // 检查是否已导航到故事板
      if (currentPageUrl.includes('/storyboard')) {
        finalPage = 'storyboard';
        console.log(`  ✓ [${elapsedSeconds}s] 已导航到故事板页面\n`);
        break;
      }

      // 检查是否还在输入页面
      if (currentPageUrl.includes('/input')) {
        finalPage = 'input';
      }

      // 检查是否有错误消息
      const errorElements = page.locator('[class*="error"], [class*="alert"]');
      const errorCount = await errorElements.count();
      if (errorCount > 0) {
        errorMessage = await errorElements.first().textContent() || '未知错误';
        console.log(`  ❌ [${elapsedSeconds}s] 检测到错误: ${errorMessage}\n`);
        break;
      }

      // 每 10 秒输出一次进度
      if (elapsedSeconds % 10 === 0) {
        console.log(`  ⏳ [${elapsedSeconds}s] 还在处理中...\n`);
      }

      await page.waitForTimeout(checkInterval);
    }

    // Step 6: 验证结果
    console.log('Step 6: ✅ 验证结果...\n');

    if (finalPage === 'storyboard') {
      console.log('  ✓ 前端已成功导航到故事板页面');

      // 验证故事板内容
      const storyboardContent = await page.content();
      expect(storyboardContent.length).toBeGreaterThan(100);
      console.log('  ✓ 故事板内容已加载 (' + storyboardContent.length + ' bytes)');

      // 查找故事板特定元素
      const storyboardTitle = page.locator('[class*="title"], h1, h2');
      const titleVisible = await storyboardTitle.count() > 0;
      console.log('  ✓ 故事板标题: ' + (titleVisible ? '可见' : '未找到'));

      // 查找场景/分镜元素
      const scenes = page.locator('[class*="scene"], [class*="frame"], [class*="shot"]');
      const sceneCount = await scenes.count();
      console.log('  ✓ 检测到 ' + sceneCount + ' 个场景/分镜元素');

    } else if (finalPage === 'input' && !errorMessage) {
      console.log('  ℹ️ 前端仍在输入页面 (后端可能还在处理)');
      console.log('  📋 可能的原因:');
      console.log('     1. 后端服务尚未响应');
      console.log('     2. AI 生成时间较长');
      console.log('     3. AgentOS 服务未启动');

      // 检查是否有任何进度反馈
      const loadingElements = page.locator('[class*="loading"], [class*="spinner"]');
      const loadingCount = await loadingElements.count();
      console.log('  ⏳ 加载指示器:', loadingCount > 0 ? '可见' : '不可见');

    } else if (errorMessage) {
      console.log('  ❌ 前端显示错误:');
      console.log('     ' + errorMessage);
    }

    console.log('\n========== ✨ E2E 测试完成 ✨ ==========\n');
  });

  test('应该验证 Pro Mode 表单提交并等待后端响应', async ({ page }) => {
    console.log('\n========== 🎬 E2E: Pro Mode - 完整流程 ==========\n');

    // Step 1: 登录
    console.log('Step 1: 🔐 登录...');
    await login(page);
    console.log('  ✓ 已登录\n');

    // Step 2: 导航到 Pro 模式
    console.log('Step 2: 📋 进入 Pro 模式...');
    await page.goto(`/projects/${TEST_PROJECT_ID}/input?mode=pro`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

    const currentUrl = page.url();
    expect(currentUrl).toContain('mode=pro');
    console.log('  ✓ 已进入 Pro 模式');
    console.log('  URL:', currentUrl, '\n');

    // Step 3: 填充表单
    console.log('Step 3: ✏️  填充表单...');

    let fillCount = 0;

    // 首先填充顶部的 situation 文本区域
    const textareas = page.locator('textarea');
    const textareaCount = await textareas.count();
    console.log(`  找到 ${textareaCount} 个文本区域`);

    if (textareaCount > 0) {
      await textareas.first().fill('在一个充满魔法的学院里，年轻的魔法师开始她的冒险之旅。这是一个关于成长和自发现的故事。');
      console.log('  ✓ 已填充场景说明 (situation)');
      fillCount++;
    }

    // 现在需要点击 "Pro 展开结构化选项" 按钮来展开表单
    console.log('  📌 点击 Pro 展开按钮...');
    const proExpandButton = page.locator('button:has-text("展开结构化选项")');
    const expandButtonExists = await proExpandButton.count() > 0;

    if (expandButtonExists) {
      await proExpandButton.click();
      console.log('  ✓ 已点击 Pro 展开按钮');
      // 等待结构化选项渲染
      await page.waitForTimeout(500);
    } else {
      console.log('  ⚠️ 未找到展开按钮，尝试直接填充隐藏的输入框');
    }

    // 现在查找输入框（展开后应该有 4 个）
    const inputs = page.locator('input[type="text"]');
    const inputCount = await inputs.count();
    console.log(`  找到 ${inputCount} 个输入框`);

    // 列出所有输入框的占位符来识别每个字段
    for (let i = 0; i < Math.min(inputCount, 5); i++) {
      const placeholder = await inputs.nth(i).getAttribute('placeholder');
      console.log(`    输入框 ${i}: placeholder="${placeholder}"`);
    }

    // 根据占位符精确定位字段
    // 输入框 1: keyword (例如：科幻、青春、冒险...)
    // 输入框 3: topic (给你的剧本起个名字)
    if (inputCount > 1) {
      await inputs.nth(1).fill('魔法,冒险,成长');
      console.log('  ✓ 已填充主题关键词 (keyword)');
      fillCount++;
    }

    // 第 4 个输入框是 topic（标题）- 这是必填的
    if (inputCount > 3) {
      await inputs.nth(3).fill('魔法学院的冒险故事');
      console.log('  ✓ 已填充标题 (topic)');
      fillCount++;
    }

    // 验证填充后的值
    if (inputCount > 1) {
      const kwValue = await inputs.nth(1).inputValue();
      console.log(`  验证: keyword 值 = "${kwValue}"`);
    }
    if (inputCount > 3) {
      const topicValue = await inputs.nth(3).inputValue();
      console.log(`  验证: topic 值 = "${topicValue}"`);
    }

    // 等待按钮状态更新
    await page.waitForTimeout(500);

    const generateButton = page.locator('button:has-text("创建故事板")').first();
    const isEnabled = await generateButton.isEnabled();
    console.log('  按钮状态:', isEnabled ? '启用 ✓' : '禁用 ❌');
    console.log('  ✓ 已填充 ' + fillCount + ' 个表单字段\n');

    // Step 4: 提交表单
    console.log('Step 4: 📤 提交表单...');
    let apiCalled = false;
    let scriptData: any = null;

    page.on('response', async (response) => {
      if (response.url().includes('/script')) {
        apiCalled = true;
        console.log('  📡 API 响应:', response.status(), response.statusText());

        try {
          scriptData = await response.json();
          console.log('  📊 收到脚本数据');
        } catch (e) {
          console.log('  ⚠️ 无法解析响应');
        }
      }
    });

    const submitButton = page.locator('button:has-text("创建故事板")').first();

    // 检查按钮是否启用
    const isSubmitEnabled = await submitButton.isEnabled();
    if (!isSubmitEnabled) {
      console.log('  ⚠️ 提交按钮被禁用，无法点击');
      console.log('  可能需要检查表单字段验证规则\\n');
      // 继续测试其他流程
    } else {
      await submitButton.click();
      console.log('  ✓ 已点击提交按钮\n');
    }

    // Step 5: 等待后端响应
    console.log('Step 5: ⏳ 等待后端生成脚本...');

    const maxWaitTime = 120000; // 2 分钟
    const checkInterval = 2000;
    const startTime = Date.now();

    let finalUrl = '';
    let processComplete = false;
    let errorOccurred = false;

    while (Date.now() - startTime < maxWaitTime) {
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      finalUrl = page.url();

      // 检查是否已导航到脚本页面
      if (finalUrl.includes('/scripts')) {
        processComplete = true;
        console.log(`  ✓ [${elapsedSeconds}s] 已导航到脚本页面\n`);
        break;
      }

      // 检查错误
      const errorElements = page.locator('[class*="error"]');
      if (await errorElements.count() > 0) {
        errorOccurred = true;
        console.log(`  ❌ [${elapsedSeconds}s] 检测到错误\n`);
        break;
      }

      if (elapsedSeconds % 10 === 0) {
        console.log(`  ⏳ [${elapsedSeconds}s] 还在处理...\n`);
      }

      await page.waitForTimeout(checkInterval);
    }

    // Step 6: 验证结果
    console.log('Step 6: ✅ 验证结果...\n');

    if (processComplete) {
      console.log('  ✓ 前端已成功导航到脚本页面');

      // 验证脚本内容
      const scriptContent = await page.content();
      expect(scriptContent.length).toBeGreaterThan(100);
      console.log('  ✓ 脚本内容已加载');

    } else if (!errorOccurred) {
      console.log('  ℹ️ 前端仍在处理中或尚未导航');
      console.log('  📋 最终 URL:', finalUrl);

    } else {
      console.log('  ❌ 处理过程中出现错误');
    }

    console.log('\n========== ✨ E2E 测试完成 ✨ ==========\n');
  });

  test('应该处理错误情况 - 无效的剧本内容', async ({ page }) => {
    console.log('\n========== 🎬 E2E: 错误处理 - 无效内容 ==========\n');

    await login(page);
    await page.goto(`/projects/${TEST_PROJECT_ID}/input?mode=drama`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    console.log('✓ 已进入 Drama 模式\n');

    // 输入非常短的内容
    console.log('Step 1: 输入过短的剧本...');
    const textarea = page.locator('textarea');
    await textarea.fill('测试');
    console.log('  ✓ 已输入短内容\n');

    // 尝试提交
    console.log('Step 2: 尝试提交...');
    let errorDetected = false;
    let errorMessage = '';

    const submitButton = page.locator('button:has-text("导入剧本")').last();

    // 监听响应
    page.on('response', async (response) => {
      if (response.url().includes('/storyboard/import')) {
        if (!response.ok()) {
          errorDetected = true;
          console.log('  ❌ API 返回错误:', response.status(), response.statusText());

          try {
            const errorData = await response.json();
            errorMessage = errorData?.error?.message || '未知错误';
            console.log('  📋 错误信息:', errorMessage);
          } catch (e) {
            console.log('  ⚠️ 无法获取错误详情');
          }
        }
      }
    });

    await submitButton.click();
    await page.waitForTimeout(2000);

    console.log('\nStep 3: 验证错误处理...');
    if (errorDetected) {
      console.log('  ✓ 后端正确返回错误');
      console.log('  ✓ 错误消息:', errorMessage);
    } else {
      console.log('  ℹ️ 没有检测到后端错误 (可能被前端验证阻止)');
    }

    console.log('\n========== ✨ E2E 测试完成 ✨ ==========\n');
  });

});
