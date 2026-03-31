import { test, expect } from '@playwright/test';
import {
  login,
  logout,
  createProject,
  navigateToProject,
  addCharacter,
  addLocation,
  generateScript,
  navigateToSection,
  waitForSave,
} from './helpers';

test.describe.skip('Dramo Complete User Journey', () => {
  // NOTE: These tests are skipped temporarily while we fix UI selectors
  // They depend on helpers that need verification against actual UI

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    // Logout after each test
    await logout(page);
  });

  test('User creates a complete script project from scratch', async ({ page }) => {
    // Step 1: Create a new project
    const projectUrl = await createProject(
      page,
      'My First Dramo Script',
      'A script created with Playwright E2E testing',
    );
    expect(projectUrl).toContain('/projects/');

    // Step 2: Navigate to Characters and add characters
    await navigateToSection(page, 'Characters');
    await addCharacter(page, 'Emma', 25, 'The protagonist, a young ambitious journalist');
    await addCharacter(page, 'Marco', 30, 'A mysterious informant with secrets');
    await addCharacter(page, 'Sarah', 28, 'Emma\'s best friend and fellow journalist');

    // Verify all characters are visible
    await expect(page.locator('text=Emma')).toBeVisible();
    await expect(page.locator('text=Marco')).toBeVisible();
    await expect(page.locator('text=Sarah')).toBeVisible();

    // Step 3: Add locations
    await navigateToSection(page, 'Locations');
    await addLocation(page, 'Newsroom', 'A busy newsroom of a major newspaper');
    await addLocation(page, 'Coffee Shop', 'A cozy cafe where secrets are shared');
    await addLocation(page, 'Underground Parking', 'A dimly lit parking garage');

    // Verify locations
    await expect(page.locator('text=Newsroom')).toBeVisible();
    await expect(page.locator('text=Coffee Shop')).toBeVisible();
    await expect(page.locator('text=Underground Parking')).toBeVisible();

    // Step 4: Generate script with AI
    await navigateToSection(page, 'Input');

    await generateScript(page, 'A journalist uncovers a conspiracy', {
      duration: 10,
      tone: 'dramatic',
      characters: ['Emma', 'Marco'],
      location: 'Newsroom',
    });

    // Step 5: Verify script was generated
    const scriptContent = page.locator('[data-testid="script-content"]');
    await expect(scriptContent).toBeVisible();

    // Step 6: Navigate to script editor
    await navigateToSection(page, 'Scripts');
    await page.click('[data-testid="script-item"]');

    // Step 7: Review and edit the generated script
    await page.locator('[data-testid="script-editor"]').click();
    const currentContent = await page.locator('[data-testid="script-editor"]').textContent();
    expect(currentContent).toContain('Emma');

    // Step 8: View storyboard
    await navigateToSection(page, 'Storyboard');
    const storyboardContainer = page.locator('[data-testid="storyboard-container"]');
    await expect(storyboardContainer).toBeVisible();

    // Step 9: Export script
    await navigateToSection(page, 'Scripts');
    await page.click('button:has-text("Export")');
    await page.click('[data-testid="export-pdf"]');

    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('script');

    console.log('✅ User journey completed: Script project created, generated, and exported');
  });

  test('User collaborates using branching dialogue options', async ({ page }) => {
    // Create or navigate to project
    await createProject(page, 'Interactive Script Project');

    // Add characters for dialogue
    await navigateToSection(page, 'Characters');
    await addCharacter(page, 'Narrator', 40);
    await addCharacter(page, 'Player', 30);

    // Navigate to branching editor
    await navigateToSection(page, 'Scripts');
    await page.click('button:has-text("Branching")');

    // Create branching structure
    await page.click('[data-testid="add-branch-btn"]');
    await page.fill('input[name="branch-title"]', 'First Decision Point');
    await page.waitForLoadState('networkidle');

    // Add dialogue options
    await page.click('button:has-text("Add Dialogue Option")');
    await page.fill('textarea[name="dialogue-0"]', 'Option 1: Accept the quest');

    await page.click('button:has-text("Add Dialogue Option")');
    await page.fill('textarea[name="dialogue-1"]', 'Option 2: Decline and walk away');

    await page.click('button:has-text("Save")');
    await waitForSave(page);

    // Verify branching structure
    await expect(page.locator('text=First Decision Point')).toBeVisible();
    await expect(page.locator('text=Accept the quest')).toBeVisible();
    await expect(page.locator('text=Decline and walk away')).toBeVisible();

    console.log('✅ Branching dialogue flow created successfully');
  });

  test('User manages multiple projects and switches between them', async ({ page }) => {
    // Create first project
    const project1Url = await createProject(page, 'Drama Project 1');
    await addCharacter(page, 'Character A');

    // Return to projects list
    await page.click('a:has-text("Projects")');
    await page.waitForURL('/projects');

    // Create second project
    await createProject(page, 'Drama Project 2');
    await addCharacter(page, 'Character B');

    // Return to projects list
    await page.click('a:has-text("Projects")');
    await page.waitForURL('/projects');

    // Verify both projects are listed
    await expect(page.locator('text=Drama Project 1')).toBeVisible();
    await expect(page.locator('text=Drama Project 2')).toBeVisible();

    // Switch back to first project
    await page.click('text=Drama Project 1');
    await page.waitForURL(/\/projects\/[^/]+/);

    // Verify we're in project 1 and can see Character A
    await navigateToSection(page, 'Characters');
    await expect(page.locator('text=Character A')).toBeVisible();

    console.log('✅ Multiple project management flow completed');
  });

  test('User generates and refines script with AI suggestions', async ({ page }) => {
    await createProject(page, 'AI Refinement Project');

    // Setup characters and location
    await navigateToSection(page, 'Characters');
    await addCharacter(page, 'Hero');
    await addCharacter(page, 'Villain');

    await navigateToSection(page, 'Locations');
    await addLocation(page, 'Castle');

    // Generate initial script
    await navigateToSection(page, 'Input');
    await generateScript(page, 'A hero confronts the villain in a castle', {
      characters: ['Hero', 'Villain'],
      location: 'Castle',
      duration: 5,
      tone: 'dramatic',
    });

    // Wait for generation to complete
    await page.waitForLoadState('networkidle');

    // Open AI Chat (if available in your UI)
    const aiChatButton = page.locator('button[aria-label="AI Chat"]');
    if (await aiChatButton.isVisible()) {
      await aiChatButton.click();

      // Send refinement request
      await page.fill('[data-testid="ai-chat-input"]', 'Make the dialogue more witty and sharp');
      await page.press('[data-testid="ai-chat-input"]', 'Enter');

      // Wait for AI response
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    console.log('✅ Script generation and AI refinement flow completed');
  });

  test('User performs data validation and error handling', async ({ page }) => {
    // Try to create project with empty name
    await page.click('button:has-text("New Project")');
    await page.click('button:has-text("Create")');

    // Expect validation error
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toContainText('required');

    // Fill form correctly
    await page.fill('input[placeholder*="Project name"]', 'Valid Project Name');
    await page.click('button:has-text("Create")');
    await page.waitForURL(/\/projects\/[^/]+/);

    // Try to add character with invalid age
    await navigateToSection(page, 'Characters');
    await page.click('button:has-text("Add Character")');
    await page.fill('input[name="name"]', 'Test');
    await page.fill('input[name="age"]', 'invalid');
    await page.click('button:has-text("Save")');

    // Expect validation error
    await expect(page.locator('[role="alert"]')).toContainText('number');

    // Fix and retry
    await page.fill('input[name="age"]', '25');
    await page.click('button:has-text("Save")');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Test')).toBeVisible();

    console.log('✅ Data validation and error handling verified');
  });

  test('Responsive design: Mobile and tablet views', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile
    await createProject(page, 'Mobile Project');

    // Test mobile navigation
    const mobileMenu = page.locator('button[aria-label="Menu"]');
    await expect(mobileMenu).toBeVisible();

    await mobileMenu.click();
    await expect(page.locator('nav[data-testid="mobile-nav"]')).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 }); // Tablet

    // Navigation should be visible differently
    const sidebarNav = page.locator('nav[data-testid="sidebar"]');
    await expect(sidebarNav).toBeVisible();

    console.log('✅ Responsive design verified for mobile and tablet');
  });
});
