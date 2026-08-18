import { useState, useMemo } from "react";
import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { useAnalyticsView } from "@/lib/analyticsView";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import ClientesReceitaChart from "@/components/erp/ClientesReceitaChart";
import ClientePatrimoniosModal from "@/components/erp/ClientePatrimoniosModal";
import { Users, TrendingUp, Search, Crown, FileText, Repeat, Percent } from "lucide-react";

export default function TabClientesPessoa() {
  const { snapshot, loading } = useErpSnapshot();
  const { selectedEmpresa, empresaList } = useEmpresaFilter();
  const { analytics } = useAnalyticsView();
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);

  const isAll = selectedEmpresa == null;
  const byEmp = snapshot?.by_empresa || [];
  const empRow = !isAll ? byEmp.find((e) => e.cd_empresa === selectedEmpresa) : null;
  const k = snapshot?.kpis || {};

  // Lista de clientes ativos gerando receita — snapshot (empresa-aware)
  const rawClients = isAll
    ? (snapshot?.top_clients || [])
    : (snapshot?.top_clients_by_empresa || []).filter((c) => Number(c.cd_empresa) === selectedEmpresa);

  const receitaTotal = isAll ? k.fat_ano : empRow?.fat_ano || 0;

  // Cross-ref: contratos ativos por cliente (fich_loc top 20 do analytics)
  const contratosMap = useMemo(() => {
    const m = {};
    for (const c of analytics?.fichloc_top_clientes || []) {
      m[String(c.cd_pessoa)] = { qtd: c.qtd_loc || 0, ativas: c.qtd_ativas || 0, vl_minimo: c.vl_minimo || 0 };
    }
    return m;
  }, [analytics]);

  const clients = useMemo(() => {
    const list = rawClients.map((c) => {
      const contratos = contratosMap[String(c.cd_pessoa)];
      return {
        cd_pessoa: String(c.cd_pessoa || ""),
        nm_pessoa: c.nm_pessoa || `Cliente ${c.cd_pessoa}`,
        receita: Number(c.total) || 0,
        nfs: Number(c.nfs) || 0,
        ultima_nf: c.ultima_nf || null,
        share: receitaTotal > 0 ? ((Number(c.total) || 0) / receitaTotal) * 100 : 0,
        contratos_ativos: contratos?.ativas ?? null,
        contratos_total: contratos?.qtd ?? null,
      };
    });
    return list.sort((a, b) => b.receita - a.receita);
  }, [rawClients, contratosMap, receitaTotal]);

  if (loading && !snapshot) return <div className="text-gray-500 p-8 text-center">Carregando clientes…</div>;
  if (!snapshot) return <div className="text-gray-500 p-8 text-center">Sem snapshot. Clique em "Atualizar dados" para carregar.</div>;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter((c) => c.nm_pessoa?.toLowerCase().includes(q) || String(c.cd_pessoa).includes(q))
    : clients;

  // KPIs
  // Clientes ativos = contagem distinta apurada no banco (não o tamanho da lista carregada)
  const clientesAtivos = (isAll ? k.clientes_ano : empRow?.clientes_ano) || clients.length;
  const top10Receita = clients.slice(0, 10).reduce((s, c) => s + c.receita, 0);
  const concentracao = receitaTotal > 0 ? (top10Receita / receitaTotal) * 100 : 0;
  const ticketMedio = clientesAtivos > 0 ? receitaTotal / clientesAtivos : 0;
  const comContratosAtivos = clients.filter((c) => c.contratos_ativos != null && c.contratos_ativos > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">
          Clientes ativos gerando receita ·{" "}
          <span className="text-white font-medium">
            {isAll ? "Todas (consolidado)" : getEmpresaLabel(selectedEmpresa, empRow?.nm_empresa)}
          </span>
          {" · "}dados até {snapshot.max_date || "—"}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-purple-700/40 bg-purple-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-400 uppercase">Clientes ativos</span></div>
          <div className="text-2xl font-bold text-white">{fmtNum(clientesAtivos)}</div>
          <div className="text-xs text-gray-500 mt-1">Com receita no período · {fmtNum(clients.length)} na lista</div>
        </div>
        <div className="rounded-xl border border-green-700/40 bg-green-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-green-400" /><span className="text-xs text-gray-400 uppercase">Receita total</span></div>
          <div className="text-2xl font-bold text-white">{fmtCur(receitaTotal)}</div>
          <div className="text-xs text-gray-500 mt-1">Período acumulado</div>
        </div>
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><Percent className="w-4 h-4 text-amber-400" /><span className="text-xs text-gray-400 uppercase">Concentração Top 10</span></div>
          <div className="text-2xl font-bold text-white">{concentracao.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 mt-1">{fmtCur(top10Receita)} no top 10</div>
        </div>
        <div className="rounded-xl border border-blue-700/40 bg-blue-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-blue-400" /><span className="text-xs text-gray-400 uppercase">Ticket médio/cliente</span></div>
          <div className="text-2xl font-bold text-white">{fmtCur(ticketMedio)}</div>
          <div className="text-xs text-gray-500 mt-1">Receita ÷ clientes ativos</div>
        </div>
      </div>

      {/* Evolução mensal da receita da base ativa */}
      <ClientesReceitaChart monthlyRevenue={snapshot.monthly_revenue} selectedEmpresa={selectedEmpresa} />

      {/* Lista principal — clientes ativos gerando receita */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Crown className="w-4 h-4 text-purple-400" /> Clientes ativos gerando receita
            <span className="text-gray-500 font-normal">· {fmtNum(filtered.length)} clientes</span>
          </h3>
          <input
            type="text"
            placeholder="Buscar cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 w-48"
          />
        </div>

        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left py-2 px-3">#</th>
                <th className="text-left py-2 px-3">Cliente</th>
                <th className="text-right py-2 px-3">Receita</th>
                <th className="text-right py-2 px-3">% total</th>
                <th className="text-right py-2 px-3">NFs</th>
                <th className="text-right py-2 px-3">Última NF</th>
                <th className="text-right py-2 px-3">Contratos ativos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr
                  key={`${c.cd_pessoa}-${i}`}
                  onClick={() => setSelectedClient(c)}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                >
                  <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                  <td className="py-2 px-3 text-white">
                    <div className="truncate max-w-[220px]">{c.nm_pessoa}</div>
                    <div className="text-xs text-gray-600">#{c.cd_pessoa}</div>
                  </td>
                  <td className="py-2 px-3 text-right text-green-400 font-medium">{fmtCur(c.receita)}</td>
                  <td className="py-2 px-3 text-right text-gray-400">{c.share.toFixed(1)}%</td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtNum(c.nfs)}</td>
                  <td className="py-2 px-3 text-right text-gray-400 text-xs">{c.ultima_nf || "—"}</td>
                  <td className="py-2 px-3 text-right">
                    {c.contratos_ativos == null ? (
                      <span className="text-gray-600 text-xs">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-purple-400">
                        <Repeat className="w-3 h-3" />
                        {fmtNum(c.contratos_ativos)}
                        <span className="text-gray-600 text-xs">/{fmtNum(c.contratos_total)}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center text-gray-600 py-6">Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-gray-600 flex items-center gap-1.5">
          <Search className="w-3 h-3" />
          Receita = faturamento (nf) no período. Contratos ativos cruzados com fich_loc (top 20) — clientes fora desse topo aparecem como "—". Clique em um cliente para ver os patrimônios em posse e o histórico completo.
        </div>
      </div>

      {selectedClient && (
        <ClientePatrimoniosModal client={selectedClient} onClose={() => setSelectedClient(null)} />
      )}

      {/* Distribuição por faixa de receita */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 text-sm">Distribuição por faixa de receita</h3>
        {(() => {
          const faixas = [
            { label: "Top 5", min: 0, max: 5 },
            { label: "6–10", min: 5, max: 10 },
            { label: "11–25", min: 10, max: 25 },
            { label: "26–50", min: 25, max: 50 },
            { label: "51+", min: 50, max: clients.length },
          ];
          const max = Math.max(...faixas.map((f) => clients.slice(f.min, f.max).reduce((s, c) => s + c.receita, 0)));
          return (
            <div className="space-y-2">
              {faixas.map((f) => {
                const slice = clients.slice(f.min, f.max);
                const total = slice.reduce((s, c) => s + c.receita, 0);
                const pct = max > 0 ? (total / max) * 100 : 0;
                return (
                  <div key={f.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-16">{f.label}</span>
                    <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden">
                      <div className="h-full bg-purple-600 rounded" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-green-400 w-24 text-right">{fmtCur(total)}</span>
                    <span className="text-xs text-gray-500 w-12 text-right">{slice.length} cl</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}