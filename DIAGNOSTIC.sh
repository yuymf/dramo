#!/bin/bash

echo "🔍 Dramo Service Diagnostic"
echo "============================"
echo ""

echo "1. Checking environment variables..."
if [ -f ".env" ]; then
  echo "   ✓ Root .env exists"
  grep -E "OPENAI_API_KEY|HUNYUAN|DATABASE_URL|JWT_SECRET" .env | head -3
else
  echo "   ❌ Root .env not found"
fi

echo ""
echo "2. Checking server environment..."
if [ -f "server/.env" ]; then
  echo "   ✓ server/.env exists"
  grep -E "DATABASE_URL|AGENTOS" server/.env | head -2
else
  echo "   ❌ server/.env not found"
fi

echo ""
echo "3. Checking frontend environment..."
if [ -f "web/.env.local" ]; then
  echo "   ✓ web/.env.local exists"
  grep -E "NEXTAUTH|API_URL" web/.env.local | head -2
else
  echo "   ❌ web/.env.local not found"
fi

echo ""
echo "4. Checking database connectivity..."
if command -v psql &> /dev/null; then
  if psql -h localhost -d postgres -U postgres -c "SELECT 1" &>/dev/null 2>&1; then
    echo "   ✓ PostgreSQL accessible locally"
  elif [ ! -z "$DATABASE_URL" ]; then
    echo "   ℹ️ Using DATABASE_URL from environment"
  fi
else
  echo "   ℹ️ psql not found, assuming remote DB"
fi

echo ""
echo "5. Port availability..."
for port in 12321 12322 12323; do
  if lsof -i :$port &>/dev/null 2>&1; then
    echo "   ✓ Port $port in use"
  else
    echo "   ✗ Port $port available"
  fi
done

echo ""
echo "6. Key files check..."
[ -f "e2e/helpers.ts" ] && echo "   ✓ e2e/helpers.ts exists" || echo "   ❌ e2e/helpers.ts missing"
[ -f "playwright.config.ts" ] && echo "   ✓ playwright.config.ts exists" || echo "   ❌ playwright.config.ts missing"
[ -f "server/src/services/llm-config.service.ts" ] && echo "   ✓ llm-config.service.ts exists" || echo "   ❌ llm-config.service.ts missing"

echo ""
echo "7. Recommendation:"
echo "   To run E2E tests successfully:"
echo "   • Run: ./switch-env.sh debug"
echo "   • Run: npm run dev"
echo "   • Then in another terminal: npm run e2e:chromium"
echo ""
