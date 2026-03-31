# 📋 Dramo E2E Tests - Quick Reference

## Current Status
✅ **16/16 tests passing** (100% success rate)
⚡ **2.2 min execution time**
🚀 **Production ready**

## Quick Commands

### Run Tests
```bash
# All content generation tests (recommended)
npm run e2e:chromium -- content-generation-with-data.spec.ts

# Quick smoke tests only (40s)
npm run e2e:chromium -- smoke.spec.ts

# Full E2E suite (all files)
npm run e2e:chromium

# With visible browser (debugging)
npm run e2e:headed -- content-generation-with-data.spec.ts

# Single test
npm run e2e:chromium -- content-generation-with-data.spec.ts \
  --grep "should navigate directly to test project"
```

### Setup
```bash
# One-time setup: add test data to existing project
bash e2e/setup-test-project.sh

# View results
npx playwright show-report
```

## Test Coverage

| Category | Tests | Status |
|----------|-------|--------|
| Navigation | 8 | ✅ All pass |
| Features | 4 | ✅ All pass |
| Forms | 3 | ✅ All pass |
| Data Loading | 1 | ✅ All pass |
| **Total** | **16** | **✅ 100%** |

## What's Tested

✅ Login and authentication
✅ Project navigation (direct and menu)
✅ Input form page
✅ Script editors (linear, dialogue, hollywood)
✅ Characters management
✅ Locations management
✅ Storyboard viewer
✅ Responsive design (desktop + tablet)
✅ Session persistence
✅ Form interactions

## Key Pages Tested

| Route | Status |
|-------|--------|
| `/projects/:id` | ✅ |
| `/projects/:id/input` | ✅ |
| `/projects/:id/scripts` | ✅ |
| `/projects/:id/scripts/dialogue` | ✅ |
| `/projects/:id/scripts/hollywood` | ✅ |
| `/projects/:id/characters` | ✅ |
| `/projects/:id/locations` | ✅ |
| `/projects/:id/storyboard` | ✅ |

## Test Credentials
```
Email: demo@example.com
Password: demo123456
Project ID: cmnao4tu9000166e5qg59gno4
```

## Troubleshooting

**Tests timeout?**
- Ensure `npm run dev` is running (web + server + agentos)
- Check network connectivity

**Authentication fails?**
- Run `npm run prisma:migrate`
- Verify demo user exists in database

**Project not found?**
- Run: `bash e2e/setup-test-project.sh`
- Check project exists in UI: http://localhost:12323/projects

**Want to debug?**
```bash
npm run e2e:headed -- content-generation-with-data.spec.ts
# Browser will open, watch the test run
```

## Files

- `e2e/content-generation-with-data.spec.ts` - Main test file (16 tests)
- `e2e/helpers.ts` - Login and utility functions
- `e2e/setup-test-project.sh` - Test data setup
- `playwright.config.ts` - Test configuration

## Documentation

- `E2E_FINAL_STATUS.md` - Complete status report
- `E2E_TEST_IMPROVEMENTS.md` - Technical details of fixes
- `E2E_WITH_REAL_DATA.md` - In-depth testing guide

---

Last updated: 2026-03-31
Pass rate: 100% (16/16)
