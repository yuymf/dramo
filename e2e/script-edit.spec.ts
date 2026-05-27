import { test, expect, type Page } from '@playwright/test';

/**
 * Script Editor smoke tests
 * Validates that the script editor loads and keyboard shortcuts work.
 *
 * Selectors derived from actual component structure:
 * - Login uses input#email / input#password (LoginPage)
 * - Project cards are <a href="/projects/[id]"> links (ProjectCard)
 * - Script editor uses .tiptap (TipTap) inside ScriptEditorClient
 * - Save status text is "已保存" (ScriptEditorShell statusLabel)
 */

/** Reusable login helper that matches the real login page selectors */
async function loginAsDemo(page: Page) {
  await page.goto('/login');
  await page.fill('input#email', 'demo@example.com');
  await page.fill('input#password', 'demo123456');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(home|projects)/, { timeout: 10000 });
}

test.describe('Script editor', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test('can open a project and see the script editor', async ({ page }) => {
    // Navigate to projects list
    await page.goto('/projects');

    // Click first project card (Link href="/projects/[id]")
    const firstProjectLink = page.locator('a[href*="/projects/"]').first();
    await expect(firstProjectLink).toBeVisible({ timeout: 8000 });
    await firstProjectLink.click();

    // Wait for the project workspace to load
    await page.waitForURL(/\/projects\/.+/, { timeout: 10000 });

    // Navigate to the scripts section via sidebar link
    await page.click('a[href*="/scripts"]');
    await page.waitForURL(/\/projects\/.+\/scripts/, { timeout: 8000 });

    // TipTap renders with class .tiptap — this is the content-editable editor
    await expect(
      page.locator('.tiptap, [data-testid="script-editor"]').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('Cmd+S triggers save and shows 已保存 status', async ({ page }) => {
    await page.goto('/projects');

    const firstProjectLink = page.locator('a[href*="/projects/"]').first();
    await expect(firstProjectLink).toBeVisible({ timeout: 8000 });
    await firstProjectLink.click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 10000 });

    await page.click('a[href*="/scripts"]');
    await page.waitForURL(/\/projects\/.+\/scripts/, { timeout: 8000 });

    // Wait for the editor to be ready
    await page.waitForLoadState('networkidle');

    // Press Cmd+S (macOS) / Ctrl+S (Linux/Windows) — both are handled by ScriptEditorShell
    await page.keyboard.press('Meta+s');

    // ScriptEditorShell renders statusLabel.saved = '已保存' in a <span>
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 5000 });
  });
});
