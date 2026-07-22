#!/usr/bin/env python3
"""AutoPoC Test Script for MCPSpend"""
import json, os, sys, time, urllib.request, urllib.error

API_URL = os.environ.get("API_URL", "http://mcpspend-api.poc-mcpspend.svc.cluster.local:4000")
DASH_URL = os.environ.get("DASH_URL", "http://mcpspend-dashboard.poc-mcpspend.svc.cluster.local:3000")
MAX_RETRIES = 5
RETRY_DELAY = 10
results = []

def test_scenario(name, description, method, url, body=None,
                  expected_status=200, expected_content=None, timeout=30):
    start = time.time()
    for attempt in range(MAX_RETRIES):
        try:
            if body:
                data = json.dumps(body).encode() if isinstance(body, dict) else body.encode()
                req = urllib.request.Request(url, data=data, method=method)
                req.add_header("Content-Type", "application/json")
            else:
                req = urllib.request.Request(url, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                status = resp.status
                response_body = resp.read().decode()
                if status == expected_status:
                    if expected_content and expected_content not in response_body:
                        r = {"scenario_name": name, "status": "fail",
                             "output": response_body[:2000],
                             "error_message": f"Expected '{expected_content}' not in response",
                             "duration_seconds": round(time.time()-start, 2)}
                    else:
                        r = {"scenario_name": name, "status": "pass",
                             "output": response_body[:2000], "error_message": None,
                             "duration_seconds": round(time.time()-start, 2)}
                    results.append(r); return r
                elif attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY); continue
                else:
                    r = {"scenario_name": name, "status": "fail",
                         "output": response_body[:2000],
                         "error_message": f"Expected {expected_status}, got {status}",
                         "duration_seconds": round(time.time()-start, 2)}
                    results.append(r); return r
        except urllib.error.URLError as e:
            if attempt < MAX_RETRIES - 1:
                print(f"  Retry {attempt+1}/{MAX_RETRIES}: {e}", file=sys.stderr)
                time.sleep(RETRY_DELAY)
            else:
                r = {"scenario_name": name, "status": "error", "output": "",
                     "error_message": f"Unreachable after {MAX_RETRIES} attempts: {e}",
                     "duration_seconds": round(time.time()-start, 2)}
                results.append(r); return r
        except Exception as e:
            r = {"scenario_name": name, "status": "error", "output": "",
                 "error_message": str(e),
                 "duration_seconds": round(time.time()-start, 2)}
            results.append(r); return r

# Scenario 1: API Health Check
test_scenario("api-health", "API health endpoint", "GET",
              f"{API_URL}/health", expected_content='"status":"ok"')

# Scenario 2: Dashboard Load
test_scenario("dashboard-load", "Dashboard serves HTML", "GET",
              f"{DASH_URL}/", expected_content="</html>")

# Scenario 3: API Public Status
test_scenario("api-public-status", "API public status endpoint", "GET",
              f"{API_URL}/api/public/status")

print(json.dumps({"results": results}, indent=2))
sys.exit(1 if any(r["status"] in ("fail", "error") for r in results) else 0)
