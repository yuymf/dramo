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
  const first = editor.getByRole('textbox').first();
  await first.click();

  await page.keyboard.press('Shift+Tab');
  await expect(editor.getByRole('textbox', { name: '场次标题' })).toHaveCount(1);
  await page.keyboard.type('INT. 地铁车厢 - NIGHT');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(editor.getByRole('textbox', { name: '角色' })).toHaveCount(1);
  await page.keyboard.type('林晚');

  await page.keyboard.press('Enter');
  await page.keyboard.type('末班车要到了。');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Tab');
  await expect(editor.getByRole('textbox', { name: '场次标题' })).toHaveCount(2);
  await page.keyboard.type('EXT. 月台 - NIGHT');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('值班员');

  await expect(page.getByText('已保存')).toBeVisible({ timeout: 15_000 });
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
    await page.getByRole('button', { name: '新建配置' }).click();
    await expect(page.getByRole('heading', { name: '新建配置' })).toBeVisible();
    await expect(
      page.getByLabel(/API Key|密钥|Key/i).or(page.locator('input[type="password"]')).first()
    ).toBeVisible();
  });
});

test.describe('剧本工作区', () => {
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

  test('写下两场后角色和地点从剧本推导出来', async ({ page }) => {
    await signUp(page);
    await createScriptProject(page, `E2E 推导 ${Date.now()}`);
    await writeTwoScenes(page);

    await page.getByRole('link', { name: '角色' }).click();
    await expect(page).toHaveURL(/\/characters/);
    await expect(page.getByRole('heading', { name: '角色', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '林晚' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '值班员' })).toBeVisible();

    await page.getByRole('link', { name: '地点' }).click();
    await expect(page).toHaveURL(/\/locations/);
    await expect(page.getByRole('heading', { name: '地点', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '地铁车厢' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '月台' })).toBeVisible();

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

  test('选区 AI 无模型时只写回范围内节点，导出 TXT 含场次', async ({ page }) => {
    await signUp(page);
    await createScriptProject(page, `E2E 修订导出 ${Date.now()}`);
    await writeTwoScenes(page);

    const dialogue = page.getByRole('list', { name: '剧本正文' }).getByRole('textbox', { name: '对白' });
    await expect(dialogue).toHaveValue('末班车要到了。');
    await dialogue.click();

    await page.getByLabel('AI 指令').fill('把这句改短一点');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText(/已按选区写回|请先在剧本里选中/)).toBeVisible({
      timeout: 20_000,
    });
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
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 10_000 });

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
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 15_000 });

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
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 15_000 });
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

  test('编辑后刷新剧本仍在', async ({ page }) => {
    await signUp(page);
    await createScriptProject(page, `E2E 编辑 ${Date.now()}`);
    const marker = `落库对白 ${Date.now()}`;

    const editor = page.getByRole('list', { name: '剧本正文' });
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await editor.getByRole('textbox').first().click();
    await page.keyboard.type(marker);
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText(marker)).toBeVisible({ timeout: 10_000 });
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

