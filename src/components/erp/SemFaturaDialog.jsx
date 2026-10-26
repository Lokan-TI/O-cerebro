import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { fmtCur } from "@/lib/erpFormat";
import { Loader2 } from "lucide-react";

const br = (v) => (v && !String(v).startsWith("9999") ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const dias = (v) => (v ? Math.floor((Date.now() - new Date(v).getTime()) / 86400000) : null);

export default function SemFaturaDialog({ open, onOpenChange, sourceIds, selectedEmpresa }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setRows(null); setError(null);
    (async () => {
      const all = [];
      for (const id of sourceIds) {
        const res = await base44.functions.invoke("listContratosAbertos", { source_id: id, mode: "sem_fatura", cd_empresa: selectedEmpresa ?? undefined });
        all.push(...(res.data?.rows || []));
      }
      if (alive) setRows(all);
    })().catch((e) => alive && setError(e.response?.data?.error || e.message));
    return () => { alive = false; };
  }, [open, sourceIds.join(","), selectedEmpresa]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter((r) => !t || `${r.nm_pessoa} ${r.numero} ${r.cd_pessoa}`.toLowerCase().includes(t));
  }, [rows, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl bg-gray-950 border-gray-800 text-white" translate="no">
        <DialogHeader><DialogTitle>Contratos abertos sem fatura de locação</DialogTitle></DialogHeader>
        <p className="text-xs text-gray-400">Fichas abertas sem nenhuma fatura de locação gerada. Verifique pedido de compra e possibilidade de faturamento.</p>
        <Input placeholder="Buscar cliente ou nº da ficha…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-gray-900 border-gray-700" />
        {error ? <div className="text-sm text-red-400">Erro: {error}</div> : !rows ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" />Carregando contratos…</div>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-800">
            <table className="text-xs">
              <thead><tr><th className="text-left">Ficha</th><th className="text-left">Empresa</th><th className="text-left">Cliente</th><th>Início</th><th>1ª saída</th><th>Dias sem fatura</th><th className="text-right">Vl. mínimo</th><th className="text-left">Local</th><th className="text-left">Contato</th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={`${r.cd_empresa}-${r.cd_controle}`}>
                    <td>{String(r.numero ?? "").padStart(6, "0")}</td>
                    <td>{getEmpresaLabel(r.cd_empresa)}</td>
                    <td>{r.nm_pessoa} <span className="text-gray-500">({r.cd_pessoa})</span></td>
                    <td className="text-center">{br(r.dt_fai_ficha)}</td>
                    <td className="text-center">{br(r.dt_primeira_saida)}</td>
                    <td className="text-center">{dias(r.dt_primeira_saida || r.dt_fai_ficha) ?? "—"}</td>
                    <td className="text-right">{fmtCur(r.vl_minimo_locacao || 0)}</td>
                    <td>{[r.ci_entrega, r.uf_entrega].filter(Boolean).join("/") || "—"}</td>
                    <td>{[r.contato, r.telefone].filter(Boolean).join(" · ") || "—"}</td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={9} className="text-center text-gray-500 py-6">Nenhum contrato encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {rows && <div className="text-xs text-gray-500">{list.length} de {rows.length} contratos</div>}
      </DialogContent>
    </Dialog>
  );
}