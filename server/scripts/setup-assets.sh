#!/bin/bash
# Setup script for asset and storyboard persistence

set -e

echo "🚀 Setting up asset and storyboard persistence..."
echo ""

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from backend/ directory"
  exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  Warning: DATABASE_URL not set in .env"
  echo "Please configure .env before proceeding"
  exit 1
fi

echo "Step 1: Generating Prisma Client..."
npx prisma generate

echo ""
echo "Step 2: Running database migrations..."
npx prisma migrate deploy

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure STORAGE_DRIVER in .env:"
echo "   - For dev: STORAGE_DRIVER=local"
echo "   - For prod: STORAGE_DRIVER=supabase (with SUPABASE_URL, etc.)"
echo "2. Restart the backend: npm run dev"
echo ""
echo "See backend/SETUP_ASSETS.md for detailed documentation."

