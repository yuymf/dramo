## Playwright E2E Testing - Troubleshooting Guide

### Common Issues & Solutions

#### 🔴 Issue: "Target page, context or browser has been closed"

**Cause**: Browser/page closed unexpectedly, or app not running

**Solutions**:
```bash
# Ensure app is running
npm run dev

# Kill any existing processes on port 12323
lsof -ti:12323 | xargs kill -9

# Run tests with visible browser to see what's happening
npm run e2e:headed

# Check if app starts correctly
curl http://localhost:12323
```

---

#### 🔴 Issue: Tests timeout at 30000ms

**Cause**: Slow network, missing backend, or long operations

**Solutions**:
```typescript
// Increase timeout in playwright.config.ts
timeout: 60000,  // 60 seconds
expect: { timeout: 10000 }  // 10 seconds for assertions
```

Or for specific test:
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000);  // 60 seconds
  // test code
});
```

---

#### 🔴 Issue: "Element not found" or "Element not visible"

**Cause**: Selector mismatch, element not loaded, wrong page state

**Solutions**:
```bash
# 1. Use debug mode to inspect elements
npm run e2e:debug

# 2. Record interactions to generate correct selectors
npx playwright codegen http://localhost:12323

# 3. Run with visible browser
npm run e2e:headed

# 4. Check if element is in the right place
npx playwright test e2e/full-flow.spec.ts --headed --headed
```

Update selector in test:
```typescript
// ❌ Wrong selector
await page.click('button:has-text("Save")');

// ✅ Correct selector (use debug to find)
await page.click('button[data-testid="save-button"]');
```

---

#### 🔴 Issue: "Page.click() target element is hidden"

**Cause**: Element exists but is not visible (display: none, opacity: 0, etc.)

**Solutions**:
```typescript
// Wait for element to be visible first
await page.locator('button[name="submit"]').waitFor({ state: 'visible' });
await page.click('button[name="submit"]');

// Or use force click (not recommended)
await page.click('button[name="submit"]', { force: true });

// Or scroll into view
await page.locator('button[name="submit"]').scrollIntoViewIfNeeded();
await page.click('button[name="submit"]');
```

---

#### 🔴 Issue: Tests fail inconsistently (flaky tests)

**Cause**: Race conditions, timing issues, or server delays

**Solutions**:
```typescript
// ❌ Bad: Fixed waits
await page.waitForTimeout(1000);  // Unpredictable

// ✅ Good: Wait for specific conditions
await page.waitForLoadState('networkidle');  // Wait for network
await page.waitForURL('/projects');  // Wait for URL change
await expect(page.locator('text=Success')).toBeVisible();  // Wait for element

// ✅ Better: Wait for specific element with timeout
await page.waitForSelector('[data-testid="save-status"]', {
  timeout: 5000
});
```

---

#### 🔴 Issue: "Element is detached from the DOM"

**Cause**: Page reloaded or DOM changed while holding element reference

**Solutions**:
```typescript
// ❌ Bad: Storing element reference
const button = page.locator('button[name="save"]');
await page.waitForTimeout(1000);  // Page might change
await button.click();  // Element might be detached

// ✅ Good: Use locator each time
await page.locator('button[name="save"]').click();

// Or re-query after navigation
await page.goto('/path');
await page.waitForLoadState('networkidle');
const button = page.locator('button[name="save"]');
await button.click();
```

---

#### 🔴 Issue: Login fails, can't access protected pages

**Cause**: Wrong credentials, auth not working, session not persisted

**Solutions**:
```bash
# Check if login endpoint is accessible
curl -X POST http://localhost:12321/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@dramo.ai","password":"Test@12345"}'

# Run login test in debug mode
npm run e2e:debug
# Then navigate to login test to see what's happening
```

Update credentials in `helpers.ts`:
```typescript
export async function login(
  page: Page,
  email: string = 'your-test-email@example.com',  // Update
  password: string = 'your-test-password',  // Update
) { ... }
```

---

#### 🔴 Issue: File download not captured

**Cause**: Download event not properly awaited

**Solutions**:
```typescript
// ✅ Correct way to handle downloads
const downloadPromise = page.waitForEvent('download');
await page.click('button:has-text("Export")');
const download = await downloadPromise;

// Verify filename
expect(download.suggestedFilename()).toContain('export');

// Or access the file
const path = await download.path();
```

---

#### 🔴 Issue: Port already in use

**Cause**: Previous process still running on port 12323

**Solutions**:
```bash
# Kill process on port
lsof -ti:12323 | xargs kill -9

# Or use different port (update playwright.config.ts)
webServer: {
  command: 'npm run dev -- -p 12324',  // Different port
  url: 'http://localhost:12324',
}
```

---

#### 🔴 Issue: "Playwright: no element matches the selector"

**Cause**: Element doesn't exist on page

**Solutions**:
```bash
# 1. Use codegen to find correct selector
npx playwright codegen http://localhost:12323
# Click the element you want, it generates the selector

# 2. Run in debug mode
npm run e2e:debug

# 3. Check DOM structure
npx playwright test e2e/full-flow.spec.ts --headed
# Open DevTools with F12
```

Verify selector before using:
```typescript
// Check if element exists
const exists = await page.locator('your-selector').count() > 0;
if (!exists) {
  // Take screenshot to debug
  await page.screenshot({ path: 'debug.png' });
}
```

---

#### 🔴 Issue: Tests pass locally but fail in CI/CD

**Cause**: Environment differences, timing, missing dependencies

**Solutions**:
```yaml
# In .github/workflows/e2e-tests.yml
- name: Setup
  run: |
    npm ci  # Clean install
    npx playwright install --with-deps  # Install browsers

- name: Test
  run: npm run e2e
  env:
    CI: true  # Disables reuse of server
    DEBUG: pw:api  # Enable debugging
```

Or run tests with retries:
```bash
npx playwright test --retries 2
```

---

#### 🔴 Issue: "waitForLoadState('networkidle') timeout"

**Cause**: Network requests still pending, long-running operations

**Solutions**:
```typescript
// ❌ Too strict
await page.waitForLoadState('networkidle');  // Waits for ALL network to be idle

// ✅ Better: Be specific
await page.waitForLoadState('domcontentloaded');  // Page loaded
await page.waitForSelector('[data-testid="content"]');  // Wait for specific element

// Or with timeout
await page.waitForLoadState('networkidle', { timeout: 10000 });
```

---

### 🔧 Debug Mode Commands

```bash
# Start debug mode
npm run e2e:debug

# In debug mode, use these shortcuts:
# Step over (F10)
# Step into (F11)
# Step out (Shift+F11)
# Continue (F8)
```

---

### 📊 Useful Debugging Scripts

```typescript
// In your test, add these to help debug

// 1. Take screenshot
await page.screenshot({ path: `debug-${Date.now()}.png` });

// 2. Log page content
console.log(await page.content());

// 3. Get all elements matching selector
const elements = await page.locator('button').all();
console.log(`Found ${elements.length} buttons`);

// 4. Evaluate JavaScript on page
const result = await page.evaluate(() => {
  return document.querySelectorAll('button').length;
});
console.log(`Total buttons: ${result}`);

// 5. Get page URL
console.log(`Current URL: ${page.url()}`);

// 6. Wait and log network requests
page.on('request', request =>
  console.log('Request:', request.url())
);
```

---

### 🎬 Recording Tests

```bash
# Record test by clicking on page
npx playwright codegen http://localhost:12323

# Then copy generated code into your test file
```

---

### 🎯 Performance Profiling

```typescript
test('measure performance', async ({ page }) => {
  const start = Date.now();

  await page.goto('/projects');

  const duration = Date.now() - start;
  console.log(`Page load took ${duration}ms`);

  expect(duration).toBeLessThan(3000);  // Less than 3 seconds
});
```

---

### 📋 Checklist Before Submitting PR

- [ ] All tests pass locally: `npm run e2e`
- [ ] Tests pass in UI mode: `npm run e2e:ui`
- [ ] No hardcoded waits (fixed timeouts)
- [ ] All selectors are specific (use `[data-testid]` when possible)
- [ ] Tests work in headed mode: `npm run e2e:headed`
- [ ] Tests pass in debug mode: `npm run e2e:debug`
- [ ] No flaky assertions (use `waitFor` helpers)
- [ ] Screenshots/videos only on failure

---

### 📞 Getting Help

1. Check this troubleshooting guide
2. Run in debug mode: `npm run e2e:debug`
3. Generate selectors: `npx playwright codegen`
4. Read Playwright docs: https://playwright.dev/docs/troubleshooting
5. Check GitHub Issues: https://github.com/microsoft/playwright/issues
6. Enable verbose logging: `DEBUG=pw:api npm run e2e`

---

Last Updated: 2026-03-31
