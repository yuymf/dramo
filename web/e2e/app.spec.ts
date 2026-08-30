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

    await expect(page.getByRole('link', { name: '分镜' })).toHaveCount(0);
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
