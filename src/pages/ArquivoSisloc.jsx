import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Database, Play, ShieldCheck } from "lucide-react";
import { useErpSource } from "@/lib/ErpSourceContext";
import { invokeArchive, loadTables, STATUS_LABEL } from "@/lib/sislocArchive";
import ArchiveTablesList from "@/components/arquivo/ArchiveTablesList";
import ArchiveReadiness from "@/components/arquivo/ArchiveReadiness";

export default function ArquivoSisloc() {
  const { sources } = useErpSource();
  const [sourceId, setSourceId] = useState("");
  const [run, setRun] = useState(null);
  const [tables, setTables] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const page = await base44.entities.SislocArchiveRun.filter({}, { sort: "-created_date", limit: 1 });
    const r = page.items[0] || null;
    const t = r ? await loadTables(r.id) : [];
    setRun(r);
    setTables(t);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const guard = (label, fn) => async () => {
    setBusy(label); setError("");
    try { await fn(); } catch (e) { setError(e.message); }
    setBusy(""); refresh();
  };

  const inventory = guard("Inventariando estrutura…", () => invokeArchive({ action: "inventory", source_id: sourceId || undefined }));

  const migrate = guard("Migrando…", async () => {
    await base44.entities.SislocArchiveRun.update(run.id, { status: "migrating" });
    for (const t of tables.filter((x) => !["done", "validated"].includes(x.status))) {
      let done = false;
      while (!done) {
        setBusy(`Migrando ${t.table_name}…`);
        try { done = (await invokeArchive({ action: "extract", table_id: t.id })).done; }
        catch (e) { await base44.entities.SislocArchiveTable.update(t.id, { status: "error", last_error: e.message }); done = true; }
      }
    }
    const fresh = await loadTables(run.id);
    const migrated = fresh.reduce((s, x) => s + (x.migrated_row_count || 0), 0);
    await base44.entities.SislocArchiveRun.update(run.id, { status: fresh.some((x) => x.status === "error") ? "failed" : "migrated", total_migrated_rows: migrated });
  });

  const validate = guard("Validando…", async () => {
    let divergent = false;
    for (const t of tables.filter((x) => ["done", "divergent"].includes(x.status))) {
      setBusy(`Validando ${t.table_name}…`);
      const r = await invokeArchive({ action: "validate", table_id: t.id });
      if (!r.ok) divergent = true;
    }
    const fresh = await loadTables(run.id);
    const all = fresh.every((x) => x.status === "validated");
    await base44.entities.SislocArchiveRun.update(run.id, { status: all ? "validated" : divergent ? "divergent" : run.status, ...(all ? { validated_at: new Date().toISOString() } : {}) });
  });

  const sum = (k) => tables.reduce((s, t) => s + (t[k] || 0), 0);
  const count = (st) => tables.filter((t) => t.status === st).length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-violet-400">Preservação do legado</p>
        <h1 className="text-3xl font-semibold mt-1">Arquivo integral Sisloc</h1>
        <p className="text-gray-400 mt-2 text-sm max-w-2xl">Inventário da estrutura, cópia integral em lotes versionados e privados, validação contra a origem e liberação para desligamento.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="bg-gray-900 border border-gray-800 rounded-md px-3 h-9 text-sm">
          <option value="">Matriz (padrão)</option>
          {(sources || []).filter((s) => s.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Button size="sm" variant="outline" className="bg-transparent border-gray-700 text-gray-200 hover:bg-gray-800" disabled={!!busy} onClick={inventory}><Database className="w-4 h-4 mr-1" />Novo inventário</Button>
        {run && <Button size="sm" disabled={!!busy || !tables.length} onClick={migrate}><Play className="w-4 h-4 mr-1" />Migrar / retomar</Button>}
        {run && <Button size="sm" variant="outline" className="bg-transparent border-gray-700 text-gray-200 hover:bg-gray-800" disabled={!!busy || !count("done") && !count("divergent")} onClick={validate}><ShieldCheck className="w-4 h-4 mr-1" />Validar</Button>}
        {busy && <span className="flex items-center gap-2 text-sm text-violet-300"><Loader2 className="w-4 h-4 animate-spin" />{busy}</span>}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!run ? <p className="text-gray-500 text-sm">Nenhum inventário ainda. Selecione a fonte e inicie o inventário.</p> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[["Versão", run.version], ["Status", STATUS_LABEL[run.status]], ["Tabelas", tables.length],
              ["Linhas Sisloc (est.)", sum("source_row_count").toLocaleString("pt-BR")], ["Linhas migradas", sum("migrated_row_count").toLocaleString("pt-BR")]].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <p className="text-xs text-gray-500">{l}</p><p className="text-lg font-semibold mt-1 truncate">{v}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">Validadas {count("validated")} · Carregadas {count("done")} · Divergentes {count("divergent")} · Erros {count("error")} · Pendentes {count("pending") + count("extracting")}</p>
          {run.limitations?.length > 0 && (
            <details className="text-sm text-amber-300/80"><summary className="cursor-pointer">{run.limitations.length} limitações de extração identificadas</summary>
              <ul className="mt-2 space-y-1 text-xs text-gray-400">{run.limitations.map((l) => <li key={l}>{l}</li>)}</ul></details>
          )}
          <div className="grid lg:grid-cols-[1fr_340px] gap-6">
            <ArchiveTablesList tables={tables} />
            <ArchiveReadiness run={run} tables={tables} onChange={refresh} />
          </div>
        </>
      )}
    </div>
  );
}