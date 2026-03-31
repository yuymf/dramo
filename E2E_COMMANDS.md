# 🎭 Playwright E2E Testing - All Commands

## ⚡ Quick Reference

### Start Testing Now
```bash
npm run dev &           # Terminal 1: Start app
npm run e2e:ui         # Terminal 2: Run tests (BEST!)
```

---

## 📋 All npm Commands

### Basic Test Execution
```bash
npm run e2e              # Run all tests (headless) - FASTEST
npm run e2e:ui          # Interactive UI mode - RECOMMENDED! 🌟
npm run e2e:debug       # Debug with Playwright Inspector
npm run e2e:headed      # Run with visible browser - SEE IT HAPPEN
```

### Browser-Specific
```bash
npm run e2e:chromium    # Chrome/Edge only
npm run e2e:firefox     # Firefox only
npm run e2e:webkit      # Safari only
```

---

## 🎯 Using npx (Direct Commands)

### Run Specific Tests
```bash
# Run single test file
npx playwright test e2e/full-flow.spec.ts

# Run multiple specific files
npx playwright test e2e/full-flow.spec.ts e2e/api-integration.spec.ts

# Run with pattern matching
npx playwright test --grep "Create project"
npx playwright test --grep "character"
npx playwright test --grep "branching"
```

### Recording & Debugging
```bash
# Record test by clicking on page (SUPER USEFUL!)
npx playwright codegen http://localhost:12323

# Debug with inspector
npx playwright test --debug

# Headed mode with all details
npx playwright test --headed --headed-debug

# Verbose logging
DEBUG=pw:api npx playwright test
```

### Reports & Results
```bash
# View HTML report
npx playwright show-report

# Save results to specific format
npx playwright test --reporter html

# List all tests without running
npx playwright test --list
```

### Advanced Options
```bash
# Run with retries
npx playwright test --retries 2

# Run single test by name
npx playwright test -t "should create character"

# Run until first failure
npx playwright test --x

# Run tests in parallel (be careful!)
npx playwright test --workers 4

# Set timeout
npx playwright test --timeout 60000
```

---

## 🛠 Shell Script Commands

```bash
# Make script executable (if needed)
chmod +x e2e-run.sh

# Run commands
./e2e-run.sh all           # Run all tests
./e2e-run.sh ui            # Interactive mode
./e2e-run.sh debug         # Debug mode
./e2e-run.sh headed        # Browser visible
./e2e-run.sh chrome        # Chrome only
./e2e-run.sh firefox       # Firefox only
./e2e-run.sh safari        # Safari only
./e2e-run.sh full-flow     # Run one test file
./e2e-run.sh journey       # Run another test file
./e2e-run.sh api           # Run API tests
./e2e-run.sh pattern "text" # Pattern matching
./e2e-run.sh codegen       # Start recording
./e2e-run.sh report        # View report
./e2e-run.sh help          # Show help
```

---

## 🔍 Specific Test Scenarios

### Run by Test Description
```bash
# Run tests with specific text
npx playwright test --grep "login"
npx playwright test --grep "Create"
npx playwright test --grep "export"
```

### Available Test Groups
```bash
# Full flow tests
npx playwright test e2e/full-flow.spec.ts

# User journey tests
npx playwright test e2e/complete-journey.spec.ts

# API tests
npx playwright test e2e/api-integration.spec.ts
```

### Run Individual Tests
```bash
npx playwright test e2e/full-flow.spec.ts -t "E2E: Create project"
npx playwright test e2e/complete-journey.spec.ts -t "responsive"
npx playwright test e2e/api-integration.spec.ts -t "error handling"
```

---

## 🎮 Interactive UI Mode (BEST!)

```bash
npm run e2e:ui
```

The UI mode provides:
- 🎬 Visual test execution
- ⏸️ Step-by-step control
- 📹 Watch tests as they run
- 🔍 Inspect elements
- 📊 View results in real-time
- 🐛 Quick debugging

---

## 🐛 Debugging Commands

### Step-Through Debugging
```bash
npm run e2e:debug
# or
npx playwright test --debug

# Use F10 (step over), F11 (step in), F8 (continue)
```

### Verbose Output
```bash
DEBUG=pw:api npm run e2e
DEBUG=pw:api npx playwright test e2e/full-flow.spec.ts
```

### See Browser Actions
```bash
npm run e2e:headed
# Browser window shows as tests run
```

### Combined: Verbose + Headed
```bash
DEBUG=pw:api npm run e2e:headed
```

---

## 🎬 Recording New Tests

```bash
# Start recording mode
npx playwright codegen http://localhost:12323

# Click on elements in the browser
# Playwright generates selector code automatically
# Copy the code into your test file
```

---

## 📊 View Results

### HTML Report
```bash
npx playwright show-report
# Opens in browser with full details
```

### Test Results Directory
```bash
# Look for:
test-results/           # Screenshots, videos, traces
playwright-report/      # HTML report
blob-report/           # Raw data
```

---

## 🔧 Configuration Commands

### Install Browsers Explicitly
```bash
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
npx playwright install --with-deps  # Install system deps too
```

### Check Installation
```bash
npx playwright --version
npx playwright install-deps  # Linux: install system packages
```

---

## 🚀 CI/CD Commands

### GitHub Actions (Local Simulation)
```bash
# Set CI environment
CI=true npm run e2e

# Disable server reuse (like CI)
npx playwright test --project=chromium
```

### Manual GitHub Actions Trigger
```bash
gh workflow run e2e-tests.yml
gh run list --workflow=e2e-tests.yml
```

---

## 📝 Development Workflow

### Typical Development Session

```bash
# Terminal 1: Start app
npm run dev

# Terminal 2: Start interactive testing
npm run e2e:ui

# While editing tests:
# 1. Click "Run" button in UI mode
# 2. Tests execute automatically
# 3. See failures immediately
# 4. Fix and repeat
```

### Adding New Tests

```bash
# 1. Record interaction
npx playwright codegen http://localhost:12323

# 2. Copy code to test file
# 3. Run tests to verify
npm run e2e:ui

# 4. Debug if needed
npm run e2e:debug
```

### Checking Coverage

```bash
# Run all tests to verify nothing broke
npm run e2e

# View detailed report
npx playwright show-report
```

---

## 💡 Pro Tips & Tricks

### Faster Iteration
```bash
# Only run affected tests during development
npx playwright test --grep "component-name"

# Continue after first failure
npx playwright test --continue-on-failure

# Stop at first error
npx playwright test --x
```

### Debugging Selectors
```bash
# Three ways to find correct selectors:

# 1. Use codegen (BEST)
npx playwright codegen http://localhost:12323

# 2. Use debug mode
npm run e2e:debug

# 3. Open DevTools manually
npm run e2e:headed  # Press F12 in browser
```

### Performance Check
```bash
# Time each test
npx playwright test --reporter=list

# Generate performance report
npx playwright test --reporter=html
```

---

## 🆘 Troubleshooting Commands

### Check If App Is Running
```bash
curl http://localhost:12323
curl http://localhost:12321  # Backend
curl http://localhost:12322  # AgentOS
```

### Kill Port If Stuck
```bash
# macOS/Linux
lsof -ti:12323 | xargs kill -9

# Windows
netstat -ano | findstr :12323
taskkill /PID [pid] /F
```

### Clean and Reinstall
```bash
# Remove cache
rm -rf .playwright
rm -rf playwright-report
rm -rf test-results

# Reinstall browsers
npx playwright install --with-deps
```

### View Logs
```bash
# Last 100 lines of console output
npx playwright test 2>&1 | tail -100

# Save to file
npx playwright test > test.log 2>&1
```

---

## 📚 Where to Go Next

| Need | Command |
|------|---------|
| Start testing | `npm run e2e:ui` |
| Learn more | Read `E2E_INDEX.md` |
| See examples | Read `e2e/full-flow.spec.ts` |
| Debug issue | Read `e2e/TROUBLESHOOTING.md` |
| Check config | Read `playwright.config.ts` |
| Run everything | `npm run e2e` |

---

## 🎯 Most Common Commands You'll Use

```bash
# During Development
npm run e2e:ui          # 90% of the time - interactive testing
npm run e2e:debug       # When something doesn't work
npm run e2e:headed      # To see what's happening

# Before Committing
npm run e2e             # Make sure everything passes

# In CI/CD
npm run e2e             # Runs automatically on push/PR
```

---

**Last Updated**: 2026-03-31
**Quick Start**: `npm run e2e:ui`
