from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


TARGET = "margin_risk"


@dataclass
class Thresholds:
    q25: Dict[str, float]
    q75: Dict[str, float]
    median: Dict[str, float]


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()

    safe_budget = result["budget"].replace(0, np.nan)
    safe_actual = result["actual_cost"].replace(0, np.nan)

    result["cost_overrun_pct"] = (result["actual_cost"] - result["budget"]) / safe_budget
    result["labor_intensity"] = result["labor_cost"] / safe_actual
    result["delay_intensity"] = result["schedule_delay"] / result["project_duration"].replace(0, np.nan)
    result["efficiency_gap"] = 1.0 - result["resource_utilization"]
    result["revenue_to_cost_ratio"] = result["revenue"] / safe_actual

    return result


def compute_thresholds(df: pd.DataFrame, columns: List[str]) -> Thresholds:
    q25 = {col: float(df[col].quantile(0.25)) for col in columns}
    q75 = {col: float(df[col].quantile(0.75)) for col in columns}
    median = {col: float(df[col].median()) for col in columns}
    return Thresholds(q25=q25, q75=q75, median=median)


def detect_root_causes(row: pd.Series, thresholds: Thresholds) -> Tuple[List[str], List[str]]:
    causes: List[str] = []
    actions: List[str] = []

    if row["cost_overrun_pct"] > thresholds.q75["cost_overrun_pct"]:
        causes.append("Cost overrun trending above normal range")
        actions.append("Freeze non-critical spend and review vendor burn rates weekly")

    if row["profit_margin"] < thresholds.q25["profit_margin"]:
        causes.append("Profit margin dropped below healthy baseline")
        actions.append("Reprice scope changes and negotiate margin-protection clauses")

    if row["resource_utilization"] < thresholds.q25["resource_utilization"]:
        causes.append("Resource utilization is inefficient")
        actions.append("Reallocate underused team capacity to billable activities")

    if row["schedule_delay"] > thresholds.q75["schedule_delay"]:
        causes.append("Schedule delay is likely increasing overhead")
        actions.append("Run critical-path recovery plan and control scope additions")

    if row["labor_intensity"] > thresholds.q75["labor_intensity"]:
        causes.append("Labor cost intensity is elevated")
        actions.append("Audit staffing mix and reduce expensive role over-allocation")

    if row["revenue_to_cost_ratio"] < thresholds.q25["revenue_to_cost_ratio"]:
        causes.append("Revenue conversion from cost is weak")
        actions.append("Revisit billing milestones and improve invoicing cadence")

    if not causes:
        causes.append("No dominant financial stressor detected")
        actions.append("Continue weekly monitoring and maintain current controls")

    return causes[:3], actions[:3]


def derive_alert_level(risk_probability: float, row: pd.Series) -> str:
    if risk_probability >= 0.7:
        level = "Critical"
    elif risk_probability >= 0.45:
        level = "High"
    elif risk_probability >= 0.25:
        level = "Moderate"
    else:
        level = "Low"

    # Escalate one level for explicit margin erosion signals even if model probability is moderate.
    if row.get("profit_margin", 0) < 0 or row.get("cost_overrun_pct", 0) > 0.2:
        escalation = {"Low": "Moderate", "Moderate": "High", "High": "Critical", "Critical": "Critical"}
        level = escalation[level]

    return level


def build_pipeline(feature_columns: List[str]) -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), feature_columns),
        ],
        remainder="drop",
    )

    model = GradientBoostingClassifier(random_state=42)

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )
    return pipeline


def train_system(data_path: Path, output_dir: Path, model_path: Path) -> None:
    raw_df = pd.read_csv(data_path)
    df = build_features(raw_df)

    numeric_columns = [
        "budget",
        "actual_cost",
        "revenue",
        "profit",
        "profit_margin",
        "schedule_delay",
        "project_duration",
        "team_size",
        "labor_cost",
        "resource_utilization",
        "cost_overrun_pct",
        "labor_intensity",
        "delay_intensity",
        "efficiency_gap",
        "revenue_to_cost_ratio",
    ]

    feature_columns = [col for col in numeric_columns if col != TARGET and col in df.columns]

    model_df = df.dropna(subset=[TARGET]).copy()
    X = model_df[feature_columns]
    y = model_df[TARGET].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42,
        stratify=y,
    )

    pipeline = build_pipeline(feature_columns)
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    auc = roc_auc_score(y_test, y_prob)
    report = classification_report(y_test, y_pred, output_dict=True)

    thresholds = compute_thresholds(df, [
        "cost_overrun_pct",
        "profit_margin",
        "resource_utilization",
        "schedule_delay",
        "labor_intensity",
        "revenue_to_cost_ratio",
    ])

    risk_probabilities = pipeline.predict_proba(df[feature_columns])[:, 1]
    predicted_class = (risk_probabilities >= 0.5).astype(int)

    monitor_df = raw_df.copy()
    monitor_df["risk_probability"] = np.round(risk_probabilities, 4)
    monitor_df["predicted_margin_risk"] = predicted_class
    monitor_df["cost_overrun_pct"] = df["cost_overrun_pct"]
    monitor_df["labor_intensity"] = df["labor_intensity"]
    monitor_df["delay_intensity"] = df["delay_intensity"]
    monitor_df["efficiency_gap"] = df["efficiency_gap"]
    monitor_df["revenue_to_cost_ratio"] = df["revenue_to_cost_ratio"]

    root_causes: List[str] = []
    actions: List[str] = []
    alert_levels: List[str] = []

    for idx, row in monitor_df.iterrows():
        causes, recommended_actions = detect_root_causes(row, thresholds)
        root_causes.append(" | ".join(causes))
        actions.append(" | ".join(recommended_actions))
        alert_levels.append(derive_alert_level(float(row["risk_probability"]), row))

    monitor_df["alert_level"] = alert_levels
    monitor_df["root_causes"] = root_causes
    monitor_df["recommended_actions"] = actions

    perm = permutation_importance(
        pipeline,
        X_test,
        y_test,
        n_repeats=10,
        random_state=42,
        scoring="roc_auc",
    )
    driver_df = pd.DataFrame(
        {
            "feature": feature_columns,
            "importance_mean": perm.importances_mean,
            "importance_std": perm.importances_std,
        }
    ).sort_values("importance_mean", ascending=False)

    output_dir.mkdir(parents=True, exist_ok=True)

    monitor_df.sort_values("risk_probability", ascending=False).to_csv(
        output_dir / "project_health_alerts.csv", index=False
    )

    monitor_df[monitor_df["alert_level"].isin(["Critical", "High"])].sort_values(
        "risk_probability", ascending=False
    ).to_csv(output_dir / "priority_risk_watchlist.csv", index=False)

    driver_df.to_csv(output_dir / "global_profitability_drivers.csv", index=False)

    artifacts = {
        "feature_columns": feature_columns,
        "thresholds": {
            "q25": thresholds.q25,
            "q75": thresholds.q75,
            "median": thresholds.median,
        },
    }

    joblib.dump({"pipeline": pipeline, "artifacts": artifacts}, model_path)

    metrics = {
        "roc_auc": round(float(auc), 4),
        "classification_report": report,
        "dataset_rows": int(len(raw_df)),
        "high_or_critical_alerts": int((monitor_df["alert_level"].isin(["High", "Critical"]).sum())),
        "critical_alerts": int((monitor_df["alert_level"] == "Critical").sum()),
    }

    with (output_dir / "model_metrics.json").open("w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print("Training complete")
    print(f"ROC-AUC: {metrics['roc_auc']}")
    print(f"Alerts (High/Critical): {metrics['high_or_critical_alerts']}")
    print(f"Critical alerts: {metrics['critical_alerts']}")
    print(f"Outputs saved in: {output_dir}")


def score_new_data(data_path: Path, model_path: Path, output_path: Path) -> None:
    bundle = joblib.load(model_path)
    pipeline: Pipeline = bundle["pipeline"]
    artifacts = bundle["artifacts"]

    raw_df = pd.read_csv(data_path)
    df = build_features(raw_df)

    feature_columns = artifacts["feature_columns"]

    # Keep scoring robust when incoming files miss expected fields.
    for col in feature_columns:
        if col not in df.columns:
            df[col] = np.nan

    risk_probabilities = pipeline.predict_proba(df[feature_columns])[:, 1]
    predicted_class = (risk_probabilities >= 0.5).astype(int)

    thresholds = Thresholds(
        q25=artifacts["thresholds"]["q25"],
        q75=artifacts["thresholds"]["q75"],
        median=artifacts["thresholds"]["median"],
    )

    scored_df = raw_df.copy()
    scored_df["risk_probability"] = np.round(risk_probabilities, 4)
    scored_df["predicted_margin_risk"] = predicted_class
    scored_df["cost_overrun_pct"] = df["cost_overrun_pct"]
    scored_df["labor_intensity"] = df["labor_intensity"]
    scored_df["delay_intensity"] = df["delay_intensity"]
    scored_df["efficiency_gap"] = df["efficiency_gap"]
    scored_df["revenue_to_cost_ratio"] = df["revenue_to_cost_ratio"]

    root_causes: List[str] = []
    actions: List[str] = []
    alert_levels: List[str] = []

    for idx, row in scored_df.iterrows():
        causes, recommended_actions = detect_root_causes(row, thresholds)
        root_causes.append(" | ".join(causes))
        actions.append(" | ".join(recommended_actions))
        alert_levels.append(derive_alert_level(float(row["risk_probability"]), row))

    scored_df["alert_level"] = alert_levels
    scored_df["root_causes"] = root_causes
    scored_df["recommended_actions"] = actions

    output_path.parent.mkdir(parents=True, exist_ok=True)
    scored_df.sort_values("risk_probability", ascending=False).to_csv(output_path, index=False)

    print(f"Scoring complete. Saved: {output_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Project Profitability & Margin Risk Intelligence System"
    )
    parser.add_argument(
        "--mode",
        choices=["train", "score"],
        default="train",
        help="train builds model and monitoring outputs; score applies a saved model to new data",
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=Path("project_profitability_dataset.csv"),
        help="Path to input CSV data",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("outputs"),
        help="Directory for training outputs",
    )
    parser.add_argument(
        "--model-path",
        type=Path,
        default=Path("outputs") / "margin_risk_model.joblib",
        help="Path to model artifact",
    )
    parser.add_argument(
        "--score-output",
        type=Path,
        default=Path("outputs") / "scored_projects.csv",
        help="CSV path for scored projects in score mode",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.mode == "train":
        train_system(args.data, args.output_dir, args.model_path)
    else:
        score_new_data(args.data, args.model_path, args.score_output)


if __name__ == "__main__":
    main()
