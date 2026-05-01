# 🚀 DEPLOYMENT GUIDE - Project Profitability & Margin Risk Intelligence System

## Overview
This guide walks you through deploying your full-stack application **completely FREE** using:
- **Backend**: Render or Railway (Python/FastAPI)
- **Frontend**: Vercel (Next.js)
- **Database**: Supabase (PostgreSQL)

---

## 📋 Prerequisites
- GitHub account (to connect repos)
- Render/Railway account
- Vercel account  
- Supabase account

All have **free tiers** that are perfect for this project!

---

# Step 1️⃣: Set Up Supabase Database (FREE)

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click **"Create a new project"**
3. Fill in:
   - **Name**: `project-risk-db` (or your choice)
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to you
4. Click **Create new project** (takes ~2 minutes)

### 1.2 Get Your Database Connection String
1. Go to **Project Settings** → **Database**
2. Copy the **"Connection string"** (URI format)
3. It looks like: `postgresql://postgres:[password]@[id].supabase.co:5432/postgres`
4. **Save this!** You'll need it for backend deployment

### 1.3 Create Tables in Supabase
1. In Supabase, go to **SQL Editor**
2. Create a new query and paste this:

```sql
-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    budget FLOAT NOT NULL,
    actual_cost FLOAT NOT NULL,
    team_size INTEGER NOT NULL,
    schedule_delay FLOAT NOT NULL,
    labor_cost FLOAT NOT NULL,
    resource_utilization FLOAT NOT NULL,
    project_duration FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create predictions table
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    risk_probability FLOAT NOT NULL,
    risk_level VARCHAR(16) NOT NULL,
    top_risk_cause VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    alert_type VARCHAR(128) NOT NULL,
    alert_message VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create profit_drivers table
CREATE TABLE IF NOT EXISTS profit_drivers (
    id SERIAL PRIMARY KEY,
    feature_name VARCHAR(128) NOT NULL UNIQUE,
    importance_score FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX idx_predictions_project_id ON predictions(project_id);
CREATE INDEX idx_predictions_risk_level ON predictions(risk_level);
CREATE INDEX idx_alerts_project_id ON alerts(project_id);
CREATE INDEX idx_alerts_alert_type ON alerts(alert_type);
```

3. Click **Run** to create tables

✅ **Done!** Your database is ready.

---

# Step 2️⃣: Deploy Backend on Render (Recommended - Simpler)

### 2.1 Prepare Backend for Deployment

**Update your Dockerfile** (`backend/Dockerfile`):

```dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire project
COPY . /app/

EXPOSE 8000

# Use gunicorn for production
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "--timeout", "120", "backend.app.main:app"]
```

### 2.2 Create Render Account & Connect GitHub
1. Go to [render.com](https://render.com)
2. Sign up with GitHub (easier!)
3. Click **New +** → **Web Service**

### 2.3 Configure Backend Service
1. **Connect GitHub Repository**
   - Select your repository
   - Branch: `main` (or your main branch)

2. **Fill in Service Details**
   - **Name**: `project-risk-backend`
   - **Environment**: `Docker`
   - **Region**: Choose closest to you
   - **Plan**: `Free` (0.5 CPU, 512MB RAM)

3. **Environment Variables** - Click **Add Environment Variable**
   ```
   DATABASE_URL = [paste Supabase connection string from Step 1.2]
   CORS_ORIGINS = https://[your-frontend-domain].vercel.app
   ENVIRONMENT = production
   MODEL_PATH = outputs/margin_risk_model.joblib
   ```

4. Click **Create Web Service**

**Wait 5-10 minutes** for deployment. You'll get a URL like: `https://project-risk-backend.onrender.com`

✅ **Note**: Save this URL! You need it for frontend.

---

# Step 2️⃣ (Alternative): Deploy Backend on Railway

If you prefer Railway instead:

### 2.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### 2.2 Create New Project
1. Click **New Project** → **Deploy from GitHub repo**
2. Select your repository
3. Railway auto-detects Python + FastAPI

### 2.3 Set Environment Variables
1. Go to **Variables** tab
2. Add:
   ```
   DATABASE_URL = [Supabase connection string]
   CORS_ORIGINS = https://[your-frontend-domain].vercel.app
   ENVIRONMENT = production
   ```

3. Click **Deploy**

**Get your backend URL** from the **Deployment** tab.

---

# Step 3️⃣: Deploy Frontend on Vercel (Easiest)

### 3.1 Push Code to GitHub
Make sure your code is pushed to GitHub (if not already):

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 3.2 Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up/Log in with GitHub
3. Click **Add New...** → **Project**
4. Import your GitHub repository
5. Click **Import**

### 3.3 Configure Project
1. **Project Name**: `project-risk-dashboard` (or your choice)
2. **Framework**: Auto-detected as Next.js ✅
3. **Root Directory**: `frontend/`
   - Click **Edit** and type: `frontend`

4. **Environment Variables** - Add:
   ```
   NEXT_PUBLIC_API_URL = https://[your-backend-url-from-render-or-railway].onrender.com
   ```
   - Replace with actual backend URL
   - **Important**: Must start with `NEXT_PUBLIC_` to be visible in frontend!

5. Click **Deploy**

**Vercel builds and deploys automatically!** You get a URL like:
`https://project-risk-dashboard.vercel.app`

✅ **Your app is live!**

---

## 🔧 Configuration Checklist

Create a `.env` file in your **project root** for local development:

```env
# Backend (FastAPI)
DATABASE_URL=postgresql://[user]:[password]@[host]:5432/project_risk_db
CORS_ORIGINS=http://localhost:3000,https://your-vercel-app.vercel.app
ENVIRONMENT=production
MODEL_PATH=outputs/margin_risk_model.joblib

# Frontend (Next.js)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**For production deployment:**
- Set these in Render/Railway **Environment Variables**
- Set `NEXT_PUBLIC_API_URL` in Vercel **Environment Variables**

---

## ✅ Verify Deployment

### Test Backend
```bash
curl https://your-backend-url/health
```

Should return:
```json
{
  "status": "ok",
  "model_loaded": true,
  "model_error": null
}
```

### Test Frontend
Visit: `https://your-vercel-app.vercel.app`

You should see the dashboard load with data from the backend!

---

## 📊 What Happens on Each Deployment

| Step | What Happens | Time |
|------|--------------|------|
| Push to GitHub | Triggers builds | 1 sec |
| Render builds | Installs dependencies, runs Docker | 3-5 min |
| Vercel builds | Builds Next.js, optimizes | 2-3 min |
| Live | App is accessible worldwide | Instant |

---

## 🔐 Security Best Practices

✅ **You've done well!**
- ✅ `.env` files are in `.gitignore` (secrets never committed)
- ✅ CORS restricted to specific origins
- ✅ Database uses strong password
- ✅ Models use environment variables

**Additional steps:**
- Keep Supabase password secure
- Rotate database password quarterly
- Monitor free tier usage in Render/Vercel/Supabase

---

## 🆘 Troubleshooting

### Backend won't start
**Problem**: Render shows `Build failed`

**Solution**:
1. Check logs in Render dashboard
2. Verify `requirements.txt` is correct
3. Ensure `DATABASE_URL` environment variable is set
4. Check that `margin_risk_model.joblib` exists in `outputs/`

### Frontend can't connect to backend
**Problem**: Dashboard shows API errors

**Solution**:
1. Check `NEXT_PUBLIC_API_URL` is set correctly
2. Verify CORS_ORIGINS includes your frontend URL
3. Test backend directly: `curl https://your-backend-url/health`
4. Check browser console for network errors

### Database connection fails
**Problem**: "Could not connect to database"

**Solution**:
1. Verify Supabase connection string is correct
2. Check database tables were created (SQL from Step 1.3)
3. Ensure password doesn't have special characters (or escape them)

---

## 📈 Next Steps

After deployment:

1. **Monitor your app**
   - Render: Dashboard → Metrics
   - Vercel: Analytics tab
   - Supabase: Usage tab

2. **Add custom domain** (optional)
   - Render supports custom domains on free tier
   - Vercel makes it easy: Settings → Domains

3. **Set up backups** (optional)
   - Supabase auto-backups daily
   - No action needed!

4. **Implement CI/CD** (optional)
   - Render/Vercel auto-deploy on push
   - No additional setup needed!

---

## 💰 Cost Estimate (Monthly)

| Service | Free Tier | Cost |
|---------|-----------|------|
| Render Backend | 750 hours/month | **$0** |
| Vercel Frontend | Unlimited builds | **$0** |
| Supabase Database | 1 GB storage, 2GB bandwidth | **$0** |
| **TOTAL** | | **$0** ✨ |

---

## 🎉 You're Done!

Your application is now:
- ✅ **Deployed** on production servers
- ✅ **Scalable** with auto-scaling (up to free tier limits)
- ✅ **Secure** with environment variable protection
- ✅ **Monitored** with built-in dashboards
- ✅ **Free** forever (within free tier limits)

---

## 📞 Support Resources

- **Render**: [docs.render.com](https://docs.render.com)
- **Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **FastAPI**: [fastapi.tiangolo.com](https://fastapi.tiangolo.com)
- **Next.js**: [nextjs.org](https://nextjs.org)

---

**Happy Deploying! 🚀**
