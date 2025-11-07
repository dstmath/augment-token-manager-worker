#!/bin/bash

# Augment Token Manager Server Setup Script
# This script helps you quickly set up the server

set -e

echo "🚀 Augment Token Manager Server Setup"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "⚠️  MySQL is not installed. Please install MySQL 8.0+ first."
    echo "   Ubuntu/Debian: sudo apt install mysql-server"
    echo "   CentOS/RHEL: sudo yum install mysql-server"
    exit 1
fi

echo "✅ MySQL detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration:"
    echo "   - DATABASE_URL"
    echo "   - SESSION_SECRET"
    echo "   - USER_CREDENTIALS"
    echo ""
    read -p "Press Enter to continue after editing .env..."
fi

# Generate Prisma Client
echo ""
echo "🔧 Generating Prisma Client..."
npm run prisma:generate

# Ask if user wants to run migrations
echo ""
read -p "Do you want to run database migrations now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️  Running database migrations..."
    npm run prisma:migrate
    echo "✅ Database migrations completed"
fi

# Ask if user wants to migrate from Cloudflare KV
echo ""
read -p "Do you have existing data in Cloudflare KV to migrate? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "⚠️  Please make sure you have configured the following in .env:"
    echo "   - CF_ACCOUNT_ID"
    echo "   - CF_TOKENS_KV_NAMESPACE_ID"
    echo "   - CF_SESSIONS_KV_NAMESPACE_ID"
    echo "   - CF_API_TOKEN"
    echo ""
    read -p "Press Enter to continue after configuring..."
    echo "📦 Running migration from Cloudflare KV..."
    npm run db:migrate-from-kv
fi

# Build the project
echo ""
echo "🔨 Building the project..."
npm run build

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📚 Next steps:"
echo "   1. Review your .env configuration"
echo "   2. Start development server: npm run dev"
echo "   3. Or start production server: npm start"
echo "   4. Or use PM2: pm2 start ecosystem.config.cjs"
echo ""
echo "📖 For more information, see:"
echo "   - README.md"
echo "   - DEPLOYMENT.md"
echo ""

