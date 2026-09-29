import { test, expect, type Page } from '@playwright/test';

async function signUp(page: Page) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e.${stamp}@example.com`;
  await page.goto('/register');
  await page.getByLabel('名称').fill('E2E 作者');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill('password1');
  await page.getByRole('button', { name: '注册' }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /今天想写/ })).toBeVisible();
  return email;
}

async function createScriptProject(page: Page, name: string) {
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: '我的项目' })).toBeVisible();
  await page.getByRole('button', { name: /新建项目/ }).click();
  const dialog = page.getByRole('dialog', { name: '新建项目' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('项目名称').fill(name);
  await dialog.getByRole('button', { name: '创建剧本项目' }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/screenplay/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: '剧本', exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

async function writeTwoScenes(page: Page) {
  const editor = page.getByRole('list', { name: '剧本正文' });
  await expect(editor).toBeVisible({ timeout: 15_000 });
  const box = (name?: string) =>
    name ? editor.getByRole('textbox', { name }) : editor.getByRole('textbox');

  // Keyboard shortcuts are flaky under CI load — retry until the role count lands.
  async function pressUntilCount(
    press: () => Promise<void>,
    named: string,
    count: number,
    attempts = 6
  ) {
    for (let i = 0; i < attempts; i++) {
      if ((await box(named).count()) === count) return;
      await press();
      await page.waitForTimeout(150);
    }
    await expect(box(named)).toHaveCount(count, { timeout: 5_000 });
  }

  // After Enter, the next line can lag; wait longer and re-press once if stuck.
  async function expectCountAfterEnter(
    pressEnter: () => Promise<void>,
    getLocator: () => ReturnType<typeof box>,
    count: number,
    timeout = 15_000
  ) {
    await pressEnter();
    try {
      await expect(getLocator()).toHaveCount(count, { timeout });
    } catch {
      await pressEnter();
      await expect(getLocator()).toHaveCount(count, { timeout });
    }
  }

  // fill + press Enter (not keyboard.type) — IME composition in CI swallows Enter after Chinese.
  await box().first().click();
  await pressUntilCount(() => page.keyboard.press('Shift+Tab'), '场次标题', 1);
  await box('场次标题').last().fill('INT. 地铁车厢 - NIGHT');
  await expectCountAfterEnter(
    () => box('场次标题').last().press('Enter'),
    () => box(),
    2
  );

  await box().nth(1).click();
  await pressUntilCount(() => page.keyboard.press('Tab'), '角色', 1);
  await box('角色').last().fill('林晚');
  await expectCountAfterEnter(
    () => box('角色').last().press('Enter'),
    () => box('对白'),
    1
  );

  await box('对白').last().fill('末班车要到了。');
  await expectCountAfterEnter(
    () => box('对白').last().press('Enter'),
    () => box(),
    4
  );

  await box().nth(3).click();
  await pressUntilCount(() => page.keyboard.press('Shift+Tab'), '场次标题', 2);
  await box('场次标题').last().fill('EXT. 月台 - NIGHT');
  await expectCountAfterEnter(
    () => box('场次标题').last().press('Enter'),
    () => box(),
    5
  );

  await box().nth(4).click();
  await pressUntilCount(() => page.keyboard.press('Tab'), '角色', 2);

  const put = page.waitForResponse(
    (res) =>
      res.request().method() === 'PUT' &&
      res.url().includes('/screenplay') &&
      res.ok(),
    { timeout: 20_000 }
  );
  await box('角色').last().fill('值班员');
  // Click the first scene heading to blur and let debounce flush.
  await box('场次标题').first().click();
  await put;
  await expect(page.getByText('已保存', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(box('角色').nth(0)).toHaveValue('林晚');
  await expect(box('角色').nth(1)).toHaveValue('值班员');
}


test.describe('落地页与登录门', () => {
  test('落地页 CTA 未登录时进入登录页', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /写下第一个故事/ })).toBeVisible();
    await page.getByRole('link', { name: '开始写作' }).first().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('未登录访问项目列表会被送到登录', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe('注册后的书桌', () => {
  test('侧栏可在主页 / 项目 / 设置之间切换', async ({ page }) => {
    await signUp(page);

    await page.getByRole('link', { name: '项目', exact: true }).click();
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole('heading', { name: '我的项目' })).toBeVisible();

    await page.getByRole('link', { name: '主页', exact: true }).click();
    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByRole('heading', { name: /今天想写/ })).toBeVisible();

    await page.getByRole('link', { name: '设置', exact: true }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI 模型配置' })).toBeVisible();
  });

  test('新建对话框校验：空名称不可提交，取消可关闭', async ({ page }) => {
    await signUp(page);
    await page.goto('/projects');
    await expect(page.getByRole('button', { name: /新建项目/ })).toBeVisible();

    await page.getByRole('button', { name: /新建项目/ }).click();
    const dialog = page.getByRole('dialog', { name: '新建项目' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('项目名称')).toBeVisible();
    await expect(dialog.getByRole('button', { name: '创建剧本项目' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '制片项目（Cinema）' })).toBeVisible();

    await dialog.getByRole('button', { name: '取消' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('设置页可以打开新建模型配置表单', async ({ page }) => {
    await signUp(page);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'AI 模型配置' })).toBeVisible();
    await expect(page.getByText('用于文本生成')).toBeVisible();
    await expect(page.getByText('图片生成')).toHaveCount(0);
    await page.getByRole('button', { name: '新建配置' }).click();
    await expect(page.getByRole('heading', { name: '新建配置' })).toBeVisible();
    await expect(page.getByText('配置类型')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '图片生成' })).toHaveCount(0);
    await expect(
      page.getByLabel(/API Key|密钥|Key/i).or(page.locator('input[type="password"]')).first()
    ).toBeVisible();
  });
});

test.describe('剧本工作区', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`工作区 ${theme} 主题、唯一导出和次级口播入口`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 1440, height: 900 });
      await signUp(page);
      await createScriptProject(page, `PR3 ${theme} 视觉回归`);
      await writeTwoScenes(page);
      const projectId = page.url().match(/\/projects\/([^/]+)/)![1];
      const surface = theme === 'dark' ? 'rgb(34, 34, 34)' : 'rgb(255, 255, 255)';
      const exportButton = page.getByRole('button', { name: '导出 TXT PDF DOCX' });
      const panel = page.getByRole('complementary', { name: '项目面板' });
      await expect(exportButton).toHaveCount(1);
      await expect(panel.getByRole('button', { name: '导出 TXT PDF DOCX' })).toBeVisible();
      await expect(panel).toHaveCSS('background-color', surface);
      await expect(page.locator('.sp-paper')).toHaveCSS('background-color', surface);
      await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: '发送', exact: true })).toHaveCSS('font-size', '14px');
      await expect(page.getByRole('heading', { name: '剧本', exact: true })).toHaveCSS('font-size', '16px');
      await expect(page.getByRole('link', { name: '口播', exact: true })).toHaveCount(0);
      await exportButton.click();
      await expect(page.getByRole('menu')).toHaveCSS('background-color', surface);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '收起项目面板' }).click();
      await expect(exportButton).toHaveCount(1);
      await expect(page.locator('.sp-toolbar').getByRole('button', { name: '导出 TXT PDF DOCX' })).toBeVisible();
      await exportButton.click();
      await expect(page.getByRole('menu')).toHaveCSS('background-color', surface);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '展开项目面板' }).click();
      for (const [label, path] of [['剧本', 'screenplay'], ['大纲', 'outline'], ['Beats', 'beats']]) {
        await page.getByRole('link', { name: label, exact: true }).click();
        await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
        await expect(page.getByLabel('AI 指令')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(23, 23, 23)' : 'rgb(250, 250, 249)');
        if (path === 'outline') {
          await expect(page.getByLabel('大纲正文')).toBeVisible();
          await page.getByLabel('大纲正文').fill('末班车前，林晚必须找到离开的理由。');
          const saved = page.waitForResponse((res) => res.request().method() === 'PUT' && res.url().includes('/outline') && res.ok());
          await page.getByRole('heading', { name: label, exact: true }).click();
          await saved;
        }
        if (path === 'beats') {
          await page.getByRole('button', { name: '添加 Beat' }).click();
          await page.getByLabel('动作 1', { exact: true }).fill('末班车进站');
          await page.getByLabel('意图 1', { exact: true }).fill('林晚想要离开');
          await page.getByLabel('结果 1', { exact: true }).fill('她留在月台');
          const saved = page.waitForResponse((res) => res.request().method() === 'PUT' && res.url().includes('/beats') && res.ok());
          await page.getByRole('button', { name: '保存 Beats' }).click();
          await saved;
          await expect(page.getByRole('button', { name: '保存 Beats' })).toBeEnabled();
        }
        await page.screenshot({ path: testInfo.outputPath(`${path}-${theme}-1440.png`) });
      }
      await page.getByRole('button', { name: '更多', exact: true }).click();
      await expect(page.getByRole('menuitem', { name: '世界观' })).toBeFocused();
      await page.keyboard.press('End');
      await expect(page.getByRole('menuitem', { name: '口播', exact: true })).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath(`more-${theme}.png`) });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: '更多', exact: true })).toBeFocused();
      await page.getByRole('button', { name: '更多', exact: true }).click();
      await page.getByRole('menuitem', { name: '口播', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/spoken`));
      await expect(page.locator('.workspace-theme')).toHaveCount(0);
      await expect(page.getByText('口播工作区')).toBeVisible();
      await page.getByRole('link', { name: '剧本', exact: true }).click();
      for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 800 });
        await expect(page.getByRole('heading', { name: '剧本', exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await page.locator('.sp-toolbar').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      }
      await page.goto('/');
      await expect(page.locator('.workspace-theme')).toHaveCount(0);
      await expect(page.locator('.desk-page')).toHaveCSS('background-color', 'rgb(20, 18, 16)');
    });
  }


  test('从对话框创建项目并进入剧本正文', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await signUp(page);
    const projectName = `E2E 剧本 ${Date.now()}`;
    await createScriptProject(page, projectName);

    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('navigation', { name: '工作区维度' })).toBeVisible();
    await expect(page.getByText('AI 助手')).toBeVisible();
    await expect(page.getByRole('button', { name: '导出 TXT PDF DOCX' })).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('工作区切页和收起 AI 后保留草稿，浏览器返回跟随路由', async ({ page }) => {
    await signUp(page);
    await createScriptProject(page, `E2E 工作区 ${Date.now()}`);

    await page.getByLabel('AI 指令').fill('待发送的选区指令');
    await page.getByRole('button', { name: '收起', exact: true }).click();
    await expect(page.getByRole('button', { name: '展开 AI 浮层' })).toBeVisible();

    await page.getByRole('link', { name: '大纲' }).click();
    await expect(page.getByRole('link', { name: '大纲' })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('link', { name: 'Beats' }).click();
    await expect(page.getByRole('link', { name: 'Beats' })).toHaveAttribute('aria-current', 'page');

    await page.goBack();
    await expect(page.getByRole('link', { name: '大纲' })).toHaveAttribute('aria-current', 'page');
    await page.goBack();
    await expect(page.getByRole('link', { name: '剧本' })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('button', { name: '展开 AI 浮层' }).click();
    await expect(page.getByLabel('AI 指令')).toHaveValue('待发送的选区指令');

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.getByRole('button', { name: '收起项目面板' }).click();
    await expect(page.getByRole('complementary', { name: '项目面板' })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
  });

  test('AI 浮层拖动缩放后保留选区和草稿，收起后焦点回到正文', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signUp(page);
    await createScriptProject(page, `E2E AI 浮层 ${Date.now()}`);
    await writeTwoScenes(page);

    const editor = page.getByRole('list', { name: '剧本正文' });
    const input = editor.getByRole('textbox', { name: '对白' });
    await input.click();
    await input.evaluate((element: HTMLTextAreaElement) => {
      element.focus();
      element.setSelectionRange(0, 2);
    });
    await expect(input.locator('..')).toHaveClass(/is-selected/);

    const handle = page.getByRole('button', { name: '拖动 AI 浮层' });
    const panel = handle.locator('../..');
    await page.getByLabel('AI 指令').fill('请改短这段');
    await handle.click();
    await expect(page.getByText('选区 1 个节点')).toBeVisible();
    const before = await panel.boundingBox();
    expect(before).not.toBeNull();
    const message = panel.getByText(/选中对白或动作|切换「本场」|预览不写稿/);
    const messageBox = await message.boundingBox();
    expect(messageBox).not.toBeNull();
    await page.mouse.move(messageBox!.x + 20, messageBox!.y + 8);
    await page.mouse.down();
    await page.mouse.move(messageBox!.x - 80, messageBox!.y + 8, { steps: 5 });
    await page.mouse.up();
    const afterBodyDrag = await panel.boundingBox();
    expect(afterBodyDrag!.x).toBe(before!.x);
    expect(afterBodyDrag!.y).toBe(before!.y);
    const handleBox = await handle.boundingBox();
    expect(handleBox).not.toBeNull();
    await page.mouse.move(handleBox!.x + 40, handleBox!.y + 20);
    await page.mouse.down();
    await page.mouse.move(-100, 700, { steps: 8 });
    await page.mouse.up();
    const dragged = await panel.boundingBox();
    expect(dragged).not.toBeNull();
    expect(dragged!.x).toBeLessThan(before!.x);
    const workspaceLeft = await panel.evaluate((element) => element.parentElement!.getBoundingClientRect().left);
    expect(dragged!.x).toBeGreaterThanOrEqual(workspaceLeft + 8);
    expect(dragged!.y + dragged!.height).toBeLessThanOrEqual(900);

    const corner = panel.getByRole('separator', { name: '调整 AI 大小' });
    const cornerBox = await corner.boundingBox();
    expect(cornerBox).not.toBeNull();
    await page.mouse.move(cornerBox!.x + 10, cornerBox!.y + 10);
    await page.mouse.down();
    await page.mouse.move(cornerBox!.x - 500, cornerBox!.y - 500, { steps: 8 });
    await page.mouse.up();
    const shrunk = await panel.boundingBox();
    expect(shrunk!.width).toBeGreaterThanOrEqual(280);
    expect(shrunk!.height).toBeGreaterThanOrEqual(220);

    await page.setViewportSize({ width: 1024, height: 768 });
    const clamped = await panel.boundingBox();
    expect(clamped).not.toBeNull();
    expect(clamped!.x).toBeGreaterThanOrEqual(0);
    expect(clamped!.y).toBeGreaterThanOrEqual(0);
    expect(clamped!.x + clamped!.width).toBeLessThanOrEqual(1024);
    expect(clamped!.y + clamped!.height).toBeLessThanOrEqual(768);
    await expect(page.getByLabel('AI 指令')).toHaveValue('请改短这段');
    await expect(page.getByText('选区 1 个节点')).toBeVisible();

    await page.getByLabel('AI 指令').press('Escape');
    const restore = page.getByRole('button', { name: '展开 AI 浮层' });
    await expect(restore).toBeVisible();
    await expect(input).toBeFocused();
    expect(await input.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([0, 2]);
    await restore.focus();
    await restore.press('Enter');
    await expect(page.getByLabel('AI 指令')).toBeFocused();
    await expect(page.getByLabel('AI 指令')).toHaveValue('请改短这段');
    await expect(page.getByText('选区 1 个节点')).toBeVisible();
  });

  test('写下两场后角色和地点从剧本推导出来', async ({ page }) => {
    await signUp(page);
    await createScriptProject(page, `E2E 推导 ${Date.now()}`);
    await writeTwoScenes(page);

    await page.getByRole('link', { name: '角色' }).click();
    await expect(page).toHaveURL(/\/characters/);
    await expect(page.getByRole('heading', { name: '角色', exact: true })).toBeVisible();
    // Derive runs in the PUT handler; list fetch can race — retry once via reload.
    await expect(async () => {
      if (!(await page.getByRole('heading', { name: '林晚' }).isVisible().catch(() => false))) {
        await page.reload();
      }
      await expect(page.getByRole('heading', { name: '林晚' })).toBeVisible();
      await expect(page.getByRole('heading', { name: '值班员' })).toBeVisible();
    }).toPass({ timeout: 20_000 });

    await page.getByRole('link', { name: '地点' }).click();
    await expect(page).toHaveURL(/\/locations/);
    await expect(page.getByRole('heading', { name: '地点', exact: true })).toBeVisible();
    await expect(async () => {
      if (!(await page.getByRole('heading', { name: '地铁车厢' }).isVisible().catch(() => false))) {
        await page.reload();
      }
      await expect(page.getByRole('heading', { name: '地铁车厢' })).toBeVisible();
      await expect(page.getByRole('heading', { name: '月台' })).toBeVisible();
    }).toPass({ timeout: 20_000 });

    await page.getByRole('link', { name: '剧本' }).click();
    await expect(page).toHaveURL(/\/screenplay/);
    await expect(
      page.getByRole('list', { name: '剧本正文' }).getByRole('textbox', { name: '场次标题' }).first()
    ).toHaveValue('INT. 地铁车厢 - NIGHT');
    await expect(
      page.getByRole('list', { name: '剧本正文' }).getByRole('textbox', { name: '角色' }).first()
    ).toHaveValue('林晚');
  });

  test('工作区可切封面、口播，且没有分镜轨', async ({ page }) => {
    await signUp(page);
    await createScriptProject(page, `E2E 导航 ${Date.now()}`);

    await page.getByRole('button', { name: '封面' }).click();
    await expect(page).toHaveURL(/\/cover/);
    await expect(page.getByRole('heading', { name: '封面' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: '正文' }).click();
    await expect(page).toHaveURL(/\/screenplay/);

    await expect(page.getByRole('button', { name: '更多' })).toBeVisible();
    const projectId = page.url().match(/\/projects\/([^/]+)/)?.[1];
    expect(projectId).toBeTruthy();
    await page.goto(`/projects/${projectId}/spoken`);
    await expect(page).toHaveURL(/\/spoken/);
    await expect(page.getByText('口播工作区')).toBeVisible();

    await expect(page.getByRole('link', { name: '分镜' })).toBeVisible();
    await page.getByRole('link', { name: '分镜' }).click();
    await expect(page).toHaveURL(/\/storyboard/);
    await expect(page.getByRole('heading', { name: '分镜', exact: true })).toBeVisible();
  });

  test('选区 AI 无模型时中文失败且不写稿，导出 TXT 含场次', async ({ page }) => {
    test.setTimeout(90_000);
    await signUp(page);
    await createScriptProject(page, `E2E 修订导出 ${Date.now()}`);
    await writeTwoScenes(page);

    const dialogue = page.getByRole('list', { name: '剧本正文' }).getByRole('textbox', { name: '对白' });
    await expect(dialogue).toHaveValue('末班车要到了。');
    await dialogue.click();

    await page.getByLabel('AI 指令').fill('把这句改短一点');
    await page.getByRole('button', { name: '发送' }).click();
    // Bounded revise: no LLM → Chinese failure; preview never writes; no Accept.
    await expect(
      page.getByText(/未配置默认文本模型|请先在设置中配置 LLM|请先在剧本里选中|修订失败/)
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('ai-revise-accept')).toHaveCount(0);
    await expect(dialogue).toHaveValue('末班车要到了。');

    await page.getByRole('button', { name: '导出 TXT PDF DOCX' }).click();
    await expect(page.getByRole('menuitem', { name: 'TXT' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'PDF' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'DOCX' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'FDX' })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'TXT' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.txt$/i);
  });

  test('本场 AI 无模型时中文失败且草稿不变', async ({ page }) => {
    test.setTimeout(90_000);
    await signUp(page);
    await createScriptProject(page, `E2E 本场修订 ${Date.now()}`);
    await writeTwoScenes(page);

    const dialogue = page.getByRole('list', { name: '剧本正文' }).getByRole('textbox', { name: '对白' });
    await expect(dialogue.first()).toHaveValue('末班车要到了。');
    await dialogue.first().click();

    // Toggle to 本场 scope mode
    await expect(page.getByTestId('ai-scope-mode')).toBeVisible();
    await page.getByTestId('ai-scope-scene').click();
    await expect(page.getByTestId('ai-scope-scene')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText(/本场 \d+ 个节点|本场 ·/)).toBeVisible();

    await page.getByLabel('AI 指令').fill('把本场对白改急一点');
    await page.getByRole('button', { name: '发送' }).click();
    // Scene-scoped revise: no LLM → Chinese failure; preview never writes; no Accept.
    await expect(
      page.getByText(/未配置默认文本模型|请先在设置中配置 LLM|请先把光标放在某一场内|修订失败/)
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('ai-revise-accept')).toHaveCount(0);
    await expect(dialogue.first()).toHaveValue('末班车要到了。');
    // Scene B dialogue also unchanged
    const dialogues = page.getByRole('list', { name: '剧本正文' }).getByRole('textbox', { name: '对白' });
    if ((await dialogues.count()) > 1) {
      await expect(dialogues.nth(1)).toHaveValue(/.+/);
    }
  });

  test('大纲 AI 无模型时中文失败且不写段落', async ({ page }) => {
    test.setTimeout(90_000);
    await signUp(page);
    await createScriptProject(page, `E2E 大纲修订 ${Date.now()}`);

    await page.getByRole('link', { name: '大纲' }).click();
    await expect(page).toHaveURL(/\/outline/);
    const outline = page.getByLabel('大纲正文');
    await expect(outline).toBeVisible({ timeout: 15_000 });
    const marker = `大纲段落甲 ${Date.now()}\n\n大纲段落乙保持不动`;
    const saved = page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        res.url().includes('/outline') &&
        res.ok(),
      { timeout: 20_000 }
    );
    await outline.fill(marker);
    await outline.blur();
    await saved;
    await expect(page.getByText('已保存', { exact: true })).toBeVisible({ timeout: 10_000 });

    await outline.click();
    await outline.press('Home');
    await expect(page.getByText(/当前段落 ·/)).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('AI 指令').fill('把这段改短一点');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(
      page.getByText(/未配置默认文本模型|请先在设置中配置 LLM|请先把光标放在大纲段落内|修订失败/)
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('ai-revise-accept')).toHaveCount(0);
    await expect(outline).toHaveValue(marker);
  });

  test('Beats AI 无模型时中文失败且不写 Beat', async ({ page }) => {
    test.setTimeout(90_000);
    await signUp(page);
    await createScriptProject(page, `E2E Beats修订 ${Date.now()}`);

    await page.getByRole('link', { name: 'Beats' }).click();
    await expect(page).toHaveURL(/\/beats/);
    await page.getByRole('button', { name: '添加 Beat' }).click();
    await page.getByLabel('动作 1').fill('交出旧怀表');
    await page.getByLabel('意图 1').fill('求他放行');
    await page.getByLabel('结果 1').fill('门开了');
    await page.getByRole('button', { name: '添加 Beat' }).click();
    await page.getByLabel('动作 2').fill('值班员拦下她');
    await page.getByLabel('意图 2').fill('查清来历');
    await page.getByLabel('结果 2').fill('对峙升级');
    const saved = page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        res.url().includes('/beats') &&
        res.ok(),
      { timeout: 20_000 }
    );
    await page.getByRole('button', { name: '保存 Beats' }).click();
    await saved;
    await expect(page.getByText('未兑现')).toHaveCount(2, { timeout: 10_000 });

    await page.getByLabel('动作 1').click();
    await expect(page.getByText('当前 Beat', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('AI 指令').fill('把这个 Beat 写紧一点');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(
      page.getByText(/未配置默认文本模型|请先在设置中配置 LLM|请先保存该 Beat|修订失败/)
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('ai-revise-accept')).toHaveCount(0);
    await expect(page.getByLabel('动作 1')).toHaveValue('交出旧怀表');
    await expect(page.getByLabel('动作 2')).toHaveValue('值班员拦下她');
    await expect(page.getByLabel('意图 1')).toHaveValue('求他放行');
    await expect(page.getByLabel('结果 2')).toHaveValue('对峙升级');
  });

  test('无 SD worker 时生成肖像给出中文失败原因', async ({ page }) => {
    await signUp(page);
    await createScriptProject(page, `E2E 出图 ${Date.now()}`);
    await writeTwoScenes(page);

    await page.getByRole('link', { name: '角色' }).click();
    await expect(page.getByRole('heading', { name: '林晚' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '生成肖像' }).first().click();
    await expect(page.getByText('没有可用的 Stable Diffusion worker')).toBeVisible({
      timeout: 20_000,
    });
  });

  test('创建后回到项目列表能看到该项目', async ({ page }) => {
    await signUp(page);
    const projectName = `E2E 回看 ${Date.now()}`;
    await createScriptProject(page, projectName);

    await page.getByRole('link', { name: '全部项目' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible({ timeout: 10_000 });
  });

  test('主页输入框可以创建项目并跳到剧本', async ({ page }) => {
    await signUp(page);
    const name = `E2E 主页 ${Date.now()}`;
    await page.goto('/home');
    const box = page.locator('textarea').first();
    await expect(box).toBeVisible();
    await box.fill(name);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/projects\/[^/]+\/screenplay/, { timeout: 15_000 });
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
  });

  test('大纲、Beats、#道具 和世界观能形成规划闭环', async ({ page }) => {
    test.setTimeout(90_000);
    await signUp(page);
    await createScriptProject(page, `E2E 规划 ${Date.now()}`);

    await page.getByRole('link', { name: '大纲' }).click();
    await expect(page).toHaveURL(/\/outline/);
    await expect(page.getByRole('heading', { name: '大纲', exact: true })).toBeVisible();
    const outline = page.getByLabel('大纲正文');
    await expect(outline).toBeVisible({ timeout: 15_000 });
    await outline.fill('末班车前，林晚必须交出旧怀表才能离开。');
    await outline.blur();
    await expect(page.getByText('已保存', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: 'Beats' }).click();
    await expect(page).toHaveURL(/\/beats/);
    await expect(page.getByText('还没有 Beat')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '添加 Beat' }).click();
    await page.getByLabel('动作 1').fill('交出旧怀表');
    await page.getByLabel('意图 1').fill('求他放行');
    await page.getByLabel('结果 1').fill('门开了');
    await page.getByLabel('结果 1').blur();
    await page.getByRole('button', { name: '添加 Beat' }).click();
    await page.getByLabel('动作 2').fill('值班员拦下她');
    await page.getByLabel('意图 2').fill('查清来历');
    await page.getByLabel('结果 2').fill('对峙升级');
    await page.getByRole('button', { name: '保存 Beats' }).click();
    await expect(page.getByText('未兑现')).toHaveCount(2, { timeout: 10_000 });

    await page.getByRole('link', { name: '剧本' }).click();
    const editor = page.getByRole('list', { name: '剧本正文' });
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await editor.getByRole('textbox').first().click();
    await page.keyboard.type('她摸出 #旧怀表，准备交出旧怀表。');
    await expect(page.getByText('已保存', { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: '道具' }).click();
    await expect(page).toHaveURL(/\/props/);
    await expect(page.getByRole('heading', { name: '旧怀表' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: 'Beats' }).click();
    await expect(page.getByLabel('动作 1')).toHaveValue('交出旧怀表', { timeout: 10_000 });
    await expect(page.getByLabel('动作 2')).toHaveValue('值班员拦下她');
    await expect(page.getByText('已兑现')).toHaveCount(1);
    await expect(page.getByText('未兑现')).toHaveCount(1);

    await page.getByRole('button', { name: '更多' }).click();
    await page.getByRole('menuitem', { name: '世界观' }).click();
    await expect(page).toHaveURL(/\/worldview/);
    await expect(page.getByText('还没有规则')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '添加规则' }).click();
    await page.getByLabel('规则名 1').fill('时间');
    await page.getByLabel('规则内容 1').fill('地铁夜里不会再来一班车');
    await page.getByRole('button', { name: '保存世界观' }).click();
    await expect(page.getByRole('button', { name: '保存世界观' })).toBeEnabled({ timeout: 10_000 });
    await page.reload();
    await expect(page.getByLabel('规则名 1')).toHaveValue('时间', { timeout: 15_000 });
    await expect(page.getByLabel('规则内容 1')).toHaveValue('地铁夜里不会再来一班车');
  });

  test('知识库、顾问、冷启动、剧本医生和微续写能用', async ({ page }) => {
    test.setTimeout(90_000);
    await signUp(page);
    await createScriptProject(page, `E2E 协助 ${Date.now()}`);

    await page.getByRole('button', { name: '更多' }).click();
    await page.getByRole('menuitem', { name: '知识库' }).click();
    await expect(page).toHaveURL(/\/knowledge/);
    await page.getByLabel('资料名称').fill('地铁守则');
    await page.getByLabel('资料正文').fill('夜里没有下一班车。');
    await page.getByRole('button', { name: '加入知识库' }).click();
    await expect(page.getByRole('heading', { name: '地铁守则' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: '更多' }).click();
    await page.getByRole('menuitem', { name: '顾问' }).click();
    await expect(page.getByRole('heading', { name: '三幕' })).toBeVisible();
    await page.getByRole('button', { name: '雇用' }).first().click();
    await expect(page.getByText('当前顾问')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: '更多' }).click();
    await page.getByRole('menuitem', { name: '冷启动' }).click();
    await expect(page.getByRole('heading', { name: '冷启动' })).toBeVisible();
    await page.getByLabel('人物').fill('林晚');
    await page.getByLabel('欲望').fill('离开这座站');
    await page.getByRole('button', { name: '保存进度' }).click();
    await expect(page.getByRole('button', { name: '保存进度' })).toBeEnabled({ timeout: 10_000 });
    await page.reload();
    await expect(page.getByLabel('人物')).toHaveValue('林晚', { timeout: 15_000 });

    await page.getByRole('link', { name: '剧本' }).click();
    await page.getByRole('button', { name: '剧本医生' }).click();
    await expect(page.getByText('诊断（只读，不改稿）')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('大纲是空的')).toBeVisible();

    const editor = page.getByRole('list', { name: '剧本正文' });
    await editor.getByRole('textbox').first().click();
    await expect(page.getByRole('button', { name: '采纳' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '采纳' }).click();
    await expect(editor.getByRole('textbox').first()).not.toHaveValue('');
    await expect(page.getByText('已保存', { exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('分镜镜头可保存，FDX 能导出再导入成新项目', async ({ page }) => {
    test.setTimeout(90_000);
    await signUp(page);
    await createScriptProject(page, `E2E 分镜 ${Date.now()}`);
    await writeTwoScenes(page);

    await page.getByRole('link', { name: '分镜' }).click();
    await expect(page.getByRole('heading', { name: '分镜', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '添加镜头' }).click();
    await page.getByLabel('镜头 1 描述').fill('近景，旧怀表停在掌心');
    await page.getByLabel('镜头 1 机位').fill('特写');
    await page.getByLabel('镜头 1 设计').fill('暖灯，金属反光');
    await page.getByRole('button', { name: '保存镜头' }).click();
    await expect(page.getByRole('button', { name: '保存镜头' })).toBeEnabled({ timeout: 10_000 });
    await expect(page.getByLabel('镜头 1 描述')).toHaveValue('近景，旧怀表停在掌心');
    await page.reload();
    await expect(page.getByLabel('镜头 1 描述')).toHaveValue('近景，旧怀表停在掌心', { timeout: 15_000 });

    await page.getByRole('link', { name: '剧本' }).click();
    await page.getByRole('button', { name: '导出 TXT PDF DOCX' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'FDX' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.fdx$/i);
    const fdxPath = await download.path();
    expect(fdxPath).toBeTruthy();

    await page.goto('/projects');
    await page.getByRole('button', { name: /新建项目/ }).click();
    const dialog = page.getByRole('dialog', { name: '新建项目' });
    await dialog.getByLabel('导入 FDX').setInputFiles(fdxPath!);
    await expect(page).toHaveURL(/\/projects\/[^/]+\/screenplay/, { timeout: 15_000 });
    await expect(page.getByRole('list', { name: '剧本正文' }).getByRole('textbox', { name: '场次标题' }).first()).toHaveValue(
      'INT. 地铁车厢 - NIGHT'
    );
  });

  // Phase2 Outline slice acceptance: write → save → reload → still there.
  // 【事实】Outline UI/API already on main; this gates the user-visible persistence path.
  test('大纲可写读且刷新后仍在', async ({ page }) => {
    await signUp(page);
    await createScriptProject(page, `E2E 大纲切片 ${Date.now()}`);
    const marker = `大纲前提 ${Date.now()}：林晚必须在末班车前交出旧怀表。`;

    await page.getByRole('link', { name: '大纲' }).click();
    await expect(page).toHaveURL(/\/outline/);
    await expect(page.getByRole('heading', { name: '大纲', exact: true })).toBeVisible();

    const outline = page.getByLabel('大纲正文');
    await expect(outline).toBeVisible({ timeout: 15_000 });

    const put = page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        res.url().includes('/outline') &&
        res.ok(),
      { timeout: 20_000 }
    );
    await outline.fill(marker);
    await outline.blur();
    await put;
    await expect(page.getByText('已保存', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.getByLabel('大纲正文')).toHaveValue(marker, { timeout: 15_000 });
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();

    // Navigate away and back — still persisted.
    await page.getByRole('link', { name: '剧本' }).click();
    await expect(page).toHaveURL(/\/screenplay/);
    await page.getByRole('link', { name: '大纲' }).click();
    await expect(page.getByLabel('大纲正文')).toHaveValue(marker, { timeout: 15_000 });
  });

  // Phase2 Beats slice acceptance: write → save → reload → still there.
  // 【事实】Beats UI/API already on main; this gates the user-visible persistence path.
  test('Beats 可写读且刷新后仍在', async ({ page }) => {
    await signUp(page);
    await createScriptProject(page, `E2E Beats切片 ${Date.now()}`);
    const stamp = Date.now();
    const action = `动作标记 ${stamp}：末班车进站`;
    const intent = `意图标记 ${stamp}：林晚想要离开`;
    const outcome = `结果标记 ${stamp}：她留在月台`;

    await page.getByRole('link', { name: 'Beats' }).click();
    await expect(page).toHaveURL(/\/beats/);
    await expect(page.getByRole('heading', { name: 'Beats', exact: true })).toBeVisible();
    await expect(page.getByText('还没有 Beat')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: '添加 Beat' }).click();
    await page.getByLabel('动作 1', { exact: true }).fill(action);
    await page.getByLabel('意图 1', { exact: true }).fill(intent);
    await page.getByLabel('结果 1', { exact: true }).fill(outcome);

    const put = page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        res.url().includes('/beats') &&
        res.ok(),
      { timeout: 20_000 }
    );
    await page.getByRole('button', { name: '保存 Beats' }).click();
    await put;
    await expect(page.getByRole('button', { name: '保存 Beats' })).toBeEnabled({ timeout: 10_000 });
    await expect(page.getByLabel('动作 1', { exact: true })).toHaveValue(action);
    await expect(page.getByLabel('意图 1', { exact: true })).toHaveValue(intent);
    await expect(page.getByLabel('结果 1', { exact: true })).toHaveValue(outcome);

    await page.reload();
    await expect(page.getByLabel('动作 1', { exact: true })).toHaveValue(action, { timeout: 15_000 });
    await expect(page.getByLabel('意图 1', { exact: true })).toHaveValue(intent);
    await expect(page.getByLabel('结果 1', { exact: true })).toHaveValue(outcome);

    // Navigate away and back — still persisted.
    await page.getByRole('link', { name: '剧本' }).click();
    await expect(page).toHaveURL(/\/screenplay/);
    await page.getByRole('link', { name: 'Beats' }).click();
    await expect(page.getByLabel('动作 1', { exact: true })).toHaveValue(action, { timeout: 15_000 });
    await expect(page.getByLabel('意图 1', { exact: true })).toHaveValue(intent);
    await expect(page.getByLabel('结果 1', { exact: true })).toHaveValue(outcome);
  });

  test('编辑后刷新剧本仍在', async ({ page }) => {
    await signUp(page);
    await createScriptProject(page, `E2E 编辑 ${Date.now()}`);
    const marker = `落库对白 ${Date.now()}`;

    const editor = page.getByRole('list', { name: '剧本正文' });
    await expect(editor).toBeVisible({ timeout: 15_000 });
    const input = editor.getByRole('textbox').first();
    await input.click();
    const saved = page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        res.url().includes('/screenplay') &&
        res.ok(),
      { timeout: 20_000 }
    );
    await input.fill(marker);
    await saved;

    await page.reload();
    await expect(page.getByText(marker)).toBeVisible({ timeout: 10_000 });
  });

  test('分享、评论、命名版本和公开库能走通', async ({ page, browser }) => {
    test.setTimeout(90_000);
    await signUp(page);
    await createScriptProject(page, `E2E 协作 ${Date.now()}`);
    await writeTwoScenes(page);

    await expect(page.getByLabel('分享模式')).toBeVisible();
    await page.getByLabel('分享模式').selectOption('anyone_view');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: '复制分享链接' }).click();
    await expect(page.getByText('分享链接已复制')).toBeVisible({ timeout: 10_000 });

    const dialogue = page.getByRole('list', { name: '剧本正文' }).getByRole('textbox', { name: '对白' });
    await dialogue.click();
    await page.getByLabel('节点评论').fill('这句可以再压一点。');
    await page.getByLabel('节点评论').press('Enter');
    await expect(page.getByText('这句可以再压一点。')).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('版本名称').fill('第一稿');
    await page.getByRole('button', { name: '保存版本' }).click();
    await expect(page.getByText('版本已保存')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('第一稿')).toBeVisible();

    await page.getByRole('button', { name: '发布到公开库' }).click();
    await expect(page.getByText('已发布到公开库')).toBeVisible({ timeout: 10_000 });

    const context = await browser.newContext();
    const other = await context.newPage();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await other.goto('/register');
    await other.getByLabel('名称').fill('读者');
    await other.getByLabel('邮箱').fill(`e2e.reader.${stamp}@example.com`);
    await other.getByLabel('密码').fill('password1');
    await other.getByRole('button', { name: '注册' }).click();
    await expect(other).toHaveURL(/\/home/, { timeout: 15_000 });
    await other.getByRole('link', { name: '公开库' }).click();
    await expect(other).toHaveURL(/\/library/);
    await expect(other.getByRole('heading', { name: '公开库' })).toBeVisible();
    await other.getByRole('link', { name: /E2E 协作/ }).first().click();
    await expect(other.getByText('公开阅读，不能直接编辑这份稿')).toBeVisible();
    await other.getByRole('button', { name: '复制到我的工作区' }).click();
    await expect(other).toHaveURL(/\/projects\/[^/]+\/screenplay/, { timeout: 15_000 });
    await context.close();
  });

  test('窄视口默认收起项目面板且无横向滚动', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await signUp(page);
    await createScriptProject(page, `E2E 窄面板 ${Date.now()}`);

    await expect(page.getByRole('heading', { name: '剧本', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('complementary', { name: '项目面板' })).toBeHidden();
    await expect(page.getByRole('button', { name: '展开项目面板' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);

    await page.getByRole('button', { name: '展开项目面板' }).click();
    await expect(page.getByRole('complementary', { name: '项目面板' })).toBeVisible();
    await page.getByRole('button', { name: '收起项目面板' }).click();
    await expect(page.getByRole('complementary', { name: '项目面板' })).toBeHidden();
  });

  test('宽视口默认展开项目面板', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signUp(page);
    await createScriptProject(page, `E2E 宽面板 ${Date.now()}`);

    await expect(page.getByRole('heading', { name: '剧本', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('complementary', { name: '项目面板' })).toBeVisible();
    await expect(page.getByRole('button', { name: '收起项目面板' })).toBeVisible();

  });

  test('深链进入大纲/Beats 且刷新保留路由与内容', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signUp(page);
    await createScriptProject(page, `E2E 深链 ${Date.now()}`);
    const projectId = page.url().match(/\/projects\/([^/]+)/)![1];
    const outlineMarker = `深链大纲 ${Date.now()}：林晚必须在末班车前离开。`;
    const beatAction = `深链动作 ${Date.now()}：末班车进站`;

    await page.goto(`/projects/${projectId}/outline`);
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/outline`));
    await expect(page.getByRole('heading', { name: '大纲', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const outline = page.getByLabel('大纲正文');
    await expect(outline).toBeVisible({ timeout: 15_000 });
    const outlinePut = page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        res.url().includes('/outline') &&
        res.ok(),
      { timeout: 20_000 }
    );
    await outline.fill(outlineMarker);
    await outline.blur();
    await outlinePut;
    await expect(page.getByText('已保存', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/outline`));
    await expect(page.getByLabel('大纲正文')).toHaveValue(outlineMarker, { timeout: 15_000 });
    await page.goto(`/projects/${projectId}/beats`);
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/beats`));
    await expect(page.getByRole('heading', { name: 'Beats', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: '添加 Beat' }).click();
    await page.getByLabel('动作 1', { exact: true }).fill(beatAction);
    await page.getByLabel('意图 1', { exact: true }).fill('林晚想要离开');
    await page.getByLabel('结果 1', { exact: true }).fill('她留在月台');
    const beatsPut = page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        res.url().includes('/beats') &&
        res.ok(),
      { timeout: 20_000 }
    );
    await page.getByRole('button', { name: '保存 Beats' }).click();
    await beatsPut;
    await expect(page.getByLabel('动作 1', { exact: true })).toHaveValue(beatAction);

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/beats`));
    await expect(page.getByLabel('动作 1', { exact: true })).toHaveValue(beatAction, {
      timeout: 15_000,
    });
  });
});

test.describe('角色和地点 AI 定向修订', () => {
  test('角色选角备注预览显示标签，拒绝不写、接受只写备注', async ({ page }) => {
    test.setTimeout(120_000);
    await signUp(page);
    await createScriptProject(page, `E2E 角色修订 ${Date.now()}`);
    await writeTwoScenes(page);
    const projectId = page.url().match(/\/projects\/([^/]+)/)![1];
    await page.goto(`/projects/${projectId}/characters`);
    await expect(page.getByRole('heading', { name: '林晚' })).toBeVisible({ timeout: 20_000 });
    const rows = await page.evaluate(async (id) =>
      (await (await fetch(`/api/projects/${id}/characters`)).json()).data as Array<{ id: string; name: string; description: string | null; castingNotes: string | null }>, projectId);
    const target = rows.find((row) => row.name === '林晚')!;
    const sibling = rows.find((row) => row.name === '值班员')!;
    const accepts: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/revise/accept')) accepts.push(request.url());
    });
    await page.getByLabel('AI 指令').fill('写得更鲜明');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText('请先选择角色/地点')).toBeVisible();
    await page.getByRole('button', { name: '选择角色 林晚' }).click();
    await expect(page.getByText('当前角色', { exact: true })).toBeVisible();
    await page.route(`**/entities/character/${target.id}/revise/preview`, async (route) => {
      await route.fulfill({ json: { scope: { type: 'character', id: target.id },
        diff: [{ field: 'castingNotes', before: target.castingNotes, after: '适合沉稳的演员' }],
        proposalText: '【选角备注】适合沉稳的演员' } });
    });
    await page.getByLabel('AI 指令').fill('写得更鲜明');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText(/修订提案（尚未写入）/)).toBeVisible();
    await expect(page.getByText(/【选角备注】适合沉稳的演员/)).toBeVisible();
    await page.getByTestId('ai-revise-reject').click();
    await expect(page.getByTestId('ai-revise-accept')).toHaveCount(0);
    expect(accepts).toHaveLength(0);
    const afterReject = await page.evaluate(async (id) =>
      (await (await fetch(`/api/projects/${id}/characters`)).json()).data as Array<{ id: string; castingNotes: string | null }>, projectId);
    expect(afterReject.find((row) => row.id === target.id)?.castingNotes).toBe(target.castingNotes);
    await page.getByLabel('AI 指令').fill('写得更鲜明');
    await page.getByRole('button', { name: '发送' }).click();
    await page.getByTestId('ai-revise-accept').click();
    await expect(page.getByTestId(`entity-${target.id}`).getByLabel('选角备注')).toHaveValue('适合沉稳的演员');
    const after = await page.evaluate(async (id) =>
      (await (await fetch(`/api/projects/${id}/characters`)).json()).data as Array<{ id: string; description: string | null; castingNotes: string | null }>, projectId);
    expect(after.find((row) => row.id === target.id)?.castingNotes).toBe('适合沉稳的演员');
    expect(after.find((row) => row.id === target.id)?.description).toBe(target.description);
    expect(after.find((row) => row.id === sibling.id)?.castingNotes).toBe(sibling.castingNotes);
    expect(accepts).toHaveLength(1);
  });

  test('地点描述预览接受只写描述；无模型中文失败不写', async ({ page }) => {
    test.setTimeout(120_000);
    await signUp(page);
    await createScriptProject(page, `E2E 地点修订 ${Date.now()}`);
    await writeTwoScenes(page);
    const projectId = page.url().match(/\/projects\/([^/]+)/)![1];
    await page.goto(`/projects/${projectId}/locations`);
    await expect(page.getByRole('heading', { name: '地铁车厢' })).toBeVisible({ timeout: 20_000 });
    const rows = await page.evaluate(async (id) =>
      (await (await fetch(`/api/projects/${id}/locations`)).json()).data as Array<{ id: string; name: string; description: string | null; storyPlace: string | null; shootPlace: string | null }>, projectId);
    const target = rows.find((row) => row.name === '地铁车厢')!;
    const sibling = rows.find((row) => row.name === '月台')!;
    await page.getByRole('button', { name: '选择地点 地铁车厢' }).click();
    await page.getByLabel('AI 指令').fill('换一个地点');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText(/未配置默认文本模型/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('ai-revise-accept')).toHaveCount(0);
    await page.route(`**/entities/location/${target.id}/revise/preview`, async (route) => {
      await route.fulfill({ json: { scope: { type: 'location', id: target.id },
        diff: [{ field: 'description', before: target.description, after: '昏黄灯光下的末班车厢' }],
        proposalText: '【描述】昏黄灯光下的末班车厢' } });
    });
    await page.getByLabel('AI 指令').fill('换一个地点');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText(/修订提案（尚未写入）/)).toBeVisible();
    await expect(page.getByText(/【描述】昏黄灯光下的末班车厢/)).toBeVisible();
    await page.getByTestId('ai-revise-accept').click();
    await expect(page.getByTestId(`entity-${target.id}`).getByRole('textbox', { name: '描述' })).toHaveValue('昏黄灯光下的末班车厢');
    const after = await page.evaluate(async (id) =>
      (await (await fetch(`/api/projects/${id}/locations`)).json()).data as Array<{ id: string; description: string | null; storyPlace: string | null; shootPlace: string | null }>, projectId);
    expect(after.find((row) => row.id === target.id)?.description).toBe('昏黄灯光下的末班车厢');
    expect(after.find((row) => row.id === target.id)?.storyPlace).toBe(target.storyPlace);
    expect(after.find((row) => row.id === target.id)?.shootPlace).toBe(target.shootPlace);
    expect(after.find((row) => row.id === sibling.id)?.description).toBe(sibling.description);
    expect(after.find((row) => row.id === sibling.id)?.storyPlace).toBe(sibling.storyPlace);
    expect(after.find((row) => row.id === sibling.id)?.shootPlace).toBe(sibling.shootPlace);
  });
});

async function createCinemaProject(page: Page, name: string) {
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: '我的项目' })).toBeVisible();
  await page.getByRole('button', { name: /新建项目/ }).click();
  const dialog = page.getByRole('dialog', { name: '新建项目' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '制片项目（Cinema）' })).toBeVisible();
  await dialog.getByLabel('项目名称').fill(name);
  await dialog.getByRole('button', { name: '制片项目（Cinema）' }).click();
  await dialog.getByLabel('画幅').selectOption('9:16');
  await dialog.getByLabel('制片类型').fill('短片');
  await dialog.getByLabel('摄影风格').fill('手持');
  await dialog.getByLabel('美术风格').fill('胶片颗粒');
  await dialog.getByRole('button', { name: '创建制片项目' }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/reels/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Reels', exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('第四期 Cinema', () => {
  test('新建制片项目走五阶段，表演推导角色道具，成片前置生效', async ({ page }) => {
    test.setTimeout(90_000);
    await signUp(page);
    await createCinemaProject(page, `E2E 制片 ${Date.now()}`);

    await expect(page.getByRole('link', { name: 'Reels' })).toBeVisible();
    await expect(page.getByRole('link', { name: '角色' })).toBeVisible();
    await expect(page.getByRole('link', { name: '道具' })).toBeVisible();
    await expect(page.getByRole('link', { name: '任务' })).toBeVisible();
    await expect(page.getByRole('link', { name: '剧本' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '分镜' })).toHaveCount(0);
    await expect(page.getByLabel('画幅')).toHaveValue('9:16');

    await page.getByRole('button', { name: '生成文字分镜' }).click();
    await expect(page.getByText('没有表演不能出文字分镜')).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('场景').fill('INT. 地铁车厢 - NIGHT。末班车几乎空了。');
    await page.getByRole('button', { name: '保存场景' }).click();
    await expect(page.getByText('场景已保存')).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('表演').fill('@林晚 拿出 #旧怀表 「末班车要到了。」');
    await page.getByRole('button', { name: '保存表演' }).click();
    await expect(page.getByText('表演已保存')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: '生成文字分镜' }).click();
    await expect(page.getByText('近景')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('button', { name: '生成 15 秒成片' })).toBeDisabled();
    await page.getByRole('button', { name: '生成分镜图' }).click();
    await expect(page.getByText('没有可用的 Stable Diffusion worker')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: '角色' }).click();
    await expect(page.getByText('林晚')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('link', { name: '道具' }).click();
    await expect(page.getByText('旧怀表')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: '任务' }).click();
    await expect(page.getByRole('heading', { name: '任务', exact: true })).toBeVisible();

    await page.goto('/projects');
    await page.getByRole('button', { name: /新建项目/ }).click();
    const dialog = page.getByRole('dialog', { name: '新建项目' });
    await dialog.getByRole('button', { name: '制片项目（Cinema）' }).click();
    await expect(dialog.getByLabel('导入 FDX')).toHaveCount(0);
  });
});
