from __future__ import annotations

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import shap

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.risk_engine import RiskEngine


def main() -> None:
    outputs = ROOT / "outputs"
    model_path = outputs / "margin_risk_model.joblib"
    health_path = outputs / "project_health_alerts.csv"
    chart_path = outputs / "charts" / "global_shap_summary.png"

    if not model_path.exists() or not health_path.exists():
        raise FileNotFoundError("Model or project_health_alerts.csv not found")

    engine = RiskEngine(model_path)
    df = pd.read_csv(health_path)
    if df.empty:
        raise ValueError("project_health_alerts.csv is empty")

    for col in engine.feature_columns:
        if col not in df.columns:
            df[col] = pd.NA

    model_input = df[engine.feature_columns].head(300)
    transformed = engine.pipeline.named_steps["preprocessor"].transform(model_input)
    shap_values = engine.explainer.shap_values(transformed)

    chart_path.parent.mkdir(parents=True, exist_ok=True)
    plt.figure(figsize=(10, 6))
    if isinstance(shap_values, list):
        shap.summary_plot(
            shap_values[1],
            features=transformed,
            feature_names=engine.feature_columns,
            show=False,
            plot_type="bar",
        )
    else:
        shap.summary_plot(
            shap_values,
            features=transformed,
            feature_names=engine.feature_columns,
            show=False,
            plot_type="bar",
        )

    plt.tight_layout()
    plt.savefig(chart_path, dpi=150)
    plt.close()

    print(f"Saved SHAP summary chart: {chart_path}")


if __name__ == "__main__":
    main()
