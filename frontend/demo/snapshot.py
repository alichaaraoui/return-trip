"""Snapshot the running Return Trip backend into demo/snapshot.json for the static online demo.

Reads only, except one agent question (the demo prompt) asked in Approval mode, which can queue
an action but never writes to Meridian. Run with the backend on localhost:5050:
    python3 frontend/demo/snapshot.py
"""
import json
import urllib.request
from pathlib import Path

API = "http://localhost:5050"
MERIDIAN = "https://d1vzgyu7me9lgj.cloudfront.net"
DEMO_MERIDIAN = "/return-trip/meridian.html#"
SUGGESTION = "Which trucks drive home empty from Dallas, and what could they carry?"


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


assert call("GET", "/api/mode")["mode"] == "approval", "switch the backend to Approval mode first"
snap = {}
for path in ["/api/network", "/api/actions", "/api/audit", "/api/email/inbox", "/api/email/outbox",
             "/api/email/samples", "/api/mode", "/api/carriers"]:
    snap["GET " + path] = call("GET", path)
for e in snap["GET /api/email/inbox"]["items"]:
    snap[f"GET /api/email/{e['email_id']}"] = call("GET", f"/api/email/{e['email_id']}")

# carrier rankings for the open loads' new loads
tours = json.loads((Path(__file__).parent.parent / "mocks" / "tours.json").read_text())["items"]
ranks = {}
for t in tours:
    for leg in t["legs"]:
        if leg.get("status") == "needs_carrier" and leg.get("shipment_id"):
            ranks[leg["shipment_id"]] = call("POST", "/api/carriers/rank", {"shipment_id": leg["shipment_id"]})
snap["ranks"] = ranks

# one real answer from the agent, replayed for the suggested question
snap["chat"] = {SUGGESTION: call("POST", "/api/agent/chat", {"message": SUGGESTION})}
snap["GET /api/actions"] = call("GET", "/api/actions")  # after the question, in case it queued one
snap["GET /api/audit"] = call("GET", "/api/audit")

# Meridian links point at the stand-in page that ships with the demo
text = json.dumps(snap).replace(MERIDIAN, DEMO_MERIDIAN)
out = Path(__file__).parent / "snapshot.json"
out.write_text(text)
print("snapshot:", len(text) // 1024, "KB,", len(snap), "entries")
