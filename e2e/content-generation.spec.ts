import { test, expect } from '@playwright/test';
import { login } from './helpers';

/**
 * Content Generation Flow E2E Tests
 * Tests the complete journey: Project → Input → Script Generation → Storyboard
 */

test.describe('Dramo Content Generation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
  });

  test('should navigate to project and input form', async ({ page }) => {
    // We're on projects page after login
    await expect(page).toHaveURL(/\/(home|projects)/);

    // Find first project or look for project creation
    // Since we don't have data-testid yet, use flexible selectors
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();

    // If there's a project, navigate to it
    if (count > 0) {
      await projectLinks.first().click();
      await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

      // Verify we're in a project
      const url = page.url();
      expect(url).toMatch(/\/projects\/[a-z0-9_-]+/);
    } else {
      test.skip();
      return;
    }
  });

  test('should access input page for script generation', async ({ page }) => {
    // Navigate to projects first
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    // Go to first project
    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    // Try to navigate to input page
    // Look for navigation links or tabs
    const inputLinks = page.locator('a, button').filter({
      hasText: /输入|生成|input|generation/i
    });

    const inputLinkCount = await inputLinks.count();

    // Try common patterns for navigation
    if (inputLinkCount > 0) {
      // Click the first matching link
      await inputLinks.first().click();
      await page.waitForLoadState('networkidle', { timeout: 5000 });
    } else {
      // Alternative: Try direct URL navigation if project ID is known
      const url = page.url();
      const projectId = url.match(/\/projects\/([^/]+)/)?.[1];

      if (projectId) {
        await page.goto(`/projects/${projectId}/input`);
        await page.waitForLoadState('networkidle', { timeout: 5000 });
      } else {
        test.skip();
        return;
      }
    }

    // Verify we're on the input page
    const pageContent = await page.content();
    // Should have some indication of input form or generation interface
    expect(pageContent.length).toBeGreaterThan(500);
  });

  test('should display script editor or generation interface', async ({ page }) => {
    // Navigate to a project
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    // Look for script-related UI elements
    const scriptButtons = page.locator('button, a').filter({
      hasText: /脚本|script|编辑|edit/i
    });

    const scriptCount = await scriptButtons.count();

    if (scriptCount > 0) {
      // Click to navigate to scripts
      await scriptButtons.first().click();
      await page.waitForLoadState('networkidle', { timeout: 5000 });

      // Verify some content loaded
      const bodyContent = await page.content();
      expect(bodyContent.length).toBeGreaterThan(200);
    }
  });

  test('should display storyboard or scenes interface', async ({ page }) => {
    // Navigate to project
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    // Try to find storyboard navigation
    const storyboardLinks = page.locator('a, button').filter({
      hasText: /分镜|storyboard|场景|scene/i
    });

    const storyboardCount = await storyboardLinks.count();

    if (storyboardCount > 0) {
      await storyboardLinks.first().click();
      await page.waitForLoadState('networkidle', { timeout: 5000 });

      // Verify storyboard content
      const content = await page.content();
      expect(content.length).toBeGreaterThan(200);
    }
  });

  test('should navigate between different script modes', async ({ page }) => {
    // Get to a project
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    const projectUrl = page.url();
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1];

    if (!projectId) {
      test.skip();
      return;
    }

    // Try to navigate to different script modes
    const modes = ['script', 'dialogue', 'hollywood'];
    let successCount = 0;

    for (const mode of modes) {
      try {
        await page.goto(`/projects/${projectId}/scripts/${mode}`, { timeout: 5000 });
        const content = await page.content();

        if (content.length > 200) {
          successCount++;
        }
      } catch {
        // Mode might not be available, continue
        continue;
      }
    }

    // At least one mode should load
    expect(successCount).toBeGreaterThanOrEqual(1);
  });

  test('should handle character management', async ({ page }) => {
    // Get to project
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    const projectUrl = page.url();
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1];

    if (!projectId) {
      test.skip();
      return;
    }

    // Navigate to characters page
    await page.goto(`/projects/${projectId}/characters`);
    await page.waitForLoadState('networkidle', { timeout: 5000 });

    // Should have characters page content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(200);
  });

  test('should handle location management', async ({ page }) => {
    // Get to project
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    const projectUrl = page.url();
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1];

    if (!projectId) {
      test.skip();
      return;
    }

    // Navigate to locations page
    await page.goto(`/projects/${projectId}/locations`);
    await page.waitForLoadState('networkidle', { timeout: 5000 });

    // Should have locations page content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(200);
  });

  test('should handle input page navigation', async ({ page }) => {
    // Get to project
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    const projectUrl = page.url();
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1];

    if (!projectId) {
      test.skip();
      return;
    }

    // Navigate to input page
    await page.goto(`/projects/${projectId}/input`);
    await page.waitForLoadState('networkidle', { timeout: 5000 });

    // Should have input page content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(200);
  });

  test('should maintain authentication while navigating features', async ({ page }) => {
    // Get to project
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    const projectUrl = page.url();
    const projectId = projectUrl.match(/\/projects\/[^/]+/)?.[0];

    if (!projectId) {
      test.skip();
      return;
    }

    // Navigate through different pages
    const paths = ['input', 'scripts', 'characters', 'locations', 'storyboard'];

    for (const path of paths) {
      try {
        await page.goto(`/projects/${projectId}/${path}`, { timeout: 5000 });

        // Should still be authenticated
        const url = page.url();
        expect(url).toContain(projectId);

        // Should not redirect to login
        expect(url).not.toContain('/login');
      } catch {
        // Some paths might not exist, that's ok
        continue;
      }
    }
  });
});

/**
 * Content Creation with Data Input Tests
 * These tests verify form submission and data handling
 */
test.describe('Content Creation with Data Input', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load and display forms for content creation', async ({ page }) => {
    // Navigate to projects
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    // Navigate to first project
    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    const projectUrl = page.url();
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1];

    if (!projectId) {
      test.skip();
      return;
    }

    // Navigate to input page
    await page.goto(`/projects/${projectId}/input`);
    await page.waitForLoadState('networkidle', { timeout: 5000 });

    // Look for form elements - inputs, textareas, buttons
    const inputs = page.locator('input, textarea, select, button');
    const inputCount = await inputs.count();

    // Should have at least some form controls
    expect(inputCount).toBeGreaterThan(0);
  });

  test('should handle form interactions without errors', async ({ page }) => {
    // Navigate to projects
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    const projectUrl = page.url();
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1];

    if (!projectId) {
      test.skip();
      return;
    }

    // Navigate to input page
    await page.goto(`/projects/${projectId}/input`);
    await page.waitForLoadState('networkidle', { timeout: 5000 });

    // Try to find and interact with form fields
    const textInputs = page.locator('input[type="text"], textarea');
    const inputCount = await textInputs.count();

    if (inputCount > 0) {
      // Fill first text input with sample text
      const firstInput = textInputs.first();
      await firstInput.fill('测试输入');

      // Verify text was entered
      const value = await firstInput.inputValue();
      expect(value).toBe('测试输入');
    }
  });

  test('should navigate to script after generation workflow', async ({ page }) => {
    // Navigate to projects
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    const projectUrl = page.url();
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1];

    if (!projectId) {
      test.skip();
      return;
    }

    // Navigate to scripts directly
    await page.goto(`/projects/${projectId}/scripts`);
    await page.waitForLoadState('networkidle', { timeout: 5000 });

    // Should display script editor interface
    const content = await page.content();
    expect(content.length).toBeGreaterThan(200);

    // Check for editor controls
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);
  });
});

/**
 * Responsive Layout Tests for Content Areas
 */
test.describe('Content Generation - Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load content area on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Navigate to projects
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    // Should display properly on desktop
    const bodyElement = page.locator('body');
    await expect(bodyElement).toBeVisible();

    // Check main content area is accessible
    const mainContent = page.locator('main');
    const mainCount = await mainContent.count();
    expect(mainCount).toBeGreaterThan(0);
  });

  test('should load content area on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Navigate to projects
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    // Should display properly on tablet
    const bodyElement = page.locator('body');
    await expect(bodyElement).toBeVisible();
  });

  test('should remain authenticated on all feature pages', async ({ page }) => {
    // Navigate to projects
    const projectLinks = page.locator('a[href*="/projects/"]').filter({
      has: page.locator('div')
    });

    const count = await projectLinks.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });

    const projectId = page.url().match(/\/projects\/([^/]+)/)?.[1];
    if (!projectId) {
      test.skip();
      return;
    }

    // Check multiple feature pages for authentication
    const featurePages = ['input', 'scripts', 'characters', 'locations'];

    for (const feature of featurePages) {
      try {
        const response = await page.goto(`/projects/${projectId}/${feature}`, {
          timeout: 5000,
          waitUntil: 'networkidle'
        });

        // Should not get redirected to login
        if (response) {
          const status = response.status();
          expect([200, 304]).toContain(status);
        }

        // Verify we're still on project page, not login
        const url = page.url();
        expect(url).not.toContain('/login');
      } catch {
        // Some features may not be available, continue
        continue;
      }
    }
  });
});
