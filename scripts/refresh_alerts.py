import datetime
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "https://rc-v.armis.com"
AQL = 'in:alerts status:Open timeFrame:"7 Days" severity:Medium,High,Critical'


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


def main():
    secret_key = os.environ["CONSOLE_API_KEY"]

    token_resp = post_form(f"{BASE_URL}/api/v1/access_token/", {"secret_key": secret_key})
    access_token = unwrap(token_resp, ["data", "access_token"], ["access_token"])
    if not access_token:
        print(f"Could not find access_token, response keys: {list(token_resp.keys())}", file=sys.stderr)
        sys.exit(1)

    query = urllib.parse.urlencode({"aql": AQL})
    search_resp = get(f"{BASE_URL}/api/v1/search/?{query}", {"Authorization": access_token})

    results = unwrap(search_resp, ["data", "results"], ["data"], ["results"])
    if results is None:
        print(f"Could not find results, response keys: {list(search_resp.keys())}", file=sys.stderr)
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
        for item in results
    ]

    out = {
        "updatedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "alerts": alerts,
    }

    with open("mockdata.json", "w") as f:
        json.dump(out, f, indent=2)

    print(f"Wrote {len(alerts)} alerts")


if __name__ == "__main__":
    main()
