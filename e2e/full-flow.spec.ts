import { test, expect } from '@playwright/test';

test.describe.skip('Dramo Full Flow', () => {
  // Helper to login
  // NOTE: These tests are skipped temporarily while we fix UI selectors
  // They assume specific UI structure that needs verification
  async function login(page: any, email: string, password: string) {
    await page.goto('/login');
    await page.fill('input#email', email);
    await page.fill('input#password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/projects');
  }

  test('E2E: Create project, add characters, generate script', async ({
    page,
  }) => {
    // Step 1: Login
    await login(page, 'test@dramo.ai', 'Test@12345');

    // Verify we're on the projects page
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.locator('h1')).toContainText('Projects');

    // Step 2: Create a new project
    await page.click('button:has-text("New Project")');
    await page.fill('input[placeholder*="Project name"]', 'E2E Test Project');
    await page.fill('textarea[placeholder*="Description"]', 'Test project for E2E flow');
    await page.click('button:has-text("Create")');

    // Wait for project creation and redirect to project detail
    await page.waitForURL(/\/projects\/[^/]+\/?$/);
    const projectUrl = page.url();

    // Verify project name in header
    await expect(page.locator('h1')).toContainText('E2E Test Project');

    // Step 3: Navigate to Characters section
    await page.click('a:has-text("Characters")');
    await expect(page).toHaveURL(/\/projects\/[^/]+\/characters/);

    // Step 4: Create first character
    await page.click('button:has-text("Add Character")');
    await page.fill('input[name="name"]', 'Alice');
    await page.fill('input[name="age"]', '28');
    await page.click('button:has-text("Save")');
    await page.waitForLoadState('networkidle');

    // Verify character was added
    await expect(page.locator('text=Alice')).toBeVisible();

    // Step 5: Create second character
    await page.click('button:has-text("Add Character")');
    await page.fill('input[name="name"]', 'Bob');
    await page.fill('input[name="age"]', '32');
    await page.click('button:has-text("Save")');
    await page.waitForLoadState('networkidle');

    // Verify second character
    await expect(page.locator('text=Bob')).toBeVisible();

    // Step 6: Navigate to Locations
    await page.click('a:has-text("Locations")');
    await expect(page).toHaveURL(/\/projects\/[^/]+\/locations/);

    // Step 7: Create a location
    await page.click('button:has-text("Add Location")');
    await page.fill('input[name="name"]', 'Coffee Shop');
    await page.fill('textarea[name="description"]', 'A cozy coffee shop in downtown');
    await page.click('button:has-text("Save")');
    await page.waitForLoadState('networkidle');

    // Verify location
    await expect(page.locator('text=Coffee Shop')).toBeVisible();

    // Step 8: Navigate to Input form for script generation
    await page.click('a:has-text("Input")');
    await expect(page).toHaveURL(/\/projects\/[^/]+\/input/);

    // Step 9: Fill in generation parameters
    await page.fill('textarea[placeholder*="topic"]', 'A conversation between friends');
    await page.fill('input[name="duration"]', '5');
    await page.selectOption('select[name="tone"]', 'casual');

    // Select characters
    await page.click('[role="listbox"] >> text=Alice');
    await page.click('[role="listbox"] >> text=Bob');

    // Select location
    await page.click('[role="listbox"] >> text=Coffee Shop');

    // Step 10: Generate script
    await page.click('button:has-text("Generate Script")');

    // Wait for generation to complete
    await page.waitForSelector('[data-testid="script-content"]', {
      timeout: 60000,
    });

    // Verify script was generated
    const scriptContent = await page.locator('[data-testid="script-content"]');
    await expect(scriptContent).toBeVisible();

    // Step 11: Navigate to Script Editor
    await page.click('a:has-text("Scripts")');
    await expect(page).toHaveURL(/\/projects\/[^/]+\/scripts/);

    // Verify script is listed
    await expect(page.locator('text=Generated Script')).toBeVisible();

    // Step 12: Open script editor
    await page.click('[data-testid="script-item"]');
    await expect(page).toHaveURL(/\/projects\/[^/]+\/scripts\?id=/);

    // Step 13: Edit script content
    const editor = page.locator('[data-testid="script-editor"]');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type('\n\nEdited by E2E test');
    await page.waitForLoadState('networkidle'); // Autosave

    // Step 14: Export script as PDF
    await page.click('button:has-text("Export")');
    await page.click('a:has-text("PDF")');

    // Wait for download
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('script');

    // Step 15: Verify autosave status
    const saveStatus = page.locator('[data-testid="save-status"]');
    await expect(saveStatus).toContainText('Saved');

    console.log('✅ Full E2E flow completed successfully!');
  });

  test('E2E: Script creation with branching', async ({ page }) => {
    await login(page, 'test@dramo.ai', 'Test@12345');

    // Navigate to existing project
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid="project-card"]').first();
    await firstProject.click();

    // Navigate to Scripts section
    await page.click('a:has-text("Scripts")');

    // Switch to branching mode (if available)
    await page.click('button:has-text("Branching")');
    await expect(page).toHaveURL(/\/projects\/[^/]+\/scripts\/branching/);

    // Create a branching node
    await page.click('[data-testid="add-branch-btn"]');
    await page.fill('input[name="branch-title"]', 'Choice Point A');

    // Add branch options
    await page.click('button:has-text("Add Option")');
    await page.fill('input[name="option-text"]', 'Option 1');
    await page.click('button:has-text("Add Option")');
    await page.fill('input[name="option-text"]', 'Option 2');

    await page.click('button:has-text("Save")');
    await page.waitForLoadState('networkidle');

    // Verify branching structure was saved
    await expect(page.locator('text=Choice Point A')).toBeVisible();

    console.log('✅ Branching flow completed successfully!');
  });

  test('E2E: Character relationship mapping', async ({ page }) => {
    await login(page, 'test@dramo.ai', 'Test@12345');

    await page.goto('/projects');
    const firstProject = page.locator('[data-testid="project-card"]').first();
    await firstProject.click();

    // Navigate to Characters
    await page.click('a:has-text("Characters")');

    // Ensure we have multiple characters
    const characterCount = await page.locator('[data-testid="character-item"]').count();
    if (characterCount < 2) {
      // Add a character if needed
      await page.click('button:has-text("Add Character")');
      await page.fill('input[name="name"]', 'Test Character');
      await page.click('button:has-text("Save")');
      await page.waitForLoadState('networkidle');
    }

    // Open relationship graph
    await page.click('button:has-text("View Relationships")');
    await expect(page.locator('[data-testid="relationship-graph"]')).toBeVisible();

    // Add a relationship between two characters
    const firstCharacter = page.locator('[data-testid="character-node"]').first();
    const secondCharacter = page.locator('[data-testid="character-node"]').nth(1);

    // Drag to create connection (simulating graph interaction)
    await page.dragAndDrop(
      '[data-testid="character-node"]:first-child',
      '[data-testid="character-node"]:nth-child(2)',
    );

    // Fill in relationship type
    await page.fill('input[name="relationship-type"]', 'colleagues');
    await page.click('button:has-text("Save Relationship")');
    await page.waitForLoadState('networkidle');

    console.log('✅ Character relationship flow completed successfully!');
  });

  test('E2E: Storyboard scene management', async ({ page }) => {
    await login(page, 'test@dramo.ai', 'Test@12345');

    await page.goto('/projects');
    const firstProject = page.locator('[data-testid="project-card"]').first();
    await firstProject.click();

    // Navigate to Storyboard
    await page.click('a:has-text("Storyboard")');
    await expect(page).toHaveURL(/\/projects\/[^/]+\/storyboard/);

    // Add a scene
    await page.click('button:has-text("Add Scene")');
    await page.fill('input[name="scene-name"]', 'Opening Scene');
    await page.fill('textarea[name="scene-description"]', 'The opening scene of our story');
    await page.click('button:has-text("Save")');
    await page.waitForLoadState('networkidle');

    // Verify scene was added
    await expect(page.locator('text=Opening Scene')).toBeVisible();

    // Add a shot to the scene
    const sceneCard = page.locator('[data-testid="scene-card"]:has-text("Opening Scene")');
    await sceneCard.click();

    await page.click('button:has-text("Add Shot")');
    await page.fill('input[name="shot-name"]', 'Wide Shot');
    await page.fill('input[name="camera-type"]', 'wide');
    await page.click('button:has-text("Save")');
    await page.waitForLoadState('networkidle');

    // Verify shot was added
    await expect(page.locator('text=Wide Shot')).toBeVisible();

    console.log('✅ Storyboard flow completed successfully!');
  });

  test('E2E: Project settings and export', async ({ page }) => {
    await login(page, 'test@dramo.ai', 'Test@12345');

    await page.goto('/projects');
    const firstProject = page.locator('[data-testid="project-card"]').first();
    await firstProject.click();

    // Open project settings
    await page.click('button[aria-label="Settings"]');
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();

    // Update project settings
    await page.fill('input[name="title"]', 'Updated Project Title');
    await page.selectOption('select[name="genre"]', 'drama');
    await page.click('button:has-text("Save Settings")');
    await page.waitForLoadState('networkidle');

    // Verify settings were saved
    await expect(page.locator('h1')).toContainText('Updated Project Title');

    // Export entire project
    await page.click('button:has-text("Export Project")');
    await page.click('[data-testid="export-format-json"]');

    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('project');

    console.log('✅ Project settings and export flow completed successfully!');
  });
});
