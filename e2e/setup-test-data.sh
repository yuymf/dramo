#!/bin/bash

# Setup script to create test data for E2E tests

set -e

echo "🔧 Setting up test data for E2E tests..."

# Test credentials
EMAIL="demo@example.com"
PASSWORD="demo123456"
API_URL="http://localhost:12321"
FRONTEND_URL="http://localhost:12323"

echo "📝 Test Credentials:"
echo "  Email: $EMAIL"
echo "  Password: $PASSWORD"

# Function to login and get token
get_token() {
  echo "🔐 Logging in..."

  RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

  TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

  if [ -z "$TOKEN" ]; then
    echo "❌ Login failed!"
    echo "Response: $RESPONSE"
    exit 1
  fi

  echo "✅ Login successful!"
  echo "TOKEN=$TOKEN"
}

# Function to create a project
create_project() {
  local NAME=$1
  local DESCRIPTION=$2

  echo "📁 Creating project: $NAME"

  RESPONSE=$(curl -s -X POST "$API_URL/api/projects" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$NAME\",\"description\":\"$DESCRIPTION\"}")

  PROJECT_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

  if [ -z "$PROJECT_ID" ]; then
    echo "⚠️  Could not create project (API may require different format)"
    echo "Response: $RESPONSE"
    return 1
  fi

  echo "✅ Project created: $PROJECT_ID"
  echo "PROJECT_ID=$PROJECT_ID"
}

# Function to create a character
create_character() {
  local PROJECT_ID=$1
  local NAME=$2

  echo "👤 Creating character: $NAME"

  RESPONSE=$(curl -s -X POST "$API_URL/api/projects/$PROJECT_ID/characters" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$NAME\",\"age\":25,\"description\":\"测试角色\"}")

  CHAR_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

  if [ -z "$CHAR_ID" ]; then
    echo "⚠️  Could not create character"
    return 1
  fi

  echo "✅ Character created: $CHAR_ID"
  echo "CHARACTER_ID=$CHAR_ID"
}

# Main execution
main() {
  echo "🚀 E2E Test Setup Script"
  echo "========================"
  echo ""
  echo "⚠️  Before running this script, make sure:"
  echo "  1. Frontend is running at $FRONTEND_URL"
  echo "  2. Backend is running at $API_URL"
  echo "  3. User account exists ($EMAIL)"
  echo ""

  read -p "Continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
  fi

  # Get authentication token
  get_token

  if [ -z "$TOKEN" ]; then
    echo "❌ Authentication failed!"
    exit 1
  fi

  # Create test project
  if create_project "E2E Test Project" "测试项目用于E2E测试"; then
    echo ""
    echo "📊 Test Data Created Successfully!"
    echo ""
    echo "You can now run the content generation tests:"
    echo ""
    echo "  npm run e2e:chromium -- content-generation.spec.ts"
    echo ""
  else
    echo ""
    echo "⚠️  Project creation failed or API format different"
    echo "This is normal if the backend uses a different API structure."
    echo ""
    echo "The tests will skip gracefully if no projects exist."
  fi
}

# Run main
main
