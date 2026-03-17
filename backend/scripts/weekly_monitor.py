from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.risk_engine import generate_early_warning_alerts
from src.profitability_margin_risk_system import score_new_data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Weekly monitoring runner")
    parser.add_argument("--input", type=Path, default=Path("project_profitability_dataset.csv"))
    parser.add_argument("--model-path", type=Path, default=Path("outputs") / "margin_risk_model.joblib")
    parser.add_argument("--scored-output", type=Path, default=Path("outputs") / "project_health_alerts.csv")
    parser.add_argument("--alerts-output", type=Path, default=Path("outputs") / "early_warning_alerts.csv")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    score_new_data(args.input, args.model_path, args.scored_output)
    alert_df = generate_early_warning_alerts(args.scored_output, args.alerts_output)

    print("Weekly monitoring completed")
    print(f"Scored projects: {args.scored_output}")
    print(f"Early alerts generated: {len(alert_df)}")


if __name__ == "__main__":
    main()
