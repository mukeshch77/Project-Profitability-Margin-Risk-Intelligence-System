from __future__ import annotations

from pathlib import Path

import pandas as pd
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, models
from .database import Base, SessionLocal, engine as db_engine, get_db
from .risk_engine import RiskEngine
from .schemas import ExplainResponse, HealthResponse, PredictRequest, PredictResponse, TableResponse


ROOT = Path(__file__).resolve().parents[2]
OUTPUTS_DIR = ROOT / "outputs"
MODEL_PATH = OUTPUTS_DIR / "margin_risk_model.joblib"
DRIVERS_PATH = OUTPUTS_DIR / "global_profitability_drivers.csv"
SHAP_SUMMARY_PATH = OUTPUTS_DIR / "charts" / "global_shap_summary.png"


app = FastAPI(title="Project Profitability API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine: RiskEngine | None = None
model_init_error: str | None = None


@app.on_event("startup")
def startup_event() -> None:
    _initialize_resources()


def _load_model() -> None:
    global engine, model_init_error
    if engine is not None:
        return

    try:
        engine = RiskEngine(MODEL_PATH)
        model_init_error = None
    except Exception as exc:
        engine = None
        model_init_error = f"{type(exc).__name__}: {exc}"


def _initialize_resources() -> None:
    _load_model()

    Base.metadata.create_all(bind=db_engine)

    db = SessionLocal()
    try:
        _seed_profit_drivers_from_csv(db)
    finally:
        db.close()

    # SHAP chart generation is intentionally delegated to a standalone script for stability.


def _ensure_initialized() -> None:
    if engine is None:
        detail = model_init_error or f"Model not initialized from {MODEL_PATH}"
        raise RuntimeError(detail)


def _seed_profit_drivers_from_csv(db: Session) -> None:
    existing = crud.get_profit_drivers(db)
    if existing:
        return

    if not DRIVERS_PATH.exists():
        return

    df = pd.read_csv(DRIVERS_PATH)
    for _, row in df.iterrows():
        feature_name = str(row.get("feature", "")).strip()
        if not feature_name:
            continue
        importance_score = float(row.get("importance_mean", 0.0))
        crud.upsert_profit_driver(
            db,
            feature_name=feature_name,
            importance_score=importance_score,
        )


def _build_alert_reasons(payload_data: dict, risk_level: str) -> list[str]:
    reasons: list[str] = []

    budget = float(payload_data.get("budget", 0.0) or 0.0)
    actual_cost = float(payload_data.get("actual_cost", 0.0) or 0.0)
    schedule_delay = float(payload_data.get("schedule_delay", 0.0) or 0.0)
    revenue = float(payload_data.get("revenue", actual_cost * 1.1) or (actual_cost * 1.1))

    if budget > 0:
        cost_overrun_pct = ((actual_cost - budget) / budget) * 100
        if cost_overrun_pct > 0:
            reasons.append(f"Cost exceeded budget by {cost_overrun_pct:.1f}%")

    if schedule_delay > 10:
        reasons.append(f"Schedule delay is {schedule_delay:.0f} days (> 10 days)")

    if actual_cost > 0:
        rev_cost_ratio = revenue / actual_cost
        if rev_cost_ratio < 1:
            reasons.append(f"Revenue-to-cost ratio is {rev_cost_ratio:.2f} (< 1)")

    if risk_level == "HIGH":
        reasons.append("Model predicted HIGH risk based on historical project patterns")

    return reasons


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    if MODEL_PATH.exists() and engine is None:
        _load_model()

    return HealthResponse(
        status="ok",
        model_loaded=engine is not None,
        model_error=model_init_error,
    )


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest, db: Session = Depends(get_db)) -> PredictResponse:
    try:
        _ensure_initialized()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Model not initialized: {exc}") from exc

    if engine is None:
        raise HTTPException(status_code=503, detail="Model not initialized")

    payload_data = payload.model_dump()
    result = engine.predict_one(payload_data)

    project = crud.create_project(
        db,
        budget=float(payload_data["budget"]),
        actual_cost=float(payload_data["actual_cost"]),
        team_size=int(payload_data["team_size"]),
        schedule_delay=float(payload_data["schedule_delay"]),
        labor_cost=float(payload_data["labor_cost"]),
        resource_utilization=float(payload_data["resource_utilization"]),
        project_duration=float(payload_data["project_duration"]),
    )

    crud.create_prediction(
        db,
        project_id=project.id,
        risk_probability=float(result["risk_probability"]),
        risk_level=str(result["risk_level"]),
        top_risk_cause=str(result["top_risk_cause"]),
    )

    risk_level = str(result["risk_level"])
    trigger_reasons = _build_alert_reasons(payload_data, risk_level)

    has_rule_alert = False
    for alert_type in result.get("early_warning_alerts", []):
        alert_text = str(alert_type)
        if alert_text == "No immediate early warning rule triggered":
            continue
        has_rule_alert = True
        crud.create_alert(
            db,
            project_id=project.id,
            alert_type=alert_text,
            alert_message=(
                f"{result['message']}. Why: {'; '.join(trigger_reasons) if trigger_reasons else 'Rule threshold met'}"
                f". Recommended action: {result['recommended_action']}"
            ),
        )

    if risk_level == "HIGH" and not has_rule_alert:
        crud.create_alert(
            db,
            project_id=project.id,
            alert_type="High Risk Prediction Alert",
            alert_message=(
                f"{result['message']}. Why: {'; '.join(trigger_reasons) if trigger_reasons else 'High risk classification'}"
                f". Recommended action: {result['recommended_action']}"
            ),
        )

    return PredictResponse(**result)


@app.get("/profit-drivers", response_model=TableResponse)
def profit_drivers(db: Session = Depends(get_db)) -> TableResponse:
    rows = crud.get_profit_drivers(db)
    return TableResponse(rows=rows)


@app.get("/watchlist", response_model=TableResponse)
def watchlist(db: Session = Depends(get_db)) -> TableResponse:
    rows = crud.get_watchlist(db)
    return TableResponse(rows=rows)


@app.get("/alerts", response_model=TableResponse)
def alerts(db: Session = Depends(get_db)) -> TableResponse:
    rows = crud.get_alerts(db)
    return TableResponse(rows=rows)


@app.get("/explain/{project_id}", response_model=ExplainResponse)
def explain(project_id: int, db: Session = Depends(get_db)) -> ExplainResponse:
    try:
        _ensure_initialized()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Model not initialized: {exc}") from exc

    if engine is None:
        raise HTTPException(status_code=503, detail="Model not initialized")

    project = crud.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project_id not found")

    payload = {
        "budget": float(project.budget),
        "actual_cost": float(project.actual_cost),
        "team_size": int(project.team_size),
        "schedule_delay": float(project.schedule_delay),
        "labor_cost": float(project.labor_cost),
        "resource_utilization": float(project.resource_utilization),
        "project_duration": float(project.project_duration),
        "revenue": float(project.actual_cost) * 1.1,
        "profit": float(project.actual_cost) * 0.1,
        "profit_margin": 0.1,
    }

    pred = engine.predict_one(payload)
    return ExplainResponse(
        project_id=project_id,
        risk_probability=pred["risk_probability"],
        risk_level=pred["risk_level"],
        top_risk_cause=pred["top_risk_cause"],
        shap_top_features=pred["shap_top_features"],
    )


@app.get("/shap-summary")
def shap_summary() -> dict:
    if not SHAP_SUMMARY_PATH.exists():
        raise HTTPException(status_code=404, detail="SHAP summary chart not found")
    return {"chart_path": SHAP_SUMMARY_PATH.relative_to(ROOT).as_posix()}
