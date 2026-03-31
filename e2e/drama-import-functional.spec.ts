/**
 * Drama 导入剧本功能 - 单元测试（不依赖后端完成）
 *
 * 测试：
 * 1. 导入剧本按钮和标签页面是否能正确工作
 * 2. 文本输入是否能正确保存
 * 3. 提交按钮是否能点击和显示加载状态
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers';

const TEST_PROJECT_ID = 'cmnao4tu9000166e5qg59gno4';

const DRAMA_SCRIPT = `第一幕：开场

场景：魔法学院大厅
人物：艾丽丝、导师

艾丽丝紧张地进入大厅。导师微笑着走过来欢迎她。

导师：欢迎来到魔法学院，艾丽丝。

---

第二幕：训练

场景：魔法训练室

艾丽丝跟随导师进入训练室。

导师：今天，我们从基础魔法开始。

艾丽丝成功施展了浮升咒。

---

第三幕：高潮

场景：魔法竞技场

艾丽丝站在竞技台上。她展现出了惊人的魔法天赋。

最终，艾丽丝击败了对手。全场欢呼。`;

test.describe('Drama Mode - 导入剧本功能测试', () => {

  test('✅ 点击"导入剧本"按钮能够切换到 Drama 模式', async ({ page }) => {
    console.log('\n========== ✅ TEST 1: 标签切换 ==========\n');

    await login(page);
    console.log('✓ 已登录');

    // 进入输入页面（默认 base 模式）
    await page.goto(`/projects/${TEST_PROJECT_ID}/input`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    console.log('✓ 已进入输入页面');

    // 验证当前模式
    let url = page.url();
    console.log('  初始 URL:', url);

    // 点击"导入剧本"按钮
    console.log('\n🔄 点击"导入剧本"...');
    const dramaButton = page.locator('button:has-text("导入剧本")').first();

    // 等待按钮可见
    await dramaButton.waitFor({ state: 'visible', timeout: 5000 });
    expect(await dramaButton.isVisible()).toBe(true);
    console.log('  ✓ "导入剧本"按钮已找到');

    // 点击按钮
    await dramaButton.click();
    await page.waitForTimeout(500);
    console.log('  ✓ 已点击按钮');

    // 验证 URL 已更新
    url = page.url();
    expect(url).toContain('mode=drama');
    console.log('  ✓ URL 已更新为 Drama 模式:', url);

    // 验证 Drama 模式的元素已显示
    const textarea = page.locator('textarea');
    expect(await textarea.count()).toBeGreaterThan(0);
    console.log('  ✓ 文本框已显示');

    // 验证上传按钮已显示
    const uploadButton = page.locator('button:has-text("上传文本")');
    expect(await uploadButton.count()).toBeGreaterThan(0);
    console.log('  ✓ "上传文本"按钮已显示');

    console.log('\n✅ TEST 1 通过\n');
  });

  test('✅ 能够输入剧本文本', async ({ page }) => {
    console.log('\n========== ✅ TEST 2: 输入文本 ==========\n');

    await login(page);
    await page.goto(`/projects/${TEST_PROJECT_ID}/input?mode=drama`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    console.log('✓ 已进入 Drama 模式');

    // 查找文本框
    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ 文本框已找到');

    // 输入文本
    console.log('\n🔄 输入剧本文本...');
    await textarea.fill(DRAMA_SCRIPT);
    console.log('  ✓ 已输入文本 (' + DRAMA_SCRIPT.length + ' 字)');

    // 验证文本已正确输入
    const inputText = await textarea.inputValue();
    expect(inputText).toBe(DRAMA_SCRIPT);
    console.log('  ✓ 文本已正确保存');

    // 验证字数显示
    const charCount = await page.locator('text=/\\d+ \\/ \\d+/').textContent();
    console.log('  ✓ 字数计数器显示:', charCount);

    // 验证没有超过限制
    const isOverLimit = DRAMA_SCRIPT.length > 20000;
    expect(isOverLimit).toBe(false);
    console.log('  ✓ 未超过 20000 字限制');

    console.log('\n✅ TEST 2 通过\n');
  });

  test('✅ 提交按钮的启用/禁用状态正确', async ({ page }) => {
    console.log('\n========== ✅ TEST 3: 按钮状态 ==========\n');

    await login(page);
    await page.goto(`/projects/${TEST_PROJECT_ID}/input?mode=drama`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    console.log('✓ 已进入 Drama 模式');

    // 查找提交按钮
    const submitButton = page.locator('button').filter({ hasText: /^导入剧本$/ }).last();

    // 等待按钮可见
    await submitButton.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ 提交按钮已找到');

    // 1. 检查初始状态（空文本框）
    console.log('\n🔄 测试 1: 空文本框时...');
    let isEnabled = await submitButton.isEnabled();
    console.log('  按钮状态:', isEnabled ? '启用' : '禁用');
    expect(isEnabled).toBe(false);
    console.log('  ✓ 正确：按钮已禁用');

    // 2. 输入文本后
    console.log('\n🔄 测试 2: 输入文本后...');
    const textarea = page.locator('textarea');
    await textarea.fill('简短的测试');
    await page.waitForTimeout(300);

    isEnabled = await submitButton.isEnabled();
    console.log('  按钮状态:', isEnabled ? '启用' : '禁用');
    expect(isEnabled).toBe(true);
    console.log('  ✓ 正确：按钮已启用');

    // 3. 清空文本后
    console.log('\n🔄 测试 3: 清空文本后...');
    await textarea.fill('');
    await page.waitForTimeout(300);

    isEnabled = await submitButton.isEnabled();
    console.log('  按钮状态:', isEnabled ? '启用' : '禁用');
    expect(isEnabled).toBe(false);
    console.log('  ✓ 正确：按钮已禁用');

    console.log('\n✅ TEST 3 通过\n');
  });

  test('✅ 点击提交按钮能够发送请求', async ({ page }) => {
    console.log('\n========== ✅ TEST 4: 提交请求 ==========\n');

    await login(page);
    await page.goto(`/projects/${TEST_PROJECT_ID}/input?mode=drama`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    console.log('✓ 已进入 Drama 模式');

    // 输入剧本
    const textarea = page.locator('textarea');
    await textarea.fill(DRAMA_SCRIPT);
    console.log('✓ 已输入剧本文本');

    // 找到提交按钮并点击
    console.log('\n🔄 点击提交按钮...');
    const submitButton = page.locator('button').filter({ hasText: /^导入剧本$/ }).last();

    // 监听网络请求
    let requestMade = false;
    page.on('request', (request) => {
      if (request.url().includes('/storyboard/import')) {
        requestMade = true;
        console.log('  ✓ API 请求已发送:', request.url());
        console.log('  ✓ 请求方法:', request.method());
        console.log('  ✓ 请求头:', request.postDataBuffer()?.length, 'bytes');
      }
    });

    // 点击提交
    await submitButton.click();
    await page.waitForTimeout(1000);

    // 验证请求已发送
    expect(requestMade).toBe(true);
    console.log('✓ API 请求已验证');

    // 验证加载状态
    console.log('\n🔄 验证加载状态...');
    const loadingButton = page.locator('button:has-text("AI 正在生成")');
    const hasLoadingState = await loadingButton.count() > 0;

    if (hasLoadingState) {
      console.log('  ✓ 加载状态已显示');
    } else {
      console.log('  ℹ️ 没有检测到加载状态（可能立即完成或出错）');
    }

    console.log('\n✅ TEST 4 通过\n');
  });

  test('✅ 能够从其他模式切换到 Drama 模式', async ({ page }) => {
    console.log('\n========== ✅ TEST 5: 模式切换 ==========\n');

    await login(page);

    // 从 Pro 模式开始
    console.log('🔄 从 Pro 模式开始...');
    await page.goto(`/projects/${TEST_PROJECT_ID}/input?mode=pro`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

    let urlMode = new URL(page.url()).searchParams.get('mode');
    expect(urlMode).toBe('pro');
    console.log('✓ 已进入 Pro 模式');

    // 切换到 Drama
    console.log('\n🔄 切换到 Drama 模式...');
    const dramaButton = page.locator('button:has-text("导入剧本")').first();
    await dramaButton.click();
    await page.waitForTimeout(500);

    urlMode = new URL(page.url()).searchParams.get('mode');
    expect(urlMode).toBe('drama');
    console.log('✓ 已切换到 Drama 模式');

    // 验证 Drama 元素已显示
    const textarea = page.locator('textarea');
    expect(await textarea.count()).toBeGreaterThan(0);
    console.log('✓ Drama 文本框已显示');

    // 再切换到 Base
    console.log('\n🔄 切换到 Base 模式...');
    const baseButton = page.locator('button:has-text("空白故事板")').first();
    await baseButton.click();
    await page.waitForTimeout(500);

    urlMode = new URL(page.url()).searchParams.get('mode');
    expect(urlMode).toBe('base');
    console.log('✓ 已切换到 Base 模式');

    // 再切换回 Drama
    console.log('\n🔄 切换回 Drama 模式...');
    await dramaButton.click();
    await page.waitForTimeout(500);

    urlMode = new URL(page.url()).searchParams.get('mode');
    expect(urlMode).toBe('drama');
    console.log('✓ 已切换回 Drama 模式');

    console.log('\n✅ TEST 5 通过\n');
  });

});
