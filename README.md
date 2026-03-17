# Project Profitability & Margin Risk Intelligence System

This repository now includes a full production-style stack:

- ML training and scoring pipeline
- FastAPI backend for serving predictions and analytics tables
- SHAP explainability for local and global model interpretation
- Rule-based early warning alert engine
- Next.js dashboard for risk monitoring and interactive predictions
- Optional weekly monitoring script
- PostgreSQL persistence with SQLAlchemy

## Folder structure

```text
.
|-- backend/
|   |-- app/
|   |   |-- database.py
|   |   |-- models.py
|   |   |-- crud.py
|   |   |-- main.py
|   |   |-- risk_engine.py
|   |   |-- schemas.py
|   |   `-- __init__.py
|   `-- scripts/
|       |-- generate_shap_summary.py
|       `-- weekly_monitor.py
|-- frontend/
|   |-- app/
|   |   |-- dashboard/page.tsx
|   |   |-- watchlist/page.tsx
|   |   |-- drivers/page.tsx
|   |   `-- predict/page.tsx
|   |-- components/nav.tsx
|   |-- lib/api.ts
|   `-- ...next/tailwind config files
|-- outputs/
|   |-- margin_risk_model.joblib
|   |-- project_health_alerts.csv
|   |-- priority_risk_watchlist.csv
|   |-- global_profitability_drivers.csv
|   |-- early_warning_alerts.csv
|   `-- charts/global_shap_summary.png
|-- src/
|   `-- profitability_margin_risk_system.py
|-- init_db.py
|-- project_profitability_dataset.csv
`-- requirements.txt
```

## Database configuration

Set PostgreSQL connection string before running backend:

```powershell
$env:DATABASE_URL="postgresql://postgres:<password>@localhost:5432/project_risk_db"
```

Initialize database tables:

```powershell
c:/python313/python.exe init_db.py
```

## 1. Train the ML pipeline

Install Python dependencies:

```powershell
c:/python313/python.exe -m pip install -r requirements.txt
```

Train and generate base artifacts:

```powershell
c:/python313/python.exe src/profitability_margin_risk_system.py --mode train --data project_profitability_dataset.csv
```

Core generated artifacts:

- outputs/model_metrics.json
- outputs/project_health_alerts.csv
- outputs/priority_risk_watchlist.csv
- outputs/global_profitability_drivers.csv
- outputs/margin_risk_model.joblib

The backend now persists runtime data in PostgreSQL tables instead of CSV for:

- projects
- predictions
- alerts
- profit_drivers

## 2. Run the FastAPI backend

From workspace root:

```powershell
c:/python313/python.exe -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Available endpoints:

- GET /health
- POST /predict
- GET /profit-drivers
- GET /watchlist
- GET /alerts
- GET /explain/{project_id}
- GET /shap-summary

Persistence behavior:

- POST /predict stores a project row and a prediction row in PostgreSQL
- rule-based alerts are stored in alerts table
- GET /watchlist reads high-risk predictions from DB
- GET /alerts reads alert rows from DB
- GET /profit-drivers reads profit drivers from DB

### Predict request example

```json
{
  "budget": 120000,
  "actual_cost": 140000,
  "team_size": 8,
  "schedule_delay": 12,
  "labor_cost": 35000,
  "resource_utilization": 0.72,
  "project_duration": 6
}
```

The response includes:

- risk probability and level
- top risk cause
- root causes and recommended action
- rule-based early warning alerts
- top 3 SHAP feature contributions with impact percentages

## 3. Run the Next.js dashboard

From frontend folder:

```powershell
cd frontend
npm install
```

Set API base URL (PowerShell):

```powershell
$env:NEXT_PUBLIC_API_BASE="http://127.0.0.1:8000"
```

Start dashboard:

```powershell
npm run dev
```

Pages:

- /dashboard
- /watchlist
- /drivers
- /predict

Features included:

- Risk heatmap
- Cost overrun trend
- Risk by team size
- Profitability driver importance chart
- Early warning alerts table
- Predict form with JSON upload and SHAP explanation display

## 4. Early warning alert rules

Rules applied in addition to ML predictions:

- IF cost_overrun_pct > 15% AND schedule_delay > 10 -> Early Margin Erosion Alert
- IF revenue_to_cost_ratio < 1 -> Profitability Risk
- IF resource_utilization < 0.6 AND labor_intensity > 0.35 -> Resource Inefficiency Risk

Alerts are persisted to PostgreSQL alerts table.

## 5. Optional weekly monitoring script

Run manually (or via OS scheduler / CI cron):

```powershell
c:/python313/python.exe backend/scripts/weekly_monitor.py --input project_profitability_dataset.csv
```

This job:

- scores incoming projects
- updates outputs/project_health_alerts.csv
- refreshes outputs/early_warning_alerts.csv

## 6. Generate global SHAP summary chart

```powershell
c:/python313/python.exe backend/scripts/generate_shap_summary.py
```

This generates:

- outputs/charts/global_shap_summary.png

## Notes

- SHAP chart generation is handled by a standalone script for runtime stability.
- If model artifacts are missing, run the training command first.

## 7. Run with Docker Compose

Containerized services included:

- backend (FastAPI + SQLAlchemy + ML/SHAP)
- frontend (Next.js dashboard)
- database (PostgreSQL 15)

From project root, run:

```powershell
docker compose up --build
```

Expected URLs:

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs
- PostgreSQL: localhost:5432 (inside compose network host is database)

Compose files added:

- docker-compose.yml
- backend/Dockerfile
- frontend/Dockerfile
- .dockerignore
- backend/.dockerignore
- frontend/.dockerignore

Container environment wiring:

- Backend DATABASE_URL uses service name database:
  postgresql://postgres:postgres@database:5432/project_risk_db
- Frontend NEXT_PUBLIC_API_URL points to backend service:
  http://backend:8000
