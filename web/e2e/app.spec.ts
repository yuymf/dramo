import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Dramo 核心页面', () => {
  test('落地页渲染，CTA 进入项目列表', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /写下第一个故事/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '免费开始创作' })).toBeVisible();

    await page.getByRole('button', { name: '免费开始创作' }).click();
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole('heading', { name: '我的项目' })).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('侧栏可在主页 / 项目 / 设置之间切换', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: '我的项目' })).toBeVisible();

    await page.getByRole('link', { name: /主页/ }).click();
    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByRole('heading', { name: /今天想写/ })).toBeVisible();

    await page.getByRole('link', { name: /设置/ }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI 模型配置' })).toBeVisible();

    await page.getByRole('link', { name: /项目/ }).click();
    await expect(page).toHaveURL(/\/projects$/);
  });

  test('项目列表空态与新建对话框校验', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByText('还没有项目，点击上方卡片创建第一个项目吧')).toBeVisible();

    await page.getByRole('button', { name: /新建项目/ }).click();
    const dialog = page.getByRole('dialog', { name: '新建项目' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('项目名称')).toBeVisible();

    await expect(dialog.getByRole('button', { name: '创建' })).toBeDisabled();

    await dialog.getByRole('button', { name: '取消' }).click();
    await expect(dialog).toHaveCount(0);
  });
});

test.describe('项目工作区', () => {
  let projectName: string;

  test('从对话框创建项目并进入台本工作区', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    projectName = `E2E 台本 ${Date.now()}`;
    await page.goto('/projects');
    await page.getByRole('button', { name: /新建项目/ }).click();
    const dialog = page.getByRole('dialog', { name: '新建项目' });
    await dialog.getByLabel('项目名称').fill(projectName);
    await dialog.getByRole('button', { name: '创建' }).click();

    await expect(page).toHaveURL(/\/projects\/[^/]+/, { timeout: 15_000 });
    // /projects/:id 会重定向到 scripts
    await expect(page).toHaveURL(/\/projects\/[^/]+\/scripts/, { timeout: 15_000 });

    await expect(page.getByText('项目工作空间')).toBeVisible();
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '场景列表' })).toBeVisible();
    // 右侧对话面板
    await expect(page.getByPlaceholder(/输入|消息|问/i).or(page.locator('textarea')).first()).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('工作区侧栏可切到角色 / 地点 / 分镜且不白屏', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    projectName = `E2E 导航 ${Date.now()}`;
    await page.goto('/projects');
    await page.getByRole('button', { name: /新建项目/ }).click();
    const dialog = page.getByRole('dialog', { name: '新建项目' });
    await dialog.getByLabel('项目名称').fill(projectName);
    await dialog.getByRole('button', { name: '创建' }).click();
    await expect(page).toHaveURL(/\/scripts/, { timeout: 15_000 });

    await page.getByRole('link', { name: '角色' }).click();
    await expect(page).toHaveURL(/\/characters/);
    await expect(page.locator('body')).not.toHaveText(/Application error/i);

    await page.getByRole('link', { name: '地点' }).click();
    await expect(page).toHaveURL(/\/locations/);
    await expect(page.locator('body')).not.toHaveText(/Application error/i);

    await page.getByRole('link', { name: '分镜' }).click();
    await expect(page).toHaveURL(/\/storyboard/);
    await expect(page.locator('body')).not.toHaveText(/Application error/i);

    await page.getByRole('link', { name: '台本' }).click();
    await expect(page).toHaveURL(/\/scripts/);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('创建后回到项目列表能看到该项目', async ({ page }) => {
    projectName = `E2E 回看 ${Date.now()}`;
    await page.goto('/projects');
    await page.getByRole('button', { name: /新建项目/ }).click();
    const dialog = page.getByRole('dialog', { name: '新建项目' });
    await dialog.getByLabel('项目名称').fill(projectName);
    await dialog.getByRole('button', { name: '创建' }).click();
    await expect(page).toHaveURL(/\/projects\/[^/]+/, { timeout: 15_000 });

    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible({ timeout: 10_000 });
  });

  test('主页输入框可以创建项目并跳到台本', async ({ page }) => {
    const name = `E2E 主页 ${Date.now()}`;
    await page.goto('/home');
    const box = page.locator('textarea').first();
    await expect(box).toBeVisible();
    await box.fill(name);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/projects\/[^/]+\/scripts/, { timeout: 15_000 });
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
  });
});
