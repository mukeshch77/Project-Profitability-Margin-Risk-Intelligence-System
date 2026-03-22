from __future__ import annotations

from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from . import models


def create_project(
    db: Session,
    *,
    budget: float,
    actual_cost: float,
    team_size: int,
    schedule_delay: float,
    labor_cost: float,
    resource_utilization: float,
    project_duration: float,
) -> models.Project:
    project = models.Project(
        budget=budget,
        actual_cost=actual_cost,
        team_size=team_size,
        schedule_delay=schedule_delay,
        labor_cost=labor_cost,
        resource_utilization=resource_utilization,
        project_duration=project_duration,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def create_prediction(
    db: Session,
    *,
    project_id: int,
    risk_probability: float,
    risk_level: str,
    top_risk_cause: str,
) -> models.Prediction:
    prediction = models.Prediction(
        project_id=project_id,
        risk_probability=risk_probability,
        risk_level=risk_level,
        top_risk_cause=top_risk_cause,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction


def create_alert(
    db: Session,
    *,
    project_id: int,
    alert_type: str,
    alert_message: str,
) -> models.Alert:
    alert = models.Alert(
        project_id=project_id,
        alert_type=alert_type,
        alert_message=alert_message,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def get_watchlist(db: Session, limit: int = 200) -> list[dict[str, Any]]:
    stmt = (
        select(models.Prediction, models.Project)
        .join(models.Project, models.Prediction.project_id == models.Project.id)
        .order_by(desc(models.Prediction.risk_probability), desc(models.Prediction.created_at))
        .limit(limit)
    )

    rows: list[dict[str, Any]] = []
    for pred, project in db.execute(stmt).all():
        budget = project.budget
        actual_cost = project.actual_cost
        cost_overrun_pct = (actual_cost - budget) / budget if budget > 0 else 0.0
        rows.append(
            {
                "project_id": project.id,
                "budget": budget,
                "actual_cost": actual_cost,
                "team_size": project.team_size,
                "schedule_delay": project.schedule_delay,
                "labor_cost": project.labor_cost,
                "resource_utilization": project.resource_utilization,
                "project_duration": project.project_duration,
                "cost_overrun_pct": cost_overrun_pct,
                "risk_probability": pred.risk_probability,
                "risk_level": pred.risk_level,
                "alert_level": pred.risk_level,
                "top_risk_cause": pred.top_risk_cause,
                "root_causes": pred.top_risk_cause,
                "created_at": pred.created_at.isoformat() if pred.created_at else None,
            }
        )
    return rows


def get_alerts(db: Session, limit: int = 500) -> list[dict[str, Any]]:
    stmt = (
        select(models.Alert)
        .order_by(desc(models.Alert.created_at), desc(models.Alert.id))
        .limit(limit)
    )

    rows: list[dict[str, Any]] = []
    for alert in db.execute(stmt).scalars().all():
        rows.append(
            {
                "id": alert.id,
                "project_id": alert.project_id,
                "alert_type": alert.alert_type,
                "alert_message": alert.alert_message,
                "alerts": alert.alert_type,
                "created_at": alert.created_at.isoformat() if alert.created_at else None,
            }
        )
    return rows


def get_profit_drivers(db: Session) -> list[dict[str, Any]]:
    stmt = select(models.ProfitDriver).order_by(desc(models.ProfitDriver.importance_score))
    rows: list[dict[str, Any]] = []
    for item in db.execute(stmt).scalars().all():
        rows.append(
            {
                "id": item.id,
                "feature": item.feature_name,
                "feature_name": item.feature_name,
                "importance_mean": item.importance_score,
                "importance_score": item.importance_score,
            }
        )
    return rows


def upsert_profit_driver(db: Session, *, feature_name: str, importance_score: float) -> models.ProfitDriver:
    existing = db.execute(
        select(models.ProfitDriver).where(models.ProfitDriver.feature_name == feature_name)
    ).scalar_one_or_none()

    if existing is None:
        existing = models.ProfitDriver(
            feature_name=feature_name,
            importance_score=importance_score,
        )
        db.add(existing)
    else:
        existing.importance_score = importance_score

    db.commit()
    db.refresh(existing)
    return existing


def get_project(db: Session, project_id: int) -> models.Project | None:
    return db.get(models.Project, project_id)
