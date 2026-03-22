import json
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"


def req(path: str, method: str = "GET", payload: dict | None = None) -> dict:
    data = None
    headers: dict[str, str] = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    t0 = time.perf_counter()

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            ms = (time.perf_counter() - t0) * 1000
            body = response.read().decode("utf-8")
            parsed = json.loads(body)
            return {"status": response.status, "ms": round(ms, 2), "body": parsed}
    except urllib.error.HTTPError as exc:
        ms = (time.perf_counter() - t0) * 1000
        raw = exc.read().decode("utf-8")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = raw
        return {"status": exc.code, "ms": round(ms, 2), "body": parsed}


def main() -> None:
    low = {
        "budget": 120000,
        "actual_cost": 100000,
        "team_size": 8,
        "schedule_delay": 1,
        "labor_cost": 20000,
        "resource_utilization": 0.9,
        "project_duration": 8,
        "revenue": 130000,
        "profit": 30000,
        "profit_margin": 0.2307,
    }
    medium = {
        "budget": 120000,
        "actual_cost": 126000,
        "team_size": 7,
        "schedule_delay": 8,
        "labor_cost": 42000,
        "resource_utilization": 0.68,
        "project_duration": 7,
        "revenue": 130000,
        "profit": 4000,
        "profit_margin": 0.0307,
    }
    high = {
        "budget": 120000,
        "actual_cost": 180000,
        "team_size": 5,
        "schedule_delay": 20,
        "labor_cost": 95000,
        "resource_utilization": 0.45,
        "project_duration": 6,
        "revenue": 160000,
        "profit": -20000,
        "profit_margin": -0.125,
    }

    invalid_missing = {"budget": 100000}
    invalid_values = {
        "budget": -1,
        "actual_cost": 0,
        "team_size": 0,
        "schedule_delay": -5,
        "labor_cost": -2,
        "resource_utilization": 1.8,
        "project_duration": 0,
    }
    invalid_types = {
        "budget": "abc",
        "actual_cost": "xyz",
        "team_size": "8",
        "schedule_delay": "foo",
        "labor_cost": "bar",
        "resource_utilization": "baz",
        "project_duration": "q",
    }

    cases = [
        ("health", req("/health")),
        ("predict_low", req("/predict", "POST", low)),
        ("predict_medium", req("/predict", "POST", medium)),
        ("predict_high", req("/predict", "POST", high)),
        ("watchlist", req("/watchlist")),
        ("alerts", req("/alerts")),
        ("profit_drivers", req("/profit-drivers")),
        ("explain_1", req("/explain/1")),
        ("explain_missing", req("/explain/999999")),
        ("shap_summary", req("/shap-summary")),
        ("predict_missing_fields", req("/predict", "POST", invalid_missing)),
        ("predict_invalid_values", req("/predict", "POST", invalid_values)),
        ("predict_invalid_types", req("/predict", "POST", invalid_types)),
    ]

    print(json.dumps(cases, indent=2))


if __name__ == "__main__":
    main()
