// Static demo mode (build with VITE_STATIC_DEMO=1): answers API calls from the JSON snapshot written by
// scripts/export_static.py into /demo-data/{tenant}/. Reads work everywhere; actions the snapshot precomputed (agent runs,
// business cases, risk classification, briefing, evidence packs, suggested copilot questions) replay; decisions are read-only.

export const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === "1";
export const READ_ONLY_MSG = "This is a read-only demo. Book a live demo to run agents and approve actions.";

const BASE = `${import.meta.env.BASE_URL}demo-data`;

export class StaticMiss extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(s)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// Must match key() in scripts/export_static.py (Python urlencode == URLSearchParams for these values).
export function staticKey(path: string, params?: Record<string, unknown>): string {
  const entries = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false)
    .map(([k, v]) => [k, String(v)] as [string, string])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const q = new URLSearchParams(entries).toString();
  const slug = path.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
  return `${slug}__${fnv1a(path + (q ? `?${q}` : ""))}`;
}

const cache = new Map<string, Promise<any>>();
function load(tenant: string, name: string): Promise<any> {
  const url = `${BASE}/${tenant}/${name}.json`;
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new StaticMiss(404, "Not included in the static demo");
      return r.json();
    }));
    cache.get(url)!.catch(() => cache.delete(url));
  }
  return cache.get(url)!;
}

function auditFilter(rows: any[], p: Record<string, any>): any[] {
  return rows.filter((r) =>
    (!p.actor || r.actor_type === p.actor || r.actor_id === p.actor) &&
    (!p.agent || r.actor_id === p.agent || (r.details_json || {}).agent_id === p.agent) &&
    (!p.subject || (r.subject_id || "").toLowerCase().includes(String(p.subject).toLowerCase())) &&
    (!p.event_type || r.event_type === p.event_type) &&
    (!p.from || r.ts >= p.from) &&
    (!p.to || r.ts <= `${p.to}T23:59:59`));
}

const norm = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ").replace(/[?!. ]+$/, "");

export async function staticRequest(tenant: string, method: string, path: string, body?: any, params?: Record<string, unknown>): Promise<any> {
  if (method === "GET") {
    if (path === "/audit") {
      const all = await load(tenant, staticKey("/audit", { limit: 1000 }));
      const items = auditFilter(all.items, params || {});
      return { items, total: items.length };
    }
    try {
      return await load(tenant, staticKey(path, params));
    } catch {
      return load(tenant, staticKey(path)); // e.g. a parameter combination that was not exported
    }
  }
  if (method === "POST" && path === "/agents/run") {
    const runs = await load(tenant, "_runs");
    const p = Object.entries(body?.params || {}).filter(([, v]) => v);
    const out = runs[p.length ? `${body.agent_id}|${p.map(([k, v]) => `${k}=${v}`).join("&")}` : body.agent_id];
    if (out) return out;
  }
  if (method === "POST" && path === "/briefing/generate") return load(tenant, "_briefing");
  if (method === "POST" && path === "/evidence/pack") {
    const pack = (await load(tenant, "_evidence"))[body?.regulation_or_policy_id];
    if (pack) return pack;
  }
  if (method === "POST" && path === "/copilot/ask") {
    const answers = await load(tenant, "_copilot");
    const users = (body?.history || []).filter((m: any) => m.role === "user");
    const prev = users.length ? norm(users[users.length - 1].content) : null;
    const a = (prev && answers[`${prev}||${norm(body.question)}`]) || answers[norm(body.question)];
    return a || {
      answer: "The static demo answers the suggested questions and these follow-ups: “Who owns them?”, “How much do they cost?”, " +
        "“And which of those are high risk?”. Book a live demo to ask anything about your own estate.",
      citations: [], mode: "static", duration_ms: 0,
    };
  }
  throw new StaticMiss(403, READ_ONLY_MSG);
}

export function staticUrl(tenant: string, path: string, params?: Record<string, unknown>): string {
  if (path === "/audit/export") return `${BASE}/${tenant}/audit_${tenant}.${params?.format === "csv" ? "csv" : "json"}`;
  return "#";
}
