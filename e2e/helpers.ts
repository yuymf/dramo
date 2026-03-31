import { Page, expect } from '@playwright/test';

/**
 * Authentication helpers for E2E tests
 */
export async function login(
  page: Page,
  email: string = 'demo@example.com',
  password: string = 'demo123456',
) {
  await page.goto('/login');
  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  // Wait for redirect to home or projects (depends on app configuration)
  await page.waitForURL(/\/(home|projects)/, { timeout: 10000 });
}

export async function logout(page: Page) {
  await page.click('button[aria-label="User menu"]');
  await page.click('button:has-text("Logout")');
  await page.waitForURL('/login');
}

/**
 * Project helpers
 */
export async function createProject(page: Page, projectName: string, description?: string) {
  await page.click('button:has-text("New Project")');
  await page.fill('input[placeholder*="Project name"]', projectName);
  if (description) {
    await page.fill('textarea[placeholder*="Description"]', description);
  }
  await page.click('button:has-text("Create")');
  await page.waitForURL(/\/projects\/[^/]+\/?$/);
  return page.url();
}

export async function navigateToProject(page: Page, projectIndex: number = 0) {
  // Try to find project cards using flexible selectors
  // Look for Link components that navigate to /projects/[id]
  const projectLinks = page.locator('a[href*="/projects/"]').filter({
    has: page.locator('div') // Has at least a div child (card structure)
  });

  const count = await projectLinks.count();
  if (count === 0) {
    throw new Error(`No project links found. Make sure you're on the projects page.`);
  }

  if (projectIndex >= count) {
    throw new Error(`Project index ${projectIndex} out of range (found ${count} projects)`);
  }

  await projectLinks.nth(projectIndex).click();
  await page.waitForURL(/\/projects\/[^/]+\/?$/, { timeout: 10000 });
}

/**
 * Character helpers
 */
export async function addCharacter(
  page: Page,
  name: string,
  age?: number,
  description?: string,
) {
  await page.click('button:has-text("Add Character")');
  await page.fill('input[name="name"]', name);
  if (age) {
    await page.fill('input[name="age"]', age.toString());
  }
  if (description) {
    await page.fill('textarea[name="description"]', description);
  }
  await page.click('button:has-text("Save")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator(`text=${name}`)).toBeVisible();
}

export async function deleteCharacter(page: Page, name: string) {
  const character = page.locator(`[data-testid="character-item"]:has-text("${name}")`);
  await character.hover();
  await character.locator('[aria-label="Delete"]').click();
  await page.click('button:has-text("Confirm")');
  await page.waitForLoadState('networkidle');
}

/**
 * Location helpers
 */
export async function addLocation(page: Page, name: string, description?: string) {
  await page.click('button:has-text("Add Location")');
  await page.fill('input[name="name"]', name);
  if (description) {
    await page.fill('textarea[name="description"]', description);
  }
  await page.click('button:has-text("Save")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator(`text=${name}`)).toBeVisible();
}

/**
 * Script generation helpers
 */
export async function generateScript(
  page: Page,
  topic: string,
  options?: {
    duration?: number;
    tone?: string;
    characters?: string[];
    location?: string;
  },
) {
  await page.fill('textarea[placeholder*="topic"]', topic);

  if (options?.duration) {
    await page.fill('input[name="duration"]', options.duration.toString());
  }

  if (options?.tone) {
    await page.selectOption('select[name="tone"]', options.tone);
  }

  if (options?.characters && options.characters.length > 0) {
    for (const character of options.characters) {
      await page.click(`[role="option"]:has-text("${character}")`);
    }
  }

  if (options?.location) {
    await page.click(`[role="option"]:has-text("${options.location}")`);
  }

  await page.click('button:has-text("Generate Script")');
  await page.waitForSelector('[data-testid="script-content"]', { timeout: 60000 });
}

/**
 * Script editing helpers
 */
export async function editScriptContent(page: Page, newContent: string) {
  const editor = page.locator('[data-testid="script-editor"]');
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(newContent);
  await page.waitForLoadState('networkidle');
}

export async function exportScript(page: Page, format: 'pdf' | 'docx' | 'json') {
  await page.click('button:has-text("Export")');
  await page.click(`[data-testid="export-${format}"]`);
  const downloadPromise = page.waitForEvent('download');
  return await downloadPromise;
}

/**
 * Navigation helpers
 */
export async function navigateToSection(page: Page, sectionName: string) {
  await page.click(`a:has-text("${sectionName}")`);
  await page.waitForLoadState('networkidle');
}

/**
 * Assertion helpers
 */
export async function expectElementToBeVisible(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible();
}

export async function expectElementToContainText(page: Page, selector: string, text: string) {
  await expect(page.locator(selector)).toContainText(text);
}

/**
 * Wait helpers
 */
export async function waitForSave(page: Page, timeout: number = 3000) {
  await page.waitForLoadState('networkidle', { timeout });
  const saveStatus = page.locator('[data-testid="save-status"]');
  await expect(saveStatus).toContainText('Saved', { timeout: 5000 });
}
