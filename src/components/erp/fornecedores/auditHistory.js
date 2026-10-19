import { base44 } from "@/api/base44Client";

const Run = () => base44.entities.EmailAuditRun;
const Res = () => base44.entities.EmailAuditResult;

// Salva uma execução completa (snapshot) sem apagar execuções anteriores.
export async function saveAuditRun({ startedAt, status, rows, sourceKey = "default" }) {
  const audited = rows.filter((r) => r.status !== "pendente");
  if (!audited.length) return;
  const counts = audited.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {});
  const me = await base44.auth.me();
  const run = await Run().create({
    source_key: sourceKey, started_at: startedAt, finished_at: new Date().toISOString(),
    status, total: audited.length, counts, performed_by: me?.email,
  });
  const recs = audited.map((r) => ({
    run_id: run.id, source_key: sourceKey, cnpj: String(r.cnpj || ""), cd_pessoa: String(r.cd_pessoa ?? ""),
    nm_pessoa: r.nm_pessoa || "", erp_email: r.email || "", found_email: r.found_email || "",
    status: r.status, error: r.erro || "",
  }));
  for (let i = 0; i < recs.length; i += 500) await Res().bulkCreate(recs.slice(i, i + 500));
  return run;
}

export async function listRuns() {
  const page = await Run().filter({}, { sort: "-started_at", limit: 100 });
  return page.items;
}

export async function loadRunResults(runId) {
  const out = [];
  let cursor;
  do {
    const page = await Res().filter({ run_id: runId }, { limit: 1000, cursor });
    out.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return out;
}

const FIXED = new Set(["corrigido", "preenchido"]);
const ERR = new Set(["erro", "nao_encontrado", "cnpj_invalido"]);

export const DIFF = {
  perdeu: { label: "Perdeu correção", cls: "text-red-400", why: "Antes havia e-mail corrigível; agora não." },
  erro_novo: { label: "Erro novo", cls: "text-amber-400", why: "A consulta falhou nesta execução (limite ou indisponibilidade da fonte)." },
  email_mudou: { label: "E-mail mudou", cls: "text-purple-300", why: "A fonte pública retornou um e-mail diferente." },
  sem_email: { label: "Fonte sem e-mail", cls: "text-gray-400", why: "A fonte respondeu, mas sem e-mail cadastrado." },
  ganhou: { label: "Nova correção", cls: "text-emerald-400", why: "Agora há e-mail corrigível que antes não havia." },
  ausente: { label: "Só em uma execução", cls: "text-sky-300", why: "O CNPJ não foi auditado em uma das execuções." },
  igual: { label: "Sem mudança", cls: "text-gray-500", why: "Mesmo status e mesmo e-mail nas duas execuções." },
};

function diffKind(a, b) {
  if (!a || !b) return "ausente";
  if (FIXED.has(a.status) && !FIXED.has(b.status)) {
    if (ERR.has(b.status)) return "erro_novo";
    if (b.status === "sem_email") return "sem_email";
    return "perdeu";
  }
  if (!ERR.has(a.status) && ERR.has(b.status)) return "erro_novo";
  if (!FIXED.has(a.status) && FIXED.has(b.status)) return "ganhou";
  if ((a.found_email || "") !== (b.found_email || "")) return "email_mudou";
  if (a.status !== b.status) return b.status === "sem_email" ? "sem_email" : "perdeu";
  return "igual";
}

export function compareRuns(listA, listB) {
  const A = new Map(listA.map((r) => [r.cnpj, r]));
  const B = new Map(listB.map((r) => [r.cnpj, r]));
  const keys = new Set([...A.keys(), ...B.keys()]);
  return [...keys].map((cnpj) => {
    const a = A.get(cnpj), b = B.get(cnpj);
    return { cnpj, nm_pessoa: (b || a).nm_pessoa, cd_pessoa: (b || a).cd_pessoa, a, b, kind: diffKind(a, b) };
  });
}