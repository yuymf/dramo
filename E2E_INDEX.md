# 🎭 Dramo Playwright E2E Testing - Complete Index

## 📋 Setup Complete ✅

Everything is configured and ready to use. No additional setup needed!

---

## 🚀 Get Started in 30 Seconds

```bash
# 1. Start the development server
npm run dev

# 2. In another terminal, run tests
npm run e2e:ui
```

That's it! The interactive UI will open showing all your tests.

---

## 📁 Directory Structure

```
dramo/
├── playwright.config.ts          # Main Playwright configuration
├── e2e/                          # E2E test directory
│   ├── full-flow.spec.ts         # Core workflow tests (200 lines)
│   ├── complete-journey.spec.ts  # User journey tests (300 lines)
│   ├── api-integration.spec.ts   # API integration tests (200 lines)
│   ├── helpers.ts                # Reusable test utilities (150 lines)
│   ├── README.md                 # Comprehensive test guide
│   └── TROUBLESHOOTING.md        # Common issues & fixes
├── .github/
│   └── workflows/
│       └── e2e-tests.yml         # GitHub Actions CI/CD
├── e2e-run.sh                    # Convenient shell script
├── SETUP.md                      # Detailed setup guide
└── E2E_SETUP_SUMMARY.txt        # Quick reference

750+ lines of comprehensive tests covering full user workflows
```

---

## 🎯 Available Commands

### Run Tests

| Command | Description |
|---------|-------------|
| `npm run e2e` | Run all tests (headless) |
| `npm run e2e:ui` | **Interactive UI mode (recommended)** |
| `npm run e2e:debug` | Debug mode with step-through |
| `npm run e2e:headed` | Run with visible browser |
| `npm run e2e:chromium` | Chrome/Edge only |
| `npm run e2e:firefox` | Firefox only |
| `npm run e2e:webkit` | Safari only |

### Using Shell Script

```bash
./e2e-run.sh ui           # Interactive mode
./e2e-run.sh all          # All tests
./e2e-run.sh debug        # Debug mode
./e2e-run.sh headed       # Visible browser
./e2e-run.sh full-flow    # Specific test file
./e2e-run.sh pattern "text"  # Pattern matching
./e2e-run.sh codegen      # Record tests
./e2e-run.sh report       # View last report
```

### Specific Tests

```bash
# Run single test file
npx playwright test e2e/full-flow.spec.ts

# Run tests matching pattern
npx playwright test --grep "Create project"

# Record new tests
npx playwright codegen http://localhost:12323

# View test report
npx playwright show-report
```

---

## 📚 Documentation Files

### 1. **SETUP.md** (This File)
- Quick start guide
- Complete setup verification
- Development workflow
- Configuration overview

### 2. **e2e/README.md** (Comprehensive Guide)
- How to run tests
- Test file descriptions
- Configuration details
- Common issues & solutions
- Performance tips
- Advanced topics

### 3. **e2e/TROUBLESHOOTING.md** (Problem Solving)
- Common issues with solutions
- Debug commands
- Performance profiling
- Debugging tips
- Checklist before PR

### 4. **E2E_SETUP_SUMMARY.txt** (Quick Reference)
- Visual summary
- All commands at a glance
- Key features
- Next steps

---

## 🧪 Test Files Overview

### `e2e/full-flow.spec.ts` (200 lines)

**Core E2E flow tests covering complete workflows:**

- ✅ **E2E: Create project, add characters, generate script**
  - Login → Create Project → Add Characters → Add Locations
  - Generate Script → Edit Script → Export PDF

- ✅ **E2E: Script creation with branching**
  - Create branching dialogue options
  - Test interactive script structure

- ✅ **E2E: Character relationship mapping**
  - View relationships graph
  - Create character connections

- ✅ **E2E: Storyboard scene management**
  - Add scenes and shots
  - Manage storyboard details

- ✅ **E2E: Project settings and export**
  - Update project settings
  - Export project as JSON

### `e2e/complete-journey.spec.ts` (300 lines)

**Real-world user journey scenarios:**

- ✅ **User creates a complete script project from scratch**
  - Full workflow from start to finish
  - Tests all major features

- ✅ **User collaborates using branching dialogue options**
  - Interactive script creation
  - Branching structure

- ✅ **User manages multiple projects and switches between them**
  - Create multiple projects
  - Navigate between projects

- ✅ **User generates and refines script with AI suggestions**
  - Script generation
  - AI refinement flow

- ✅ **User performs data validation and error handling**
  - Form validation
  - Error messages

- ✅ **Responsive design: Mobile and tablet views**
  - Mobile viewport (375x667)
  - Tablet viewport (768x1024)
  - Desktop viewport

### `e2e/api-integration.spec.ts` (200 lines)

**API contract and integration testing:**

- ✅ API error handling
- ✅ Network request timing
- ✅ Concurrent API calls
- ✅ Response data structure validation
- ✅ Pagination handling
- ✅ Cache behavior
- ✅ Error recovery & retry logic
- ✅ Authentication token refresh
- ✅ Form submission validation

### `e2e/helpers.ts` (150 lines)

**Reusable test utilities:**

```typescript
// Authentication
login(page, email, password)
logout(page)

// Projects
createProject(page, name, description)
navigateToProject(page, index)

// Characters
addCharacter(page, name, age, description)
deleteCharacter(page, name)

// Locations
addLocation(page, name, description)

// Scripts
generateScript(page, topic, options)
editScriptContent(page, content)
exportScript(page, format)

// Navigation & Assertions
navigateToSection(page, name)
expectElementToBeVisible(page, selector)
expectElementToContainText(page, selector, text)
waitForSave(page)
```

---

## ⚙️ Configuration

### `playwright.config.ts`

- **Base URL**: http://localhost:12323
- **Timeout**: 30 seconds (adjustable)
- **Browsers**: Chrome, Firefox, Safari
- **Workers**: 1 (sequential to avoid conflicts)
- **Server**: Auto-starts via `npm run dev`
- **Traces**: Captured on first retry
- **Screenshots**: Captured on failure only
- **Videos**: Retained on failure

---

## 🔄 CI/CD Integration

### GitHub Actions Workflow

File: `.github/workflows/e2e-tests.yml`

**Features:**
- ✅ Runs on every push to main/develop
- ✅ Runs on pull requests
- ✅ Tests across Chrome, Firefox, Safari
- ✅ Uploads test reports as artifacts
- ✅ Uploads videos on failure
- ✅ Comments on PRs with results

**Manual trigger:**
```bash
gh workflow run e2e-tests.yml
```

---

## 💡 Quick Tips

### While Developing Tests

1. **Use UI mode** - Most intuitive way to work
   ```bash
   npm run e2e:ui
   ```

2. **Record interactions** - Generate selector code
   ```bash
   npx playwright codegen http://localhost:12323
   ```

3. **Debug step-by-step** - See exactly what's happening
   ```bash
   npm run e2e:debug
   ```

4. **Watch in real-time** - See browser actions
   ```bash
   npm run e2e:headed
   ```

### Running Tests

1. **All tests**: `npm run e2e`
2. **Specific file**: `npx playwright test e2e/full-flow.spec.ts`
3. **Matching pattern**: `npx playwright test --grep "Create"`
4. **Single test**: Use `test.only()` in code

### Debugging Failures

1. Check test report: `npx playwright show-report`
2. Look at screenshots/videos in test-results/
3. Run in debug mode: `npm run e2e:debug`
4. Check troubleshooting guide: `e2e/TROUBLESHOOTING.md`

---

## 🎨 Test Writing Examples

### Simple Login Test
```typescript
test('user can login', async ({ page }) => {
  await login(page, 'test@example.com', 'password');
  await expect(page).toHaveURL('/projects');
});
```

### Character Creation Test
```typescript
test('user can create character', async ({ page }) => {
  await login(page);
  await page.click('a:has-text("Characters")');
  await addCharacter(page, 'Alice', 25);
  await expect(page.locator('text=Alice')).toBeVisible();
});
```

### Full Workflow Test
```typescript
test('complete workflow', async ({ page }) => {
  await login(page);
  const projectUrl = await createProject(page, 'My Project');
  await navigateToSection(page, 'Characters');
  await addCharacter(page, 'Hero');
  await navigateToSection(page, 'Input');
  await generateScript(page, 'A hero\'s journey');
  await waitForSave(page);
  await expect(page.locator('[data-testid="script-content"]')).toBeVisible();
});
```

---

## 🔍 Finding Issues

### "Element not found"
1. Run: `npx playwright codegen http://localhost:12323`
2. Click the element in the browser
3. Copy the generated selector into your test

### Tests timing out
1. Increase timeout in `playwright.config.ts`
2. Or for specific test: `test.setTimeout(60000)`

### Tests fail in CI but pass locally
1. Check if backend is running properly
2. Verify environment variables
3. Run with retries: `npx playwright test --retries 2`

---

## 📊 Test Structure

All tests follow this pattern:

```
test.describe('Feature Group', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
  });

  test('specific scenario', async ({ page }) => {
    // 1. SETUP - Login, navigate, etc.
    await login(page);

    // 2. ACTION - User interaction
    await addCharacter(page, 'Test');

    // 3. ASSERT - Verify result
    await expect(page.locator('text=Test')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Cleanup after each test
  });
});
```

---

## 🚀 Next Steps

1. **Run tests to verify setup**:
   ```bash
   npm run dev &
   npm run e2e:ui
   ```

2. **Update selectors if needed**:
   - Use `npx playwright codegen` to find correct selectors
   - Update test files with your actual element identifiers

3. **Customize test data**:
   - Update `helpers.ts` with your API structure
   - Adjust credentials if different

4. **Add more tests**:
   - Copy existing test templates
   - Use helpers to avoid duplication
   - Keep tests focused and independent

5. **Enable in CI/CD**:
   - Workflow already configured in `.github/workflows/e2e-tests.yml`
   - Push code and tests will run automatically

---

## 📞 Support Resources

| Resource | Purpose |
|----------|---------|
| `SETUP.md` | Detailed setup instructions |
| `e2e/README.md` | Comprehensive testing guide |
| `e2e/TROUBLESHOOTING.md` | Common issues & fixes |
| `E2E_SETUP_SUMMARY.txt` | Quick reference card |
| `https://playwright.dev` | Official Playwright documentation |

---

## ✅ Verification Checklist

- [x] Playwright installed: `@playwright/test@^1.58.2`
- [x] Configuration created: `playwright.config.ts`
- [x] Test files created: 750+ lines of tests
- [x] Helper utilities: `e2e/helpers.ts`
- [x] Documentation: Setup, README, Troubleshooting
- [x] CI/CD: GitHub Actions workflow
- [x] Shell script: `e2e-run.sh`
- [x] NPM commands: All E2E commands added

**Everything is ready to use! 🎉**

---

## 🎯 Recommended Workflow

### For Development

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run tests in UI mode
npm run e2e:ui
```

### For CI/CD

Tests automatically run on:
- Push to main/develop
- Pull request creation
- Manual workflow trigger

### For Debugging

```bash
npm run e2e:debug  # Step through tests
npm run e2e:headed # See browser
npm run e2e:ui     # Interactive mode
```

---

**Last Updated**: 2026-03-31
**Status**: ✅ Complete and Ready
**Next Command**: `npm run e2e:ui`
