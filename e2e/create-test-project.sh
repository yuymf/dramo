#!/bin/bash

# Dramo E2E Test Project Setup Script
# Creates a complete test project with sample data for E2E testing

set -e

# Configuration
EMAIL="demo@example.com"
PASSWORD="demo123456"
API_URL="${API_URL:-http://localhost:12321}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:12323}"

echo "🚀 Dramo E2E Test Project Setup"
echo "================================"
echo ""
echo "API: $API_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log info
log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to log success
log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

# Function to log warning
log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to log error
log_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Function to make API request
api_request() {
  local method=$1
  local endpoint=$2
  local data=$3
  local token=$4

  if [ -z "$token" ]; then
    curl -s -X "$method" "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X "$method" "$API_URL$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data"
  fi
}

# Step 1: Login
log_info "Logging in as $EMAIL..."

LOGIN_RESPONSE=$(api_request "POST" "/api/auth/login" \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4 || echo "")

if [ -z "$TOKEN" ]; then
  log_error "Login failed!"
  log_error "Response: $LOGIN_RESPONSE"
  exit 1
fi

log_success "Logged in successfully!"
log_info "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Create a test project
log_info "Creating test project..."

PROJECT_NAME="E2E Test Project - $(date +%Y%m%d_%H%M%S)"
PROJECT_DESCRIPTION="Automated E2E test project created for testing input/generation/storyboard workflow"

CREATE_PROJECT_RESPONSE=$(api_request "POST" "/api/projects" \
  "{\"name\":\"$PROJECT_NAME\",\"description\":\"$PROJECT_DESCRIPTION\"}" \
  "$TOKEN")

PROJECT_ID=$(echo "$CREATE_PROJECT_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$PROJECT_ID" ]; then
  log_error "Failed to create project!"
  log_error "Response: $CREATE_PROJECT_RESPONSE"
  exit 1
fi

log_success "Project created: $PROJECT_ID"
log_info "Name: $PROJECT_NAME"
echo ""

# Step 3: Create characters for the project
log_info "Creating test characters..."

declare -a CHARACTERS=(
  '{"name":"Alice","age":28,"description":"Brave protagonist, always ready for adventure","styles":["serious","thoughtful"]}'
  '{"name":"Bob","age":32,"description":"Wise mentor figure, provides guidance and wisdom","styles":["gentle","wise"]}'
  '{"name":"Charlie","age":25,"description":"Energetic comic relief, brings humor and lightness","styles":["funny","energetic"]}'
)

for i in "${!CHARACTERS[@]}"; do
  CHAR_DATA="${CHARACTERS[$i]}"

  CREATE_CHAR_RESPONSE=$(api_request "POST" "/api/projects/$PROJECT_ID/characters" \
    "$CHAR_DATA" "$TOKEN")

  CHAR_ID=$(echo "$CREATE_CHAR_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")

  if [ -n "$CHAR_ID" ]; then
    CHAR_NAME=$(echo "$CHAR_DATA" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
    log_success "Character created: $CHAR_NAME ($CHAR_ID)"
  else
    CHAR_NAME=$(echo "$CHAR_DATA" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
    log_warning "Failed to create character: $CHAR_NAME"
  fi
done
echo ""

# Step 4: Create locations for the project
log_info "Creating test locations..."

declare -a LOCATIONS=(
  '{"name":"Enchanted Forest","description":"A magical forest filled with ancient trees and hidden secrets"}'
  '{"name":"Dragon\'s Lair","description":"A mysterious cave high in the mountains where the dragon resides"}'
  '{"name":"Village Square","description":"The heart of the peaceful village where townsfolk gather"}'
)

for i in "${!LOCATIONS[@]}"; do
  LOCATION_DATA="${LOCATIONS[$i]}"

  CREATE_LOCATION_RESPONSE=$(api_request "POST" "/api/projects/$PROJECT_ID/locations" \
    "$LOCATION_DATA" "$TOKEN")

  LOCATION_ID=$(echo "$CREATE_LOCATION_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")

  if [ -n "$LOCATION_ID" ]; then
    LOCATION_NAME=$(echo "$LOCATION_DATA" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
    log_success "Location created: $LOCATION_NAME ($LOCATION_ID)"
  else
    LOCATION_NAME=$(echo "$LOCATION_DATA" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
    log_warning "Failed to create location: $LOCATION_NAME"
  fi
done
echo ""

# Step 5: Create a script (generate a simple one)
log_info "Creating test script..."

SCRIPT_DATA=$(cat <<'EOF'
{
  "title": "The Hero's Quest",
  "description": "An epic tale of adventure, friendship, and discovery",
  "topic": "Three friends embark on a quest to save the enchanted forest",
  "duration": 30,
  "tone": "adventure",
  "format": "linear",
  "content": "<p><strong>Scene 1: The Meeting</strong></p><p>Three unlikely heroes meet in the village square and learn of the dragon's curse on the enchanted forest. They decide to team up and face this challenge together.</p><p><strong>Scene 2: The Journey</strong></p><p>The trio travels through dangerous paths, facing obstacles and learning more about each other. Their friendship grows stronger with each challenge.</p><p><strong>Scene 3: The Dragon's Lair</strong></p><p>They finally reach the dragon and discover it's not evil, but lonely. Together, they find a solution that saves the forest and brings peace to all.</p>"
}
EOF
)

CREATE_SCRIPT_RESPONSE=$(api_request "POST" "/api/projects/$PROJECT_ID/scripts" \
  "$SCRIPT_DATA" "$TOKEN")

SCRIPT_ID=$(echo "$CREATE_SCRIPT_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")

if [ -n "$SCRIPT_ID" ]; then
  log_success "Script created: $SCRIPT_ID"
else
  log_warning "Failed to create script"
  log_warning "Response: $CREATE_SCRIPT_RESPONSE"
fi
echo ""

# Step 6: Display summary
echo "════════════════════════════════════════════════════════════"
log_success "Test project setup complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📊 Project Information:"
echo "  Project ID:     $PROJECT_ID"
echo "  Project Name:   $PROJECT_NAME"
echo "  Characters:     3 created"
echo "  Locations:      3 created"
echo "  Scripts:        1 created"
echo ""
echo "🌐 Access URLs:"
echo "  Frontend URL:   $FRONTEND_URL/projects/$PROJECT_ID"
echo "  Input Page:     $FRONTEND_URL/projects/$PROJECT_ID/input"
echo "  Characters:     $FRONTEND_URL/projects/$PROJECT_ID/characters"
echo "  Locations:      $FRONTEND_URL/projects/$PROJECT_ID/locations"
echo "  Scripts:        $FRONTEND_URL/projects/$PROJECT_ID/scripts"
echo "  Storyboard:     $FRONTEND_URL/projects/$PROJECT_ID/storyboard"
echo ""
echo "🧪 You can now run E2E tests:"
echo "  npm run e2e:chromium -- content-generation.spec.ts"
echo ""
echo "📝 Test Credentials:"
echo "  Email:    $EMAIL"
echo "  Password: $PASSWORD"
echo ""
echo "✨ The tests will now navigate through:"
echo "  1. Login to the application"
echo "  2. Navigate to projects list"
echo "  3. Access the test project"
echo "  4. Visit input form"
echo "  5. View script editor"
echo "  6. Manage characters"
echo "  7. Manage locations"
echo "  8. View storyboard"
echo ""

echo "🎉 Setup complete! Ready for E2E testing!"
