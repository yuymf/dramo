#!/bin/bash

# Initialize database with migrations

set -e

echo "🗄️  Initializing database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set"
    echo "Please set it in .env or export it"
    exit 1
fi

echo "📊 Running Prisma migrations..."
npx prisma migrate deploy

echo "✅ Database initialized successfully!"
echo ""
echo "Optional: Open Prisma Studio to view data"
echo "  npm run prisma:studio"


