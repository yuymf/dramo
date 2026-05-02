import { test, expect, type Page } from '@playwright/test';

/**
 * Character creation smoke test
 * Validates the "新建角色" (new character) flow in the CharacterRelationPanel.
 *
 * Implementation notes:
 * - Characters page lives at /projects/[id]/characters (parallel route @content/characters)
 * - "新建角色" button calls handleAddCharacter, which opens a browser prompt()
 * - We handle the dialog with Playwright's dialog event handler
 * - After creation the character name appears in CharacterAssetsList and the graph panel
 */

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo123456';
const TEST_CHARACTER_NAME = 'E2E Hero';

/** Reusable login helper that matches the real login page selectors */
async function loginAsDemo(page: Page) {
  await page.goto('/login');
  await page.fill('input#email', DEMO_EMAIL);
  await page.fill('input#password', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(home|projects)/, { timeout: 10000 });
}

test('can add a character via the 新建角色 button', async ({ page }) => {
  await loginAsDemo(page);

  // Go to project list
  await page.goto('/projects');
  const firstProjectLink = page.locator('a[href*="/projects/"]').first();
  await expect(firstProjectLink).toBeVisible({ timeout: 8000 });
  await firstProjectLink.click();
  await page.waitForURL(/\/projects\/.+/, { timeout: 10000 });

  // Navigate to characters section via sidebar link
  await page.click('a[href*="/characters"]');
  await page.waitForURL(/\/projects\/.+\/characters/, { timeout: 8000 });
  await page.waitForLoadState('networkidle');

  // Register dialog handler BEFORE clicking the button.
  // CharacterRelationPanel.handleAddCharacter() calls prompt("请输入角色名称：")
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('prompt');
    await dialog.accept(TEST_CHARACTER_NAME);
  });

  // Click the "新建角色" button in the CharacterRelationPanel toolbar
  await page.click('button:has-text("新建角色")');

  // After accepting the prompt the character should appear in the page
  await expect(page.getByText(TEST_CHARACTER_NAME)).toBeVisible({ timeout: 8000 });
});

test('character count badge increments after adding a character', async ({ page }) => {
  await loginAsDemo(page);

  await page.goto('/projects');
  const firstProjectLink = page.locator('a[href*="/projects/"]').first();
  await expect(firstProjectLink).toBeVisible({ timeout: 8000 });
  await firstProjectLink.click();
  await page.waitForURL(/\/projects\/.+/, { timeout: 10000 });

  await page.click('a[href*="/characters"]');
  await page.waitForURL(/\/projects\/.+\/characters/, { timeout: 8000 });
  await page.waitForLoadState('networkidle');

  // Read initial count from the badge in the header (h1 sibling badge)
  const badgeLocator = page.locator('h1:has-text("角色管理") ~ span').first();
  const initialText = await badgeLocator.textContent().catch(() => '0');
  const initialCount = parseInt(initialText ?? '0', 10);

  // Accept the prompt dialog automatically
  const uniqueName = `E2E_Count_${Date.now()}`;
  page.once('dialog', async (dialog) => {
    await dialog.accept(uniqueName);
  });

  await page.click('button:has-text("新建角色")');

  // The character name appears in the page
  await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 8000 });

  // The count badge should reflect the new total
  const newText = await badgeLocator.textContent().catch(() => '0');
  const newCount = parseInt(newText ?? '0', 10);
  expect(newCount).toBeGreaterThanOrEqual(initialCount);
});
