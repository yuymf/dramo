#!/bin/bash

# Dramo E2E Testing Quick Start Guide
# This script provides shortcuts for running Playwright tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Dramo E2E Testing with Playwright   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Show menu if no arguments
if [ $# -eq 0 ]; then
  echo -e "${YELLOW}Usage: ./e2e-run.sh [command]${NC}"
  echo ""
  echo "Available commands:"
  echo "  ${GREEN}all${NC}          Run all tests"
  echo "  ${GREEN}ui${NC}           Run tests in UI mode (interactive)"
  echo "  ${GREEN}debug${NC}        Run tests in debug mode"
  echo "  ${GREEN}headed${NC}       Run tests with browser visible"
  echo "  ${GREEN}chrome${NC}       Run only Chrome tests"
  echo "  ${GREEN}firefox${NC}      Run only Firefox tests"
  echo "  ${GREEN}safari${NC}       Run only Safari tests"
  echo "  ${GREEN}full-flow${NC}    Run full-flow tests only"
  echo "  ${GREEN}journey${NC}      Run complete-journey tests only"
  echo "  ${GREEN}api${NC}          Run API integration tests only"
  echo "  ${GREEN}pattern [text]${NC} Run tests matching pattern"
  echo "  ${GREEN}codegen${NC}      Generate test code by recording"
  echo "  ${GREEN}report${NC}       Open last test report"
  echo "  ${GREEN}help${NC}         Show this help message"
  echo ""
  exit 0
fi

case "$1" in
  all)
    echo -e "${BLUE}Running all E2E tests...${NC}"
    npm run e2e
    ;;
  ui)
    echo -e "${BLUE}Starting Playwright UI mode...${NC}"
    npm run e2e:ui
    ;;
  debug)
    echo -e "${BLUE}Starting Playwright debug mode...${NC}"
    npm run e2e:debug
    ;;
  headed)
    echo -e "${BLUE}Running tests with browser visible...${NC}"
    npm run e2e:headed
    ;;
  chrome)
    echo -e "${BLUE}Running Chromium tests only...${NC}"
    npm run e2e:chromium
    ;;
  firefox)
    echo -e "${BLUE}Running Firefox tests only...${NC}"
    npm run e2e:firefox
    ;;
  safari)
    echo -e "${BLUE}Running WebKit tests only...${NC}"
    npm run e2e:webkit
    ;;
  full-flow)
    echo -e "${BLUE}Running full-flow tests...${NC}"
    npx playwright test e2e/full-flow.spec.ts
    ;;
  journey)
    echo -e "${BLUE}Running complete-journey tests...${NC}"
    npx playwright test e2e/complete-journey.spec.ts
    ;;
  api)
    echo -e "${BLUE}Running API integration tests...${NC}"
    npx playwright test e2e/api-integration.spec.ts
    ;;
  pattern)
    if [ -z "$2" ]; then
      echo -e "${RED}Error: Please provide a pattern${NC}"
      echo "Usage: ./e2e-run.sh pattern [text]"
      exit 1
    fi
    echo -e "${BLUE}Running tests matching pattern: $2${NC}"
    npx playwright test --grep "$2"
    ;;
  codegen)
    echo -e "${BLUE}Starting Playwright codegen...${NC}"
    npx playwright codegen http://localhost:12323
    ;;
  report)
    echo -e "${BLUE}Opening test report...${NC}"
    npx playwright show-report
    ;;
  help)
    echo "This script has been run with 'help' argument."
    "$0"
    ;;
  *)
    echo -e "${RED}Unknown command: $1${NC}"
    echo "Run '$0' with no arguments for help"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
