# Dramo E2E Tests with Playwright

This directory contains end-to-end (E2E) tests for the Dramo application using [Playwright](https://playwright.dev).

## Setup

### Prerequisites
- Node.js 20+
- Dramo application running locally (or ready to start)

### Installation

Playwright is already installed in `devDependencies`. The browsers are installed automatically on first run.

To manually install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

### Quick Start

```bash
# Start all services and run E2E tests
npm run e2e

# Or with UI mode (interactive)
npm run e2e:ui

# Or with debugging
npm run e2e:debug
```

### Run Tests with Browser Visible

```bash
npm run e2e:headed
```

### Run Tests for Specific Browser

```bash
npm run e2e:chromium   # Chrome/Edge
npm run e2e:firefox    # Firefox
npm run e2e:webkit     # Safari
```

### Run Specific Test File

```bash
npx playwright test e2e/full-flow.spec.ts
npx playwright test e2e/complete-journey.spec.ts
```

### Run Tests with Pattern

```bash
# Run only tests matching a pattern
npx playwright test --grep "Create project"
npx playwright test --grep "script"
```

## Test Files

### `full-flow.spec.ts`
Core E2E flow tests covering:
- ✅ Full workflow: Login → Create Project → Add Characters → Generate Script → Export
- ✅ Branching dialogue creation
- ✅ Character relationship mapping
- ✅ Storyboard scene management
- ✅ Project settings and export

### `complete-journey.spec.ts`
User journey tests including:
- ✅ Complete script project creation from scratch
- ✅ Branching dialogue options
- ✅ Multiple project management
- ✅ Script generation and AI refinement
- ✅ Data validation and error handling
- ✅ Responsive design testing

### `helpers.ts`
Reusable helper functions:
- Authentication: `login()`, `logout()`
- Project management: `createProject()`, `navigateToProject()`
- Characters: `addCharacter()`, `deleteCharacter()`
- Locations: `addLocation()`
- Scripts: `generateScript()`, `editScriptContent()`, `exportScript()`
- Navigation: `navigateToSection()`
- Assertions: `expectElementToBeVisible()`, `expectElementToContainText()`
- Waits: `waitForSave()`

## Configuration

### `playwright.config.ts`

Key settings:
- **baseURL**: `http://localhost:12323` (Frontend)
- **timeout**: 30 seconds per test
- **expect timeout**: 5 seconds for assertions
- **workers**: 1 (sequential execution to avoid conflicts)
- **projects**: Chromium, Firefox, WebKit

Adjust `webServer` command if needed:
```typescript
webServer: {
  command: 'npm run dev',  // Starts all services
  url: 'http://localhost:12323',
  reuseExistingServer: !process.env.CI,
}
```

## Common Issues & Solutions

### "Target page, context or browser has been closed"
- Ensure the app is running: `npm run dev`
- Check that port 12323 is accessible
- Try: `npx playwright test --project=chromium --headed`

### Tests timeout
- Increase timeout in `playwright.config.ts`:
  ```typescript
  timeout: 60000,  // 60 seconds
  expect: { timeout: 10000 }  // 10 seconds
  ```

### Cannot find element
- Use `--headed` flag to see what's happening
- Check element selectors match your UI structure
- Use Playwright Inspector: `npm run e2e:debug`

### Port already in use
- Kill the port: `lsof -ti:12323 | xargs kill -9`
- Or choose a different port in `playwright.config.ts`

## Debugging

### Interactive UI Mode
```bash
npm run e2e:ui
```
Visual interface to run tests, see execution, step through

### Debug Mode
```bash
npm run e2e:debug
```
Opens Playwright Inspector with breakpoints

### See Browser Actions
```bash
npm run e2e:headed
```
Browser remains visible during test execution

### Capture Screenshots/Videos
Tests automatically capture:
- Screenshots: on test failure
- Videos: on test failure
- Traces: on first retry

Find artifacts in `test-results/` directory

## Updating Tests

### Adding New Test
1. Create new `.spec.ts` file in `e2e/` directory
2. Import helpers from `helpers.ts`
3. Use Playwright test syntax:

```typescript
import { test, expect } from '@playwright/test';
import { login, addCharacter } from './helpers';

test('My new test', async ({ page }) => {
  await login(page);
  await addCharacter(page, 'Test Character');
  await expect(page.locator('text=Test Character')).toBeVisible();
});
```

### Fixing Selector Issues

Use Playwright Inspector to find correct selectors:
```bash
npx playwright codegen http://localhost:12323
```

This opens a recording interface where you can click elements and it generates selector code.

## CI/CD Integration

For GitHub Actions:
```yaml
- name: Run E2E tests
  run: npm run e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Test Data

Tests use mock data from the MSW setup in the main application. For real API testing:

1. Ensure backend is running: `npm run dev:server`
2. Update `.env` files with test credentials
3. Modify helpers to use real test accounts

## Performance Tips

- Run tests in parallel (change `workers: 1` if stable):
  ```typescript
  workers: process.env.CI ? 1 : 4,
  ```

- Skip UI rendering for faster headless tests:
  ```bash
  npx playwright test --project=chromium
  ```

- Use test.only() for focused testing:
  ```typescript
  test.only('my test', async ({ page }) => { ... })
  ```

## Advanced Topics

### Custom Fixtures
Create reusable test setup in `playwright.config.ts`:
```typescript
export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await login(page);
    await use(page);
    await logout(page);
  },
});
```

### Mock API Responses
Playwright can intercept and mock network requests:
```typescript
await page.route('**/api/projects', route => {
  route.abort();
});
```

### Visual Regression Testing
Compare screenshots between runs:
```typescript
await expect(page).toHaveScreenshot();
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Dramo API Documentation](../docs/)
- [Next.js Testing Guide](https://nextjs.org/docs/testing)

## Support

For issues or questions:
1. Check test output: `npm run e2e`
2. Run in debug mode: `npm run e2e:debug`
3. Check Playwright logs: `DEBUG=pw:api npm run e2e`
4. Review test code and selectors
5. Check if backend APIs are responding correctly

---

**Last Updated**: 2026-03-31
**Playwright Version**: Latest (@playwright/test)
