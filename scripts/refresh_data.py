import datetime
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "https://rc-v.armis.com"
DEVICE_FILTER = 'device:(category:Automations,"Manufacturing Equipment")'

ALERTS_AQL = f'in:alerts status:Open timeFrame:"7 Days" severity:High,Critical {DEVICE_FILTER}'
ALERTS_FIELDS = "alerts:alertId,severity,time,title,classification,type,policyLabels"

ACTIVITIES_AQL = f'in:activity timeFrame:"7 Days" {DEVICE_FILTER}'
ACTIVITIES_FIELDS = "activity:title,content,type,protocol,time,sourceIp,destinationIp,site"

POLICIES_AQL = "in:policies"

LENGTH = 50


def request_json(req):
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"HTTP {e.code} calling {req.full_url}: {body}", file=sys.stderr)
        raise


def post_form(url, fields):
    data = urllib.parse.urlencode(fields).encode()
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    return request_json(urllib.request.Request(url, data=data, headers=headers, method="POST"))


def get(url, headers):
    return request_json(urllib.request.Request(url, headers=headers, method="GET"))


def unwrap(payload, *paths):
    for path in paths:
        node = payload
        for key in path:
            if isinstance(node, dict) and key in node:
                node = node[key]
            else:
                node = None
                break
        if node is not None:
            return node
    return None


def search(access_token, aql, fields=None):
    params = {"aql": aql, "length": LENGTH}
    if fields:
        params["fields"] = fields
    query = urllib.parse.urlencode(params)
    resp = get(f"{BASE_URL}/api/v1/search/?{query}", {"Authorization": access_token})
    results = unwrap(resp, ["data", "results"], ["data"], ["results"])
    if results is None:
        print(f"Could not find results for aql={aql!r}, response keys: {list(resp.keys())}", file=sys.stderr)
        return []
    return results


def first_present(item, *keys, default=""):
    for key in keys:
        if key in item and item[key] not in (None, ""):
            return item[key]
    return default


def main():
    secret_key = os.environ["CONSOLE_API_KEY"]

    token_resp = post_form(f"{BASE_URL}/api/v1/access_token/", {"secret_key": secret_key})
    access_token = unwrap(token_resp, ["data", "access_token"], ["access_token"])
    if not access_token:
        print(f"Could not find access_token, response keys: {list(token_resp.keys())}", file=sys.stderr)
        sys.exit(1)

    alerts = [
        {
            "id": str(item.get("alertId", "")),
            "severity": item.get("severity", ""),
            "time": item.get("time", ""),
            "title": item.get("title", ""),
            "classification": item.get("classification", ""),
            "type": item.get("type", ""),
            "policyLabels": item.get("policyLabels", []),
        }
        for item in search(access_token, ALERTS_AQL, ALERTS_FIELDS)
    ]

    activities = [
        {
            "id": str(item.get("activityUUID") or item.get("id") or ""),
            "title": item.get("title", ""),
            "content": item.get("content", ""),
            "type": item.get("type", ""),
            "protocol": item.get("protocol", ""),
            "time": item.get("time", ""),
            "sourceIp": item.get("sourceIp", ""),
            "destinationIp": item.get("destinationIp", ""),
            "site": item.get("site", ""),
        }
        for item in search(access_token, ACTIVITIES_AQL, ACTIVITIES_FIELDS)
    ]

    # Policies fields aren't confirmed against docs yet, and "in:policies" may
    # not even be the right entity for the generic search endpoint - don't let
    # a failure here block alerts/activities from refreshing.
    try:
        policy_items = search(access_token, POLICIES_AQL)
    except urllib.error.HTTPError:
        policy_items = []

    policies = [
        {
            "id": str(first_present(item, "policyId", "id", "ruleId")),
            "name": first_present(item, "name", "title", "policyName", "ruleName", default="Untitled policy"),
            "description": first_present(item, "description", "content"),
        }
        for item in policy_items
    ]

    out = {
        "updatedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "alerts": alerts,
        "activities": activities,
        "policies": policies,
    }

    with open("data.json", "w") as f:
        json.dump(out, f, indent=2)

    print(f"Wrote {len(alerts)} alerts, {len(activities)} activities, {len(policies)} policies")


if __name__ == "__main__":
    main()
