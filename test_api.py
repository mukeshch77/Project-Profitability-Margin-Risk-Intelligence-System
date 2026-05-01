#!/usr/bin/env python
"""
Test script to validate all FastAPI endpoints.

Usage:
    python test_api.py [--url <base_url>]

Default URL: https://project-profitability-margin-risk.onrender.com
"""

import sys
import argparse
import json
from typing import Optional, Dict, Any
import requests
from datetime import datetime


class APITester:
    """Test all FastAPI endpoints with proper error handling and logging."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.results = []
        self.created_project_id = None

    def log(self, level: str, message: str) -> None:
        """Print formatted log message."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        colors = {
            "INFO": "\033[94m",    # Blue
            "SUCCESS": "\033[92m",  # Green
            "FAILURE": "\033[91m",  # Red
            "WARNING": "\033[93m",  # Yellow
            "RESET": "\033[0m",     # Reset
        }
        color = colors.get(level, colors["RESET"])
        print(f"{color}[{timestamp}] [{level}]{colors['RESET']} {message}")

    def test_endpoint(
        self,
        method: str,
        endpoint: str,
        name: str,
        json_data: Optional[Dict[str, Any]] = None,
        expected_status: int = 200,
    ) -> Optional[Dict[str, Any]]:
        """Test a single endpoint and return response data."""
        url = f"{self.base_url}{endpoint}"
        
        try:
            self.log("INFO", f"Testing {method} {endpoint}")
            
            if method == "GET":
                response = self.session.get(url, timeout=10)
            elif method == "POST":
                response = self.session.post(url, json=json_data, timeout=10)
            else:
                self.log("FAILURE", f"Unknown HTTP method: {method}")
                return None

            # Check status code
            if response.status_code == expected_status:
                self.log(
                    "SUCCESS",
                    f"{name} | Status: {response.status_code}",
                )
                try:
                    data = response.json()
                    self.log("INFO", f"Response: {json.dumps(data, indent=2)[:200]}...")
                    self.results.append(
                        {
                            "endpoint": endpoint,
                            "method": method,
                            "status": response.status_code,
                            "success": True,
                        }
                    )
                    return data
                except json.JSONDecodeError:
                    self.log("WARNING", "Response is not valid JSON")
                    return None
            else:
                self.log(
                    "FAILURE",
                    f"{name} | Expected: {expected_status}, Got: {response.status_code}",
                )
                try:
                    error_data = response.json()
                    self.log("INFO", f"Error: {json.dumps(error_data, indent=2)}")
                except json.JSONDecodeError:
                    self.log("INFO", f"Response: {response.text[:200]}")
                
                self.results.append(
                    {
                        "endpoint": endpoint,
                        "method": method,
                        "status": response.status_code,
                        "success": False,
                    }
                )
                return None

        except requests.exceptions.Timeout:
            self.log("FAILURE", f"{name} | Request timeout (10s)")
            self.results.append(
                {
                    "endpoint": endpoint,
                    "method": method,
                    "status": None,
                    "success": False,
                    "error": "Timeout",
                }
            )
            return None
        except requests.exceptions.ConnectionError as e:
            self.log("FAILURE", f"{name} | Connection error: {e}")
            self.results.append(
                {
                    "endpoint": endpoint,
                    "method": method,
                    "status": None,
                    "success": False,
                    "error": "ConnectionError",
                }
            )
            return None
        except Exception as e:
            self.log("FAILURE", f"{name} | Unexpected error: {e}")
            self.results.append(
                {
                    "endpoint": endpoint,
                    "method": method,
                    "status": None,
                    "success": False,
                    "error": str(e),
                }
            )
            return None

    def run_all_tests(self) -> None:
        """Run all endpoint tests."""
        self.log("INFO", f"Starting API tests for {self.base_url}")
        print()

        # 1. Test root endpoint
        self.test_endpoint("GET", "/", "Root Endpoint")
        print()

        # 2. Test health endpoint
        self.test_endpoint("GET", "/health", "Health Check Endpoint")
        print()

        # 3. Test predict endpoint
        predict_payload = {
            "budget": 100000.0,
            "actual_cost": 120000.0,
            "team_size": 5,
            "schedule_delay": 15.0,
            "labor_cost": 80000.0,
            "resource_utilization": 0.85,
            "project_duration": 6.0,
        }
        predict_response = self.test_endpoint(
            "POST", "/predict", "Predict Endpoint", predict_payload
        )
        if predict_response and "project_id" not in predict_response:
            # Extract project_id from database if possible
            self.log("WARNING", "Response doesn't contain project_id, will skip /explain test")
        print()

        # 4. Test simulate endpoint
        simulate_payload = {
            "budget": 150000.0,
            "actual_cost": 155000.0,
            "team_size": 8,
            "schedule_delay": 5.0,
            "labor_cost": 100000.0,
            "resource_utilization": 0.9,
            "project_duration": 4.0,
        }
        self.test_endpoint(
            "POST", "/simulate", "Simulate Endpoint", simulate_payload
        )
        print()

        # 5. Test profit-drivers endpoint
        self.test_endpoint("GET", "/profit-drivers", "Profit Drivers Endpoint")
        print()

        # 6. Test watchlist endpoint
        self.test_endpoint("GET", "/watchlist", "Watchlist Endpoint")
        print()

        # 7. Test alerts endpoint
        self.test_endpoint("GET", "/alerts", "Alerts Endpoint")
        print()

        # 8. Test explain endpoint (requires a project_id)
        # First, try to get the latest project from database via watchlist
        watchlist = self.test_endpoint("GET", "/watchlist", "Watchlist (for project_id)")
        project_id = None
        if watchlist and "rows" in watchlist and len(watchlist["rows"]) > 0:
            project_id = watchlist["rows"][0].get("project_id")
        
        if project_id:
            self.test_endpoint(
                "GET", f"/explain/{project_id}", f"Explain Endpoint (project_id={project_id})"
            )
        else:
            self.log("WARNING", "No project_id found, skipping /explain/{project_id} test")
        print()

        # 9. Test shap-summary endpoint
        self.test_endpoint("GET", "/shap-summary", "SHAP Summary Endpoint")
        print()

        # Print summary
        self._print_summary()

    def _print_summary(self) -> None:
        """Print test results summary."""
        print("\n" + "=" * 70)
        self.log("INFO", "TEST SUMMARY")
        print("=" * 70)

        total = len(self.results)
        passed = sum(1 for r in self.results if r["success"])
        failed = total - passed

        print(f"\nTotal Tests:   {total}")
        print(f"Passed:        {passed} ✓")
        print(f"Failed:        {failed} ✗")
        print(f"Success Rate:  {(passed / total * 100):.1f}%\n")

        if failed > 0:
            print("Failed Endpoints:")
            for result in self.results:
                if not result["success"]:
                    error_info = f" ({result.get('error', '')})" if result.get("error") else ""
                    print(
                        f"  - {result['method']} {result['endpoint']} "
                        f"[{result.get('status', 'N/A')}]{error_info}"
                    )

        print("=" * 70)
        return failed == 0


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Test all FastAPI endpoints",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python test_api.py
  python test_api.py --url http://localhost:8000
  python test_api.py --url https://project-profitability-margin-risk.onrender.com
        """,
    )
    parser.add_argument(
        "--url",
        type=str,
        default="https://project-profitability-margin-risk.onrender.com",
        help="Base URL of the API (default: https://project-profitability-margin-risk.onrender.com)",
    )

    args = parser.parse_args()

    tester = APITester(args.url)
    try:
        tester.run_all_tests()
        # Exit with code 0 if all tests passed, 1 if any failed
        sys.exit(0 if all(r["success"] for r in tester.results) else 1)
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user.")
        sys.exit(1)


if __name__ == "__main__":
    main()
