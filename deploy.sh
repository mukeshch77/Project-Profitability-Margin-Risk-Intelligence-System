#!/bin/bash
# 🚀 Quick Start: Deploy Project Profitability System
# This script helps you deploy your application to the cloud

echo "🚀 Project Profitability & Margin Risk Intelligence System"
echo "📋 Deployment Quick Start"
echo "=================================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created. Please edit it with your configuration."
    echo ""
    echo "Required variables to update:"
    echo "  - DATABASE_URL (your Supabase connection string)"
    echo "  - CORS_ORIGINS (your frontend URL)"
    echo "  - NEXT_PUBLIC_API_URL (your backend URL)"
    echo ""
    exit 0
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11 or higher."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. You won't be able to use docker-compose."
    echo "Install Docker from: https://www.docker.com/products/docker-desktop"
fi

echo "🔍 Checking project structure..."
echo ""

# Check required files
files=(
    "backend/app/main.py"
    "frontend/package.json"
    "requirements.txt"
    ".env.example"
    "DEPLOYMENT_GUIDE.md"
)

all_present=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (missing)"
        all_present=false
    fi
done

echo ""
if [ "$all_present" = false ]; then
    echo "❌ Some files are missing. Project structure may be corrupted."
    exit 1
fi

echo "✅ All required files present!"
echo ""
echo "📖 Next steps:"
echo ""
echo "1️⃣  Read the deployment guide:"
echo "    cat DEPLOYMENT_GUIDE.md"
echo ""
echo "2️⃣  For local development:"
echo "    docker-compose up -d"
echo ""
echo "3️⃣  For production deployment:"
echo "    - Follow DEPLOYMENT_GUIDE.md sections Step 1-3"
echo "    - Set up Supabase database"
echo "    - Deploy to Render (backend) or Railway"
echo "    - Deploy to Vercel (frontend)"
echo ""
echo "4️⃣  Test your setup:"
echo "    curl http://localhost:8000/health"
echo ""
echo "=================================================="
echo "🎉 You're ready to deploy!"
echo "Questions? See DEPLOYMENT_GUIDE.md"
