"""Export a read-only static snapshot of the demo for hosting without a backend (S3 + CloudFront, any CDN).

    python scripts/export_static.py --out frontend/dist/demo-data      (or: make static)

Generates both tenants from the seed into a temporary directory, precomputes the actions the UI offers (agent runs,
business cases, risk classification, briefing, evidence packs, copilot answers) and then writes every GET response the
UI asks for to `{out}/{tenant}/{key}.json`. The file key is `slug(path)__fnv1a(path?sorted-query)`; the frontend computes
the same key in `src/api/static.ts` when it is built with `VITE_STATIC_DEMO=1`.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "backend"), str(ROOT)]

_TMP = Path(tempfile.mkdtemp(prefix="arch_static_"))
os.environ["DATA_DIR"] = str(_TMP)
os.environ["LLM_MODE"] = "mock"

from app.config import TENANTS, settings  # noqa: E402

settings.data_dir = _TMP
settings.llm_mode = "mock"

FOLLOW_UPS = ["Who owns them?", "How much do they cost?", "And which of those are high risk?"]


def fnv1a(s: str) -> str:
    h = 0x811C9DC5
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def key(path: str, params: dict | None = None) -> str:
    p = {k: str(v).lower() if isinstance(v, bool) else str(v) for k, v in (params or {}).items() if v not in (None, "", False)}
    q = urlencode(sorted(p.items()))
    slug = re.sub(r"[^A-Za-z0-9]+", "_", path).strip("_")[:80]
    return f"{slug}__{fnv1a(path + ('?' + q if q else ''))}"


class Exporter:
    def __init__(self, client, tenant: str, out: Path) -> None:  # noqa: ANN001
        self.c, self.t, self.dir = client, tenant, out / tenant
        self.dir.mkdir(parents=True, exist_ok=True)
        self.h = {"X-Tenant-Id": tenant}
        self.n = 0
        self.record_ids: set[str] = set()

    def get(self, path: str, params: dict | None = None):  # noqa: ANN201
        r = self.c.get("/api/v1" + path, headers=self.h, params={k: v for k, v in (params or {}).items() if v not in (None, "")})
        if r.status_code != 200:
            print(f"  skip {path} {params or ''}: {r.status_code}")
            return None
        data = r.json()
        self.write(key(path, params), data)
        self.record_ids |= set(re.findall(r'"record_id": ?"([^"]+)"', json.dumps(data)))
        return data

    def post(self, path: str, body: dict):  # noqa: ANN201
        r = self.c.post("/api/v1" + path, headers=self.h, json=body)
        return r.json() if r.status_code == 200 else None

    def write(self, name: str, data) -> None:  # noqa: ANN001
        (self.dir / f"{name}.json").write_text(json.dumps(data, default=str, separators=(",", ":")))
        self.n += 1

    def actions(self) -> None:
        """Precompute POST results first, so the runs and approvals they create appear in the GET snapshot."""
        agents = self.c.get("/api/v1/agents", headers=self.h).json()
        agents = agents["items"] if isinstance(agents, dict) else agents
        runs: dict[str, dict] = {}
        for a in agents:
            if a.get("runnable") and not a.get("params_spec") and a.get("enabled", True):
                out = self.post("/agents/run", {"agent_id": a["id"], "params": {}})
                if out:
                    runs[a["id"]] = out
        for o in self.c.get("/api/v1/portfolio/overlaps", headers=self.h).json().get("items", []):
            cid = o.get("cluster_id") or o.get("id")
            out = self.post("/agents/run", {"agent_id": "pf.business_case_builder", "params": {"cluster_id": cid}})
            if out:
                runs[f"pf.business_case_builder|cluster_id={cid}"] = out
        for u in self.c.get("/api/v1/ai/usecases", headers=self.h).json().get("items", []):
            out = self.post("/agents/run", {"agent_id": "dai.ai_risk_classifier", "params": {"usecase_id": u["id"]}})
            if out:
                runs[f"dai.ai_risk_classifier|usecase_id={u['id']}"] = out
        self.write("_runs", runs)
        self.write("_briefing", self.post("/briefing/generate", {}))
        regs = self.c.get("/api/v1/evidence/regulations", headers=self.h).json()
        packs = {}
        for rid in [*regs.get("regulations", []), *[p["id"] for p in regs.get("policies", [])]]:
            rid = rid["id"] if isinstance(rid, dict) else rid
            packs[rid] = self.post("/evidence/pack", {"regulation_or_policy_id": rid})
        self.write("_evidence", packs)
        answers = {}
        for q in self.c.get("/api/v1/copilot/suggestions", headers=self.h).json():
            a = self.post("/copilot/ask", {"question": q, "history": []})
            answers[norm(q)] = a
            for f in FOLLOW_UPS:
                hist = [{"role": "user", "content": q}, {"role": "assistant", "content": a["answer"]}]
                answers[norm(q) + "||" + norm(f)] = self.post("/copilot/ask", {"question": f, "history": hist})
        self.write("_copilot", answers)

    def reads(self) -> None:
        for p in ["/users", "/config", "/metrics/dashboard", "/portfolio/discovery", "/portfolio/overlaps", "/portfolio/lifecycle",
                  "/portfolio/savings", "/ai/assets", "/ai/risk-summary", "/app/drift", "/data/policy-findings", "/agents",
                  "/copilot/suggestions", "/evidence/regulations"]:
            self.get(p)
        apps = self.get("/portfolio/applications") or {}
        for a in apps.get("items", []):
            self.get(f"/portfolio/applications/{a['id']}")
        for u in (self.get("/ai/usecases") or {}).get("items", []):
            self.get(f"/ai/usecases/{u['id']}")
        for d in (self.get("/app/designs") or {}).get("items", []):
            self.get(f"/app/designs/{d['id']}")
        for planted in (None, True):
            for s in self.get("/raw", {"planted": planted}) or []:
                self.get(f"/raw/{s['source']}", {"planted": planted})
        users = self.c.get("/api/v1/users", headers=self.h).json()
        for status in (None, "pending"):
            self.get("/approvals", {"status": status})
            for u in users:
                self.get("/approvals", {"role": u["role"], "user_id": u["id"], "status": status})
        self.get("/audit", {"limit": 1000})
        agents = self.c.get("/api/v1/agents", headers=self.h).json()
        for a in agents["items"] if isinstance(agents, dict) else agents:
            for limit in (10, 100):
                self.get("/runs", {"agent_id": a["id"], "limit": limit})
        for rid in sorted(self.record_ids):
            self.get(f"/records/{rid}")
        for fmt in ("json", "csv"):
            r = self.c.get("/api/v1/audit/export", headers=self.h, params={"format": fmt})
            (self.dir / f"audit_{self.t}.{fmt}").write_text(r.text)


def norm(q: str) -> str:
    return re.sub(r"\s+", " ", q.strip().lower().rstrip("?!. "))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "frontend" / "dist" / "demo-data"))
    args = ap.parse_args()
    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    from app.main import app
    from fastapi.testclient import TestClient

    from data_gen.generate import generate

    for name in ("arch_office.api", "arch_office.agents", "arch_office.llm"):
        logging.getLogger(name).setLevel(logging.WARNING)
    client = TestClient(app)
    for t in TENANTS:
        print(f"[{t}] generating …")
        generate(t, int(os.environ.get("SEED", "42")), quiet=True)
        ex = Exporter(client, t, out)
        ex.actions()
        ex.reads()
        print(f"[{t}] wrote {ex.n} files")
    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    print(f"static snapshot: {out} ({size / 1e6:.1f} MB)")
    shutil.rmtree(_TMP, ignore_errors=True)


if __name__ == "__main__":
    main()
