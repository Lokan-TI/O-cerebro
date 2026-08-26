import { useState } from "react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, Loader2, RefreshCw } from "lucide-react";

const COLS = [
  ["nome", "Nome"], ["nome_fantasia", "Nome fantasia"], ["email", "E-mail"],
  ["telefone", "Telefone"], ["celular", "Celular"], ["cpf", "CPF"], ["cnpj", "CNPJ"],
  ["cidade", "Cidade"], ["uf", "UF"], ["dt_cadastro", "Cadastro"],
  ["qtd_orcamentos", "Orçamentos"], ["dt_ultimo_orcamento", "Último orçamento"],
  ["orcamento_aprovado", "Orçamento aprovado"], ["qtd_locacoes", "Locações"],
  ["dt_ultima_locacao", "Última locação"], ["dt_ultima_devolucao", "Última devolução"],
  ["ultimo_equipamento", "Último equipamento"], ["valor_faturado", "Valor faturado"],
  ["dt_ultima_interacao", "Última interação"], ["dias_sem_interacao", "Dias sem interação"],
];

export default function EmailFlowsExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await base44.functions.invoke("segmentEmailFlows", { somente_com_email: true });
      const d = res?.data;
      if (!d?.success) throw new Error(d?.error || "Falha ao segmentar clientes.");
      setData(d);
    } catch (e) {
      setError(e.message || String(e));
    } finally { setLoading(false); }
  };

  const download = () => {
    if (!data?.rows?.length) return;
    const groups = data.rows.reduce((acc, r) => {
      (acc[r.fluxo] = acc[r.fluxo] || []).push(r);
      return acc;
    }, {});
    const wb = XLSX.utils.book_new();
    Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).forEach(([fluxo, rows]) => {
      const aoa = [COLS.map(([, l]) => l), ...rows.map((r) => COLS.map(([k]) => r[k] ?? ""))];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), fluxo.slice(0, 31));
    });
    XLSX.writeFile(wb, `fluxos-email-clientes-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const counts = data?.rows
    ? Object.entries(data.rows.reduce((a, r) => ({ ...a, [r.fluxo]: (a[r.fluxo] || 0) + 1 }), {})).sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button onClick={load} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {loading ? "Segmentando clientes…" : "Gerar segmentação"}
        </Button>
        <Button onClick={download} disabled={!data?.rows?.length} variant="outline" className="border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800 hover:text-white">
          <Download className="w-4 h-4 mr-2" /> Baixar Excel (.xlsx)
        </Button>
      </div>

      {error && <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 text-sm text-red-300">{error}</div>}

      {data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {counts.map(([fluxo, qtd]) => (
              <div key={fluxo} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 leading-snug">{fluxo}</div>
                <div className="text-2xl font-semibold text-white mt-1">{qtd.toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {data.rows.length.toLocaleString("pt-BR")} clientes com e-mail ·{" "}
            {(data.clientes_sem_email || 0).toLocaleString("pt-BR")} sem e-mail (fora do arquivo) ·{" "}
            {(data.excluidos_em_locacao_ativa || 0).toLocaleString("pt-BR")} com locação ativa (excluídos)
          </p>
        </div>
      )}
    </div>
  );
}