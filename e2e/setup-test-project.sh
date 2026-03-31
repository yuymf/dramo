#!/bin/bash

# Dramo E2E Test Project - Use Existing or Create
# This script uses an existing project or creates one for testing

set -e

EMAIL="demo@example.com"
PASSWORD="demo123456"
API_URL="${API_URL:-http://localhost:12321}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:12323}"

echo "🚀 Dramo E2E Test Project Setup"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Step 1: Login
log_info "Logging in as $EMAIL..."

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4 || echo "")

if [ -z "$TOKEN" ]; then
  log_error "Login failed!"
  exit 1
fi

log_success "Logged in successfully!"
echo ""

# Step 2: Get existing projects
log_info "Fetching existing projects..."

PROJECTS_RESPONSE=$(curl -s -X GET "$API_URL/api/projects?page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")

if [ -z "$PROJECT_ID" ]; then
  log_error "No projects found. Please create a project first in the web UI."
  log_error "Or upgrade your account plan."
  exit 1
fi

PROJECT_NAME=$(echo "$PROJECTS_RESPONSE" | grep -o '"name":"[^"]*' | head -1 | cut -d'"' -f4)
log_success "Using existing project: $PROJECT_NAME ($PROJECT_ID)"
echo ""

# Step 3: Create characters
log_info "Creating test characters..."

declare -a CHARACTERS=(
  '{"name":"Alice","age":28,"description":"Brave protagonist, always ready for adventure","styles":["serious","thoughtful"]}'
  '{"name":"Bob","age":32,"description":"Wise mentor figure, provides guidance and wisdom","styles":["gentle","wise"]}'
  '{"name":"Charlie","age":25,"description":"Energetic comic relief, brings humor and lightness","styles":["funny","energetic"]}'
  '{"name":"Diana","age":26,"description":"Tech genius who solves complex problems","styles":["intelligent","calm"]}'
  '{"name":"Eve","age":30,"description":"Strong leader with unwavering determination","styles":["confident","commanding"]}'
)

CHAR_COUNT=0
for CHAR_DATA in "${CHARACTERS[@]}"; do
  CREATE_CHAR_RESPONSE=$(curl -s -X POST "$API_URL/api/projects/$PROJECT_ID/characters" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$CHAR_DATA")

  CHAR_ID=$(echo "$CREATE_CHAR_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
  CHAR_NAME=$(echo "$CHAR_DATA" | grep -o '"name":"[^"]*' | cut -d'"' -f4)

  if [ -n "$CHAR_ID" ]; then
    log_success "Character created: $CHAR_NAME"
    ((CHAR_COUNT++))
  else
    # Character might already exist, check response
    if echo "$CREATE_CHAR_RESPONSE" | grep -q "UNIQUE constraint failed"; then
      log_warning "Character already exists: $CHAR_NAME"
    else
      log_warning "Failed to create character: $CHAR_NAME"
    fi
  fi
done
echo ""

# Step 4: Create locations
log_info "Creating test locations..."

declare -a LOCATIONS=(
  '{"name":"Enchanted Forest","description":"A magical forest filled with ancient trees and hidden secrets"}'
  '{"name":"Dragon'\''s Lair","description":"A mysterious cave high in the mountains where the dragon resides"}'
  '{"name":"Village Square","description":"The heart of the peaceful village where townsfolk gather"}'
  '{"name":"Crystal Caves","description":"Underground caves with glowing crystals that light the way"}'
  '{"name":"Royal Palace","description":"A grand fortress where the king rules over the kingdom"}'
)

LOCATION_COUNT=0
for LOCATION_DATA in "${LOCATIONS[@]}"; do
  CREATE_LOCATION_RESPONSE=$(curl -s -X POST "$API_URL/api/projects/$PROJECT_ID/locations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$LOCATION_DATA")

  LOCATION_ID=$(echo "$CREATE_LOCATION_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
  LOCATION_NAME=$(echo "$LOCATION_DATA" | grep -o '"name":"[^"]*' | cut -d'"' -f4)

  if [ -n "$LOCATION_ID" ]; then
    log_success "Location created: $LOCATION_NAME"
    ((LOCATION_COUNT++))
  else
    if echo "$CREATE_LOCATION_RESPONSE" | grep -q "UNIQUE constraint failed"; then
      log_warning "Location already exists: $LOCATION_NAME"
    else
      log_warning "Failed to create location: $LOCATION_NAME"
    fi
  fi
done
echo ""

# Step 5: Get project details
log_info "Fetching project details..."

PROJECT_DETAILS=$(curl -s -X GET "$API_URL/api/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

SCRIPT_COUNT=$(echo "$PROJECT_DETAILS" | grep -o '"id":"' | wc -l)

echo ""
echo "════════════════════════════════════════════════════════════"
log_success "Test project ready!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📊 Project Information:"
echo "  Project ID:     $PROJECT_ID"
echo "  Project Name:   $PROJECT_NAME"
echo "  Characters:     5+ (created/existing)"
echo "  Locations:      5+ (created/existing)"
echo ""
echo "🌐 Access URLs:"
echo "  Projects List:  $FRONTEND_URL/projects"
echo "  Project:        $FRONTEND_URL/projects/$PROJECT_ID"
echo "  Input Form:     $FRONTEND_URL/projects/$PROJECT_ID/input"
echo "  Script Editor:  $FRONTEND_URL/projects/$PROJECT_ID/scripts"
echo "  Characters:     $FRONTEND_URL/projects/$PROJECT_ID/characters"
echo "  Locations:      $FRONTEND_URL/projects/$PROJECT_ID/locations"
echo "  Storyboard:     $FRONTEND_URL/projects/$PROJECT_ID/storyboard"
echo ""
echo "🧪 Run E2E Tests:"
echo "  npm run e2e:chromium -- content-generation.spec.ts"
echo ""
echo "📝 Test Flow:"
echo "  1. ✅ Login (demo@example.com / demo123456)"
echo "  2. ✅ Navigate to Projects"
echo "  3. ✅ Open Project ($PROJECT_ID)"
echo "  4. ✅ Access Input Form"
echo "  5. ✅ View Script Editor"
echo "  6. ✅ Manage Characters (5+ available)"
echo "  7. ✅ Manage Locations (5+ available)"
echo "  8. ✅ View Storyboard"
echo ""
echo "✨ Tests will verify each component loads correctly!"
echo ""
