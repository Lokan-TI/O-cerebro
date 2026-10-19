import { base44 } from "@/api/base44Client";

const E = () => base44.entities;

export async function saveRun({ sourceKey, tipos, startedAt, status, results }) {
  const counts = results.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {});
  const me = await base44.auth.me();
  const run = await E().CnpjCorrectionRun.create({
    source_key: sourceKey, tipos, started_at: startedAt, finished_at: new Date().toISOString(), status,
    total: results.length, counts, diff_count: results.reduce((n, r) => n + (r.diffs?.length || 0), 0), performed_by: me?.email,
  });
  for (let i = 0; i < results.length; i += 200) {
    await E().CnpjCorrectionResult.bulkCreate(results.slice(i, i + 200).map((r) => ({ ...r, run_id: run.id })));
  }
  return run;
}

export async function listRuns() {
  const page = await E().CnpjCorrectionRun.list({ sort: "-started_at", limit: 50 });
  return page.items;
}

export async function runResults(runId) {
  const out = [];
  let cursor;
  do {
    const page = await E().CnpjCorrectionResult.filter({ run_id: runId }, { limit: 1000, cursor });
    out.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return out;
}

export const CMP = {
  nova: { label: "Nova divergência", cls: "text-amber-400" },
  resolvida: { label: "Resolvida", cls: "text-emerald-400" },
  alterada: { label: "Sugestão alterada", cls: "text-sky-400" },
  igual: { label: "Sem mudança", cls: "text-gray-400" },
};

export function compareRuns(a, b) {
  const idx = (list) => {
    const m = new Map();
    for (const r of list) for (const d of r.diffs || []) m.set(`${r.cd_pessoa}|${d.field}`, { r, d });
    return m;
  };
  const A = idx(a), B = idx(b), out = [];
  for (const [k, x] of B) {
    const y = A.get(k);
    const kind = !y ? "nova" : y.d.suggested === x.d.suggested && y.d.erp === x.d.erp ? "igual" : "alterada";
    out.push({ key: k, kind, row: x.r, label: x.d.label, before: y?.d, after: x.d });
  }
  for (const [k, y] of A) if (!B.has(k)) out.push({ key: k, kind: "resolvida", row: y.r, label: y.d.label, before: y.d, after: null });
  return out;
}