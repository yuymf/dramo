import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for the chat system fixes.
 * Uses a known test project ID obtained after login.
 */

const TEST_PROJECT_ID = 'cmnao4tu9000166e5qg59gno4';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input#email', 'demo@example.com');
  await page.fill('input#password', 'demo123456');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(home|projects)/, { timeout: 10000 });
}

test.describe('Chat System E2E', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Chat reset endpoint proxies to backend (not a stub)', async ({ page }) => {
    const response = await page.request.post(`/api/chat/${TEST_PROJECT_ID}/reset`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });

    const status = response.status();
    // Should be 200 (success with real backend), NOT just a fake stub response
    expect(status).toBe(200);

    const body = await response.json();
    expect(body.reset).toBe(true);
    expect(body.projectId).toBe(TEST_PROJECT_ID);
  });

  test('Chat sessions CRUD lifecycle', async ({ page }) => {
    // 1. List sessions
    const listRes = await page.request.get(`/api/chat/${TEST_PROJECT_ID}/sessions`);
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    expect(Array.isArray(listBody.data)).toBe(true);

    // 2. Create session
    const createRes = await page.request.post(`/api/chat/${TEST_PROJECT_ID}/sessions`, {
      headers: { 'Content-Type': 'application/json' },
      data: { title: 'E2E Test Session' },
    });
    expect(createRes.status()).toBe(201);
    const createBody = await createRes.json();
    const sessionId = createBody.data.id;
    expect(createBody.data.title).toBe('E2E Test Session');

    // 3. Rename session
    const renameRes = await page.request.patch(
      `/api/chat/${TEST_PROJECT_ID}/sessions/${sessionId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        data: { title: 'Renamed E2E Session' },
      }
    );
    expect(renameRes.status()).toBe(200);
    const renameBody = await renameRes.json();
    expect(renameBody.data.title).toBe('Renamed E2E Session');

    // 4. Verify in list
    const list2Res = await page.request.get(`/api/chat/${TEST_PROJECT_ID}/sessions`);
    const list2Body = await list2Res.json();
    const found = list2Body.data.find((s: { id: string }) => s.id === sessionId);
    expect(found).toBeTruthy();
    expect(found.title).toBe('Renamed E2E Session');

    // 5. Delete
    const deleteRes = await page.request.delete(
      `/api/chat/${TEST_PROJECT_ID}/sessions/${sessionId}`
    );
    expect(deleteRes.status()).toBe(200);

    // 6. Verify gone
    const list3Res = await page.request.get(`/api/chat/${TEST_PROJECT_ID}/sessions`);
    const list3Body = await list3Res.json();
    const gone = list3Body.data.find((s: { id: string }) => s.id === sessionId);
    expect(gone).toBeUndefined();
  });

  test('Chat messages support sessionId filtering', async ({ page }) => {
    // Create a fresh session
    const createRes = await page.request.post(`/api/chat/${TEST_PROJECT_ID}/sessions`, {
      headers: { 'Content-Type': 'application/json' },
      data: { title: 'Filter Test' },
    });
    expect(createRes.status()).toBe(201);
    const sessionId = (await createRes.json()).data.id;

    // Get messages with this fresh sessionId — should be empty
    const filteredRes = await page.request.get(
      `/api/chat/${TEST_PROJECT_ID}/messages?sessionId=${sessionId}`
    );
    expect(filteredRes.status()).toBe(200);
    const filtered = await filteredRes.json();
    expect(filtered.data).toHaveLength(0);

    // Cleanup
    await page.request.delete(`/api/chat/${TEST_PROJECT_ID}/sessions/${sessionId}`);
  });

  test('Legacy message migration endpoint works', async ({ page }) => {
    const migrateRes = await page.request.post(
      `/api/chat/${TEST_PROJECT_ID}/sessions/migrate-legacy`,
      {
        headers: { 'Content-Type': 'application/json' },
        data: {},
      }
    );

    expect(migrateRes.status()).toBe(200);
    const body = await migrateRes.json();
    expect(body).toHaveProperty('migrated');
    expect(typeof body.migrated).toBe('number');
  });

  test('Chat panel UI loads with AI assistant header and new-session button', async ({ page }) => {
    await page.goto(`/projects/${TEST_PROJECT_ID}/scripts`);
    await page.waitForLoadState('networkidle');

    // The chat panel should have the AI assistant header
    const chatHeader = page.locator('text=AI 助手');
    await expect(chatHeader).toBeVisible({ timeout: 10000 });

    // Should have the new chat button (MessageSquarePlus icon)
    const newChatBtn = page.locator('[title="新对话"]');
    await expect(newChatBtn).toBeVisible({ timeout: 5000 });
  });

  test('Chat panel shows empty state with suggestion chips after reset', async ({ page }) => {
    // Reset chat to ensure empty state
    await page.request.post(`/api/chat/${TEST_PROJECT_ID}/reset`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });

    await page.goto(`/projects/${TEST_PROJECT_ID}/scripts`);
    await page.waitForLoadState('networkidle');

    // Look for the suggestion chips in the empty state
    const suggestion = page.locator('button:has-text("帮我写一个美食探店直播台本")');
    await expect(suggestion).toBeVisible({ timeout: 10000 });

    // Clicking a suggestion should fill the input
    await suggestion.click();

    const textarea = page.locator('textarea[placeholder*="输入消息"]');
    const value = await textarea.inputValue();
    expect(value).toContain('帮我写一个美食探店直播台本');
  });

  test('Session sidebar expand/collapse toggles', async ({ page }) => {
    await page.goto(`/projects/${TEST_PROJECT_ID}/scripts`);
    await page.waitForLoadState('networkidle');

    // The sidebar starts collapsed — look for the expand button
    const expandBtn = page.locator('[title="展开对话列表"]');
    await expect(expandBtn).toBeVisible({ timeout: 10000 });

    await expandBtn.click();

    // After expanding, should see the "对话列表" header
    const sidebarHeader = page.locator('text=对话列表');
    await expect(sidebarHeader).toBeVisible({ timeout: 3000 });
  });
});
