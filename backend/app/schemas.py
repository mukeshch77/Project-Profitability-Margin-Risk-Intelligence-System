from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


class PredictRequest(BaseModel):
    budget: float = Field(..., gt=0)
    actual_cost: float = Field(..., gt=0)
    team_size: int = Field(..., ge=1)
    schedule_delay: float = Field(..., ge=0)
    labor_cost: float = Field(..., ge=0)
    resource_utilization: float = Field(..., ge=0, le=1)
    project_duration: float = Field(..., gt=0)
    revenue: Optional[float] = Field(None, gt=0)
    profit: Optional[float] = None
    profit_margin: Optional[float] = None


class ExplanationItem(BaseModel):
    feature: str
    impact: float
    impact_pct: float


class PredictResponse(BaseModel):
    risk_probability: float
    risk_level: str
    top_risk_cause: str
    message: str
    early_warning_alerts: List[str]
    recommended_action: str
    root_causes: List[str]
    shap_top_features: List[ExplanationItem]


class ExplainResponse(BaseModel):
    project_id: int
    risk_probability: float
    risk_level: str
    top_risk_cause: str
    shap_top_features: List[ExplanationItem]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_error: Optional[str] = None


class TableResponse(BaseModel):
    rows: list[dict]

    model_config = ConfigDict(arbitrary_types_allowed=True)
