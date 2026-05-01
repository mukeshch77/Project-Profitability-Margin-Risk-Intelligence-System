from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
import shap


@dataclass
class Thresholds:
    q25: Dict[str, float]
    q75: Dict[str, float]
    median: Dict[str, float]


class RiskEngine:
    def __init__(self, model_path: Path) -> None:
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found at {model_path}")

        bundle = joblib.load(model_path)
        self.pipeline = bundle["pipeline"]
        self.artifacts = bundle["artifacts"]
        self.feature_columns: List[str] = self.artifacts["feature_columns"]
        th = self.artifacts["thresholds"]
        self.thresholds = Thresholds(q25=th["q25"], q75=th["q75"], median=th["median"])

        model = self.pipeline.named_steps["model"]
        self.explainer = shap.TreeExplainer(model)

    @staticmethod
    def build_features(df: pd.DataFrame) -> pd.DataFrame:
        result = df.copy()

        safe_budget = result["budget"].replace(0, np.nan)
        safe_actual = result["actual_cost"].replace(0, np.nan)

        result["cost_overrun_pct"] = (result["actual_cost"] - result["budget"]) / safe_budget
        result["labor_intensity"] = result["labor_cost"] / safe_actual
        result["delay_intensity"] = result["schedule_delay"] / result["project_duration"].replace(0, np.nan)
        result["efficiency_gap"] = 1.0 - result["resource_utilization"]

        if "revenue" not in result.columns:
            result["revenue"] = result["actual_cost"]
        result["revenue_to_cost_ratio"] = result["revenue"] / safe_actual

        if "profit" not in result.columns:
            result["profit"] = result["revenue"] - result["actual_cost"]

        if "profit_margin" not in result.columns:
            safe_revenue = result["revenue"].replace(0, np.nan)
            result["profit_margin"] = result["profit"] / safe_revenue

        return result

    def _default_revenue_profit(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        row = dict(payload)
        if row.get("revenue") is None:
            row["revenue"] = float(row["actual_cost"]) * 1.1
        if row.get("profit") is None:
            row["profit"] = float(row["revenue"]) - float(row["actual_cost"])
        if row.get("profit_margin") is None:
            revenue = float(row["revenue"])
            row["profit_margin"] = (float(row["profit"]) / revenue) if revenue else 0.0
        return row

    def _derive_risk_level(self, risk_probability: float, row: pd.Series) -> str:
        if risk_probability >= 0.7:
            level = "HIGH"
        elif risk_probability >= 0.45:
            level = "MEDIUM"
        else:
            level = "LOW"

        if row.get("profit_margin", 0) < 0 or row.get("cost_overrun_pct", 0) > 0.2:
            escalation = {"LOW": "MEDIUM", "MEDIUM": "HIGH", "HIGH": "HIGH"}
            level = escalation[level]
        return level

    def _root_causes(self, row: pd.Series) -> Tuple[List[str], str]:
        causes: List[str] = []

        if row["cost_overrun_pct"] > self.thresholds.q75["cost_overrun_pct"]:
            causes.append("Cost Overrun")
        if row["profit_margin"] < self.thresholds.q25["profit_margin"]:
            causes.append("Low Profit Margin")
        if row["resource_utilization"] < self.thresholds.q25["resource_utilization"]:
            causes.append("Low Resource Utilization")
        if row["schedule_delay"] > self.thresholds.q75["schedule_delay"]:
            causes.append("Schedule Delay")
        if row["labor_intensity"] > self.thresholds.q75["labor_intensity"]:
            causes.append("High Labor Intensity")
        if row["revenue_to_cost_ratio"] < self.thresholds.q25["revenue_to_cost_ratio"]:
            causes.append("Weak Revenue-to-Cost")

        if not causes:
            causes.append("No dominant stressor")

        top_cause = causes[0]
        return causes[:3], top_cause

    def _early_warning_alerts(self, row: pd.Series) -> Tuple[List[str], str]:
        alerts: List[str] = []
        action = "Continue weekly monitoring."

        if row["cost_overrun_pct"] > 0.15 and row["schedule_delay"] > 10:
            alerts.append("Early Margin Erosion Alert")
            action = "Review cost allocation and delivery timeline."

        if row["revenue_to_cost_ratio"] < 1:
            alerts.append("Profitability Risk")
            action = "Revisit pricing, billing milestones, and scope controls."

        if row["resource_utilization"] < 0.6 and row["labor_intensity"] > 0.35:
            alerts.append("Resource Inefficiency Risk")
            action = "Rebalance staffing mix and increase billable utilization."

        if not alerts:
            alerts.append("No immediate early warning rule triggered")

        return alerts, action

    def generate_explanation_and_suggestions(
        self,
        features: pd.Series,
        shap_values: List[Dict[str, float | str]],
        risk_level: str,
    ) -> Tuple[str, List[str]]:
        suggestion_groups: Dict[str, List[str]] = {
            "efficiency": [
                "Improve resource utilization",
                "Improve efficiency",
                "Increase productivity",
                "Optimize staffing mix to control labor intensity",
            ],
            "cost": [
                "Reduce cost overrun below 10%",
                "Control project costs",
                "Optimize budget",
            ],
            "delay": [
                "Reduce project delay",
                "Improve scheduling",
                "Avoid delays",
            ],
        }

        def _as_float(key: str, default: float = 0.0) -> float:
            value = features.get(key, default)
            return float(value if value is not None else default)

        def _label(feature_name: str) -> str:
            mapping = {
                "cost_overrun_pct": "high cost overrun",
                "schedule_delay": "project delay",
                "resource_utilization": "low resource utilization",
                "labor_intensity": "high labor intensity",
                "profit_margin": "low profit margin",
                "revenue_to_cost_ratio": "weak revenue-to-cost ratio",
            }
            return mapping.get(feature_name, feature_name.replace("_", " "))

        def _suggestion(feature_name: str) -> str:
            if feature_name == "cost_overrun_pct":
                return "Reduce cost overrun below 10%"
            if feature_name == "schedule_delay":
                return "Reduce project delay"
            if feature_name in {"resource_utilization", "efficiency_gap"}:
                return "Improve resource utilization"
            if feature_name == "labor_intensity":
                return "Optimize staffing mix to control labor intensity"
            if feature_name == "profit_margin":
                return "Improve project margin through pricing and scope control"
            if feature_name == "revenue_to_cost_ratio":
                return "Improve revenue-to-cost ratio through billing and cost control"
            return "Continue weekly monitoring"

        def _normalize_suggestion(text: str) -> str:
            return text.strip().lower()

        def _dedupe_semantic_suggestions(items: List[str]) -> List[str]:
            group_lookup: Dict[str, Tuple[str, int]] = {}
            for group_name, group_items in suggestion_groups.items():
                for idx, group_item in enumerate(group_items):
                    group_lookup[_normalize_suggestion(group_item)] = (group_name, idx)

            selected_by_group: Dict[str, Tuple[int, str]] = {}
            seen_ungrouped: set[str] = set()

            for item in items:
                normalized = _normalize_suggestion(item)
                grouping = group_lookup.get(normalized)
                if grouping is None:
                    seen_ungrouped.add(normalized)
                    continue

                group_name, specificity_rank = grouping
                current = selected_by_group.get(group_name)
                if current is None or specificity_rank < current[0]:
                    selected_by_group[group_name] = (specificity_rank, item.strip())

            result: List[str] = []
            emitted_group: set[str] = set()
            emitted_ungrouped: set[str] = set()

            for item in items:
                normalized = _normalize_suggestion(item)
                grouping = group_lookup.get(normalized)

                if grouping is None:
                    if normalized and normalized in seen_ungrouped and normalized not in emitted_ungrouped:
                        result.append(item.strip())
                        emitted_ungrouped.add(normalized)
                    continue

                group_name, _ = grouping
                if group_name in emitted_group:
                    continue
                selected = selected_by_group.get(group_name)
                if selected is not None:
                    result.append(selected[1])
                    emitted_group.add(group_name)

            return result

        factors: List[Dict[str, Any]] = []

        cost_overrun = _as_float("cost_overrun_pct")
        if cost_overrun > 0.1:
            factors.append({"feature": "cost_overrun_pct", "score": abs(cost_overrun - 0.1) * 100, "detail": "high cost overrun"})

        schedule_delay = _as_float("schedule_delay")
        if schedule_delay > 10:
            factors.append({"feature": "schedule_delay", "score": abs(schedule_delay - 10), "detail": "project delays"})

        resource_utilization = _as_float("resource_utilization", 1.0)
        if resource_utilization < 0.6:
            factors.append(
                {
                    "feature": "resource_utilization",
                    "score": abs(0.6 - resource_utilization) * 100,
                    "detail": "low resource utilization",
                }
            )

        if len(factors) < 3:
            for item in shap_values:
                feature_name = str(item.get("feature", ""))
                if not feature_name:
                    continue
                if any(existing["feature"] == feature_name for existing in factors):
                    continue
                impact_pct = float(item.get("impact_pct", 0.0) or 0.0)
                factors.append(
                    {
                        "feature": feature_name,
                        "score": impact_pct,
                        "detail": _label(feature_name),
                    }
                )

        ranked = sorted(factors, key=lambda x: float(x["score"]), reverse=True)
        top_factors = ranked[:3]

        details = [str(item["detail"]) for item in top_factors][:3]
        suggestions = [
            _suggestion(str(item["feature"]))
            for item in top_factors
            if _suggestion(str(item["feature"])) != "Continue weekly monitoring"
        ]

        if not details:
            details = ["cost overrun and schedule pressure"]

        if len(details) == 1:
            explanation = f"Project is {risk_level} risk mainly due to {details[0]}."
        elif len(details) == 2:
            explanation = f"Project is {risk_level} risk mainly due to {details[0]} and {details[1]}."
        else:
            explanation = f"Project is {risk_level} risk mainly due to {details[0]}, {details[1]}, and {details[2]}."

        deduped_suggestions = _dedupe_semantic_suggestions(suggestions)
        if not deduped_suggestions:
            deduped_suggestions = ["Reduce cost overrun below 10%", "Reduce project delay", "Improve resource utilization"]

        return explanation, deduped_suggestions[:3]

    @staticmethod
    def generate_summary(
        project_data: Dict[str, Any],
        risk_level: str,
        explanation: str,
    ) -> str:
        profitability = float(project_data.get("profit_margin", 0.0))
        profitability_text = "low" if profitability < 0.1 else "stable"
        urgency_text = "immediate action is needed" if risk_level == "HIGH" else "monitoring is advised"
        return (
            f"This project has {risk_level} risk. {explanation} "
            f"Profitability is {profitability_text} and {urgency_text}."
        )

    def _shap_explain(self, feature_df: pd.DataFrame) -> List[Dict[str, float | str]]:
        transformed = self.pipeline.named_steps["preprocessor"].transform(feature_df)
        values = self.explainer.shap_values(transformed)

        if isinstance(values, list):
            row_values = np.array(values[1][0], dtype=float)
        else:
            row_values = np.array(values[0], dtype=float)

        abs_values = np.abs(row_values)
        total = float(abs_values.sum()) if float(abs_values.sum()) > 0 else 1.0
        top_idx = np.argsort(abs_values)[::-1][:3]

        top_items: List[Dict[str, float | str]] = []
        for i in top_idx:
            impact = float(row_values[i])
            impact_pct = float((abs_values[i] / total) * 100)
            top_items.append(
                {
                    "feature": self.feature_columns[i],
                    "impact": round(impact, 6),
                    "impact_pct": round(impact_pct, 2),
                }
            )
        return top_items

    def predict_one(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        row = self._default_revenue_profit(payload)
        base_df = pd.DataFrame([row])
        featured_df = self.build_features(base_df)

        for col in self.feature_columns:
            if col not in featured_df.columns:
                featured_df[col] = np.nan

        model_input = featured_df[self.feature_columns]
        risk_probability = float(self.pipeline.predict_proba(model_input)[0, 1])

        row_series = featured_df.iloc[0]
        risk_level = self._derive_risk_level(risk_probability, row_series)
        causes, top_cause = self._root_causes(row_series)
        alerts, action = self._early_warning_alerts(row_series)
        shap_top = self._shap_explain(model_input)
        explanation, suggestions = self.generate_explanation_and_suggestions(row_series, shap_top, risk_level)
        summary = self.generate_summary(row, risk_level, explanation)

        if risk_level == "HIGH":
            message = "Early margin erosion detected"
        elif risk_level == "MEDIUM":
            message = "Margin pressure is emerging"
        else:
            message = "Project margin risk currently under control"

        return {
            "risk_probability": round(risk_probability, 4),
            "risk_level": risk_level,
            "top_risk_cause": top_cause,
            "message": message,
            "explanation": explanation,
            "suggestions": suggestions,
            "summary": summary,
            "early_warning_alerts": alerts,
            "recommended_action": action,
            "root_causes": causes,
            "shap_top_features": shap_top,
        }


def generate_early_warning_alerts(
    source_csv: Path,
    output_csv: Path,
) -> pd.DataFrame:
    df = pd.read_csv(source_csv)

    records: List[Dict[str, Any]] = []
    for idx, row in df.iterrows():
        alerts: List[str] = []
        action = "Continue weekly monitoring."

        cost_overrun_pct = float(row.get("cost_overrun_pct", 0.0))
        schedule_delay = float(row.get("schedule_delay", 0.0))
        rev_cost = float(row.get("revenue_to_cost_ratio", 1.0))

        if cost_overrun_pct > 0.15 and schedule_delay > 10:
            alerts.append("Early Margin Erosion Alert")
            action = "Review cost allocation and delivery timeline."

        if rev_cost < 1:
            alerts.append("Profitability Risk")
            action = "Revisit pricing, billing milestones, and scope controls."

        if alerts:
            records.append(
                {
                    "project_id": int(idx),
                    "risk_probability": row.get("risk_probability", None),
                    "alert_level": row.get("alert_level", "Unknown"),
                    "alerts": " | ".join(alerts),
                    "recommended_action": action,
                    "cost_overrun_pct": cost_overrun_pct,
                    "schedule_delay": schedule_delay,
                    "revenue_to_cost_ratio": rev_cost,
                }
            )

    alert_df = pd.DataFrame(records)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    alert_df.to_csv(output_csv, index=False)
    return alert_df
