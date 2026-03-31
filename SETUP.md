# 🎭 Dramo Playwright E2E Testing Setup Complete

## What's Been Set Up

I've configured a complete **Playwright E2E (End-to-End) testing framework** for your Dramo application with comprehensive test coverage for the full user workflow.

### 📦 Installation

**Playwright** is already installed in `package.json`:
```json
"@playwright/test": "^1.58.2"
```

## 📁 New Files Created

### Configuration
- **`playwright.config.ts`** - Main Playwright configuration
  - Targets: http://localhost:12323 (Frontend)
  - Browsers: Chrome, Firefox, Safari
  - Auto-starts dev server

- **`.github/workflows/e2e-tests.yml`** - CI/CD workflow for GitHub Actions
  - Runs on every push/PR
  - Tests across all browsers
  - Uploads reports and videos

### Test Files (in `e2e/` directory)

1. **`full-flow.spec.ts`** - Core E2E tests (~200 lines)
   - ✅ Login & Project Creation
   - ✅ Character Management
   - ✅ Location Management
   - ✅ Script Generation with AI
   - ✅ Script Editing & Export
   - ✅ Branching Dialogue
   - ✅ Character Relationships
   - ✅ Storyboard Management
   - ✅ Project Settings & Export

2. **`complete-journey.spec.ts`** - User journey scenarios (~300 lines)
   - ✅ Create script from scratch (full workflow)
   - ✅ Interactive branching dialogue
   - ✅ Multiple project management
   - ✅ AI-powered script refinement
   - ✅ Data validation & error handling
   - ✅ Responsive design (mobile/tablet)

3. **`api-integration.spec.ts`** - API contract & integration tests (~200 lines)
   - ✅ API error handling
   - ✅ Network request timing
   - ✅ Concurrent API calls
   - ✅ Response data validation
   - ✅ Pagination handling
   - ✅ Cache behavior
   - ✅ Error recovery & retry logic
   - ✅ Authentication token refresh
   - ✅ Form submission validation

4. **`helpers.ts`** - Reusable test utilities (~150 lines)
   - Authentication: `login()`, `logout()`
   - Projects: `createProject()`, `navigateToProject()`
   - Characters: `addCharacter()`, `deleteCharacter()`
   - Locations: `addLocation()`
   - Scripts: `generateScript()`, `editScriptContent()`, `exportScript()`
   - Navigation & Assertions

### Documentation
- **`e2e/README.md`** - Comprehensive testing guide with examples
- **`e2e-run.sh`** - Convenient shell script for running tests
- **`SETUP.md`** (this file) - Setup documentation

## 🚀 Quick Start

### Run All Tests
```bash
npm run e2e
```

### Run Tests (Interactive UI)
```bash
npm run e2e:ui
```

### Run Tests with Browser Visible
```bash
npm run e2e:headed
```

### Run Specific Test File
```bash
npx playwright test e2e/full-flow.spec.ts
```

### Run Tests for Specific Browser
```bash
npm run e2e:chromium   # Chrome/Edge
npm run e2e:firefox    # Firefox
npm run e2e:webkit     # Safari
```

### Using the Shell Script
```bash
./e2e-run.sh all          # Run all tests
./e2e-run.sh ui           # Interactive UI mode
./e2e-run.sh debug        # Debug mode with inspector
./e2e-run.sh full-flow    # Run specific test file
./e2e-run.sh pattern "script"  # Run tests matching pattern
./e2e-run.sh report       # Open last test report
```

## 📊 Test Coverage

The test suite covers:

### User Flows
- ✅ Authentication (Login/Logout)
- ✅ Project Management (Create, View, Update)
- ✅ Content Creation (Characters, Locations, Scripts)
- ✅ AI Integration (Script Generation with AI)
- ✅ Content Editing (Script Editor with Auto-save)
- ✅ Export Functionality (PDF, DOCX, JSON)
- ✅ Branching & Interactivity
- ✅ Multi-project Management

### API Testing
- ✅ Request/Response validation
- ✅ Error handling & recovery
- ✅ Network timing
- ✅ Authentication flows
- ✅ Concurrent operations

### UI/UX Testing
- ✅ Form validation
- ✅ Navigation
- ✅ Element visibility
- ✅ Responsive design (mobile, tablet, desktop)

## 🛠 Development Workflow

### 1. Write Tests First
```bash
npm run e2e:ui
# Use the UI to create tests interactively
```

### 2. Generate Selectors
```bash
npx playwright codegen http://localhost:12323
# Records your interactions and generates test code
```

### 3. Debug Tests
```bash
npm run e2e:debug
# Opens Playwright Inspector for step-by-step debugging
```

### 4. Check Results
```bash
npx playwright show-report
# View detailed test report with screenshots/videos
```

## 📝 Common Commands

| Command | Description |
|---------|-------------|
| `npm run e2e` | Run all tests (headless) |
| `npm run e2e:ui` | Interactive UI mode |
| `npm run e2e:debug` | Debug with Playwright Inspector |
| `npm run e2e:headed` | Run with visible browser |
| `npm run e2e:chromium` | Test only in Chrome |
| `npm run e2e:firefox` | Test only in Firefox |
| `npm run e2e:webkit` | Test only in Safari |
| `npx playwright test --grep "pattern"` | Run tests matching pattern |
| `npx playwright codegen http://localhost:12323` | Record test code |
| `npx playwright show-report` | View test report |

## 🎯 Test Structure

Each test follows this pattern:

```typescript
import { test, expect } from '@playwright/test';
import { login, addCharacter } from './helpers';

test.describe('Feature Group', () => {
  test('should do something specific', async ({ page }) => {
    // 1. Setup (login, navigate)
    await login(page);

    // 2. Action (user interaction)
    await addCharacter(page, 'Alice');

    // 3. Assert (verify result)
    await expect(page.locator('text=Alice')).toBeVisible();
  });
});
```

## 🔍 Debugging Tips

### Tests Won't Run?
1. Ensure app is running: `npm run dev`
2. Check port 12323 is free
3. Run with heads: `npm run e2e:headed`

### Can't Find Element?
1. Use: `npm run e2e:debug`
2. Or: `npx playwright codegen http://localhost:12323`
3. Inspect element selectors in test

### Tests Too Slow?
1. Check network tab in debug mode
2. Verify backend APIs responding
3. Increase timeout: `test.setTimeout(60000)`

## 🚀 CI/CD Integration

Tests run automatically on:
- ✅ Push to main/develop
- ✅ Pull request creation
- ✅ Manual workflow dispatch

View results:
1. Go to GitHub Actions tab
2. Click on E2E Tests workflow
3. View report or download artifacts

## 📚 Next Steps

1. **Run the tests**:
   ```bash
   npm run e2e:ui
   ```

2. **Update element selectors** if your UI differs
   - Use `npm run e2e:debug` to identify correct selectors
   - Update test files with actual element identifiers

3. **Customize test data** as needed:
   - Update `helpers.ts` for your API structure
   - Adjust timeouts for slower backends
   - Add test account credentials

4. **Add more tests** following the existing patterns:
   - Copy test template from existing files
   - Use helpers for common operations
   - Keep tests focused and independent

5. **Set up CI/CD** secrets (if needed):
   - GitHub Actions workflow ready in `.github/workflows/e2e-tests.yml`
   - Add any required environment variables

## 📖 Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Guide](https://playwright.dev/docs/ci)

## 💡 Pro Tips

1. **Use `--headed` mode** while developing tests to see what's happening
2. **Keep tests focused** - one scenario per test
3. **Use page helpers** - reduces test code duplication
4. **Run in UI mode** (`npm run e2e:ui`) to develop interactively
5. **Record tests** with codegen for complex interactions
6. **Check test reports** - screenshots/videos help debug failures
7. **Parallel execution** - set `workers: 4` when tests are stable

## ⚙️ Configuration Notes

### Playwright Config (`playwright.config.ts`)
- **baseURL**: http://localhost:12323
- **timeout**: 30 seconds
- **workers**: 1 (sequential to avoid conflicts)
- **trace**: on-first-retry (captures traces for failed tests)
- **screenshots**: only-on-failure
- **videos**: retain-on-failure

Adjust these based on your needs:
```typescript
timeout: 60000,           // Increase if tests are slow
workers: process.env.CI ? 1 : 4,  // Parallel execution
```

### Test Data

Tests currently assume:
- Test user: `test@dramo.ai` / `Test@12345`
- Backend running on port 12321
- Frontend on port 12323

Update in `helpers.ts` if different.

---

## 📞 Support

For issues:
1. Check `e2e/README.md` for troubleshooting
2. Review test output and error messages
3. Run in debug mode: `npm run e2e:debug`
4. Check Playwright docs: https://playwright.dev

**Last Updated**: 2026-03-31
**Playwright Version**: ^1.58.2

