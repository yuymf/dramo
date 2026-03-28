#!/bin/bash

# Development setup script for Story Agent Backend

set -e

echo "🚀 Setting up Story Agent Backend for development..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }

echo "✅ Prerequisites checked"

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env with your actual credentials before continuing"
    exit 0
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run prisma:generate

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Make sure your .env is configured with DATABASE_URL and OPENAI_API_KEY"
echo "  2. Start services with: docker compose up -d"
echo "  3. Run migrations: npm run prisma:migrate"
echo "  4. Start dev server: npm run dev"
echo "  5. In another terminal, start workers: npm run worker"
echo ""
echo "📚 API docs will be at: http://localhost:3000/docs"


