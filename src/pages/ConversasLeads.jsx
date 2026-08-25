import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, RefreshCw, MessageSquare } from "lucide-react";
import ConversasStageCards from "@/components/conversas/ConversasStageCards";
import ConversasLeadsTable from "@/components/conversas/ConversasLeadsTable";
import { exportConversasLeadsCsv } from "@/components/conversas/conversasLeadsExport";
import { stageLabel } from "@/components/conversas/conversasStages";

export default function ConversasLeads() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("listConversasLeads", { months });
      if (res?.data?.error) throw new Error(res.data.error);
      setData(res.data);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const all = data?.leads || [];
  const q = search.trim().toLowerCase();
  const rows = all.filter(
    (r) =>
      (stage == null || r.stage === stage) &&
      (!q || `${r.nome} ${r.telefone}`.toLowerCase().includes(q))
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" /> RD Conversas — Leads que entraram em contato
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Classificação por tabulação do atendimento e comportamento no WhatsApp/Instagram. O conteúdo das mensagens
            não é liberado pela API do RD Conversas (exige chave de criptografia do plano Advanced).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2"
          >
            {[3, 6, 12, 24].map((m) => (
              <option key={m} value={m}>{`Últimos ${m} meses`}</option>
            ))}
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Carregando..." : "Carregar do RD Conversas"}
          </button>
          <button
            onClick={() => exportConversasLeadsCsv(rows, `rd-conversas-leads-${months}m.csv`)}
            disabled={!rows.length}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-sm rounded-lg px-4 py-2"
          >
            <Download className="w-4 h-4" /> Exportar Excel (CSV)
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-xl p-4">{error}</div>
      )}

      {!data && !loading && !error && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-sm text-gray-400">
          Escolha o período e clique em “Carregar do RD Conversas”.
        </div>
      )}

      {data && (
        <>
          <ConversasStageCards byStage={data.by_stage} selected={stage} onSelect={setStage} total={all.length} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {data.attendances} atendimentos · {all.length} leads únicos · mostrando {rows.length}
              {stage ? ` · ${stageLabel(stage)}` : ""}
            </p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 w-64"
            />
          </div>
          <ConversasLeadsTable rows={rows} />
        </>
      )}
    </div>
  );
}