@echo off
REM 🚀 Quick Start: Deploy Project Profitability System (Windows)
REM This script helps you deploy your application to the cloud

echo.
echo 🚀 Project Profitability ^& Margin Risk Intelligence System
echo 📋 Deployment Quick Start (Windows)
echo ==================================================
echo.

REM Check if .env file exists
if not exist .env (
    echo ⚠️  .env file not found!
    echo Creating .env from .env.example...
    copy .env.example .env
    echo ✅ .env created. Please edit it with your configuration.
    echo.
    echo Required variables to update:
    echo   - DATABASE_URL (your Supabase connection string)
    echo   - CORS_ORIGINS (your frontend URL)
    echo   - NEXT_PUBLIC_API_URL (your backend URL)
    echo.
    pause
    exit /b 0
)

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed. Please install Python 3.11 or higher.
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Docker is not installed. You won't be able to use docker-compose.
    echo Install Docker Desktop from: https://www.docker.com/products/docker-desktop
    echo.
)

echo 🔍 Checking project structure...
echo.

REM Check required files
setlocal enabledelayedexpansion
set "files[0]=backend\app\main.py"
set "files[1]=frontend\package.json"
set "files[2]=requirements.txt"
set "files[3]=.env.example"
set "files[4]=DEPLOYMENT_GUIDE.md"

set "all_present=true"
for /l %%i in (0,1,4) do (
    if exist "!files[%%i]!" (
        echo ✅ !files[%%i]!
    ) else (
        echo ❌ !files[%%i]! (missing)
        set "all_present=false"
    )
)

echo.
if "%all_present%"=="false" (
    echo ❌ Some files are missing. Project structure may be corrupted.
    pause
    exit /b 1
)

echo ✅ All required files present!
echo.
echo 📖 Next steps:
echo.
echo 1️⃣  Read the deployment guide:
echo    type DEPLOYMENT_GUIDE.md
echo.
echo 2️⃣  For local development:
echo    docker-compose up -d
echo.
echo 3️⃣  For production deployment:
echo    - Follow DEPLOYMENT_GUIDE.md sections Step 1-3
echo    - Set up Supabase database
echo    - Deploy to Render (backend) or Railway
echo    - Deploy to Vercel (frontend)
echo.
echo 4️⃣  Test your setup:
echo    curl http://localhost:8000/health
echo.
echo ==================================================
echo 🎉 You're ready to deploy!
echo Questions? See DEPLOYMENT_GUIDE.md
echo.
pause
