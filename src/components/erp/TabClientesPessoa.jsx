import { useState, useMemo, useEffect } from "react";
import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { fetchClientesAtivos } from "@/components/erp/clientesAtivosCache";
import { useEmpresaFilter } from "@/lib/EmpresaFilterContext";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import { scopeByPeriod } from "@/lib/periodScope";
import { useAnalyticsView } from "@/lib/analyticsView";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import ClientesReceitaChart from "@/components/erp/ClientesReceitaChart";
import ClientesAtivosTable from "@/components/erp/ClientesAtivosTable";
import ClientesMesPanel from "@/components/erp/ClientesMesPanel";
import ClientePatrimoniosModal from "@/components/erp/ClientePatrimoniosModal";
import { Users, TrendingUp, Search, Crown, FileText, Repeat, Percent } from "lucide-react";

export default function TabClientesPessoa() {
  const { snapshot, loading } = useErpSnapshot();
  const { selectedEmpresa, empresaList } = useEmpresaFilter();
  const { analytics } = useAnalyticsView();
  const { period } = useGlobalFilter();
  const { selectedSource } = useErpSource();
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  // Consulta ao vivo do período aplicado — mesma query da tabela (cache compartilhado).
  const [liveRows, setLiveRows] = useState(null);
  const [liveMeta, setLiveMeta] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    setLiveLoading(true);
    const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : null;
    fetchClientesAtivos(sourceId, period.start, period.end, snapshot?.version)
      .then((d) => { if (alive) { setLiveRows(d?.rows || []); setLiveMeta(d || null); } })
      .catch(() => { if (alive) { setLiveRows(null); setLiveMeta(null); } })
      .finally(() => { if (alive) setLiveLoading(false); });
    return () => { alive = false; };
  }, [period.start, period.end, selectedSource?.id, snapshot?.version]);

  // Agrega as linhas ao vivo (empresa × cliente) no escopo da empresa selecionada.
  const live = useMemo(() => {
    if (!liveRows) return null;
    const scoped = selectedEmpresa == null
      ? liveRows
      : liveRows.filter((r) => Number(r.cd_empresa) === Number(selectedEmpresa));
    const byClient = {};
    let receita = 0;
    for (const r of scoped) {
      receita += Number(r.receita) || 0;
      byClient[r.cd_pessoa] = (byClient[r.cd_pessoa] || 0) + (Number(r.receita) || 0);
    }
    const valores = Object.values(byClient).sort((a, b) => b - a);
    const top10 = valores.slice(0, 10).reduce((s, v) => s + v, 0);
    const fiscal = selectedEmpresa == null
      ? Number(liveMeta?.faturamento_fiscal_total || 0)
      : Number((liveMeta?.fiscal_by_empresa || []).find((r) => Number(r.cd_empresa) === Number(selectedEmpresa))?.faturamento_fiscal || 0);
    const semCliente = selectedEmpresa == null
      ? Number(liveMeta?.faturamento_sem_cliente || 0)
      : Number((liveMeta?.fiscal_by_empresa || []).find((r) => Number(r.cd_empresa) === Number(selectedEmpresa))?.faturamento_sem_cliente || 0);
    return { clientes: valores.length, receita_clientes: receita, faturamento_fiscal: fiscal, faturamento_sem_cliente: semCliente, top10 };
  }, [liveRows, liveMeta, selectedEmpresa]);

  const isAll = selectedEmpresa == null;
  const byEmp = snapshot?.by_empresa || [];
  const empRow = !isAll ? byEmp.find((e) => e.cd_empresa === selectedEmpresa) : null;
  const k = snapshot?.kpis || {};

  // Lista de clientes ativos gerando receita — snapshot (empresa-aware)
  const rawClients = isAll
    ? (snapshot?.top_clients || [])
    : (snapshot?.top_clients_by_empresa || []).filter((c) => Number(c.cd_empresa) === selectedEmpresa);

  // Receita do período do filtro global (série mensal); fallback no ano civil do snapshot.
  const ps = scopeByPeriod(snapshot, period, selectedEmpresa);
  const receitaAnual = isAll ? k.fat_ano : empRow?.fat_ano || 0;
  const receitaTotal = ps.hasData ? ps.receita : receitaAnual;

  // Cross-ref: contratos ativos por cliente (fich_loc top 20 do analytics)
  const contratosMap = useMemo(() => {
    const m = {};
    for (const c of analytics?.fichloc_top_clientes || []) {
      m[String(c.cd_pessoa)] = { qtd: c.qtd_loc || 0, ativas: c.qtd_ativas || 0, vl_minimo: c.vl_minimo || 0 };
    }
    return m;
  }, [analytics]);

  const clients = useMemo(() => {
    // Com a consulta do período disponível, os cards derivados (distribuição por
    // faixa) usam os clientes do período do filtro em vez do top anual do snapshot.
    if (liveRows) {
      const scoped = selectedEmpresa == null
        ? liveRows
        : liveRows.filter((r) => Number(r.cd_empresa) === Number(selectedEmpresa));
      const byClient = {};
      let total = 0;
      for (const r of scoped) {
        const key = String(r.cd_pessoa || "");
        total += Number(r.receita) || 0;
        if (!byClient[key]) {
          byClient[key] = { cd_pessoa: key, nm_pessoa: r.nm_pessoa || `Cliente ${key}`, receita: 0, nfs: 0, ultima_nf: r.ultima_nf || null };
        }
        byClient[key].receita += Number(r.receita) || 0;
        byClient[key].nfs += Number(r.nfs) || 0;
        if (r.ultima_nf && (!byClient[key].ultima_nf || r.ultima_nf > byClient[key].ultima_nf)) byClient[key].ultima_nf = r.ultima_nf;
      }
      return Object.values(byClient)
        .map((c) => {
          const contratos = contratosMap[c.cd_pessoa];
          return {
            ...c,
            share: total > 0 ? (c.receita / total) * 100 : 0,
            contratos_ativos: contratos?.ativas ?? null,
            contratos_total: contratos?.qtd ?? null,
          };
        })
        .sort((a, b) => b.receita - a.receita);
    }
    const list = rawClients.map((c) => {
      const contratos = contratosMap[String(c.cd_pessoa)];
      return {
        cd_pessoa: String(c.cd_pessoa || ""),
        nm_pessoa: c.nm_pessoa || `Cliente ${c.cd_pessoa}`,
        receita: Number(c.total) || 0,
        nfs: Number(c.nfs) || 0,
        ultima_nf: c.ultima_nf || null,
        share: receitaAnual > 0 ? ((Number(c.total) || 0) / receitaAnual) * 100 : 0,
        contratos_ativos: contratos?.ativas ?? null,
        contratos_total: contratos?.qtd ?? null,
      };
    });
    return list.sort((a, b) => b.receita - a.receita);
  }, [rawClients, contratosMap, receitaAnual, liveRows, selectedEmpresa]);

  if (loading && !snapshot) return <div className="text-gray-500 p-8 text-center">Carregando clientes…</div>;
  if (!snapshot) return <div className="text-gray-500 p-8 text-center">Sem snapshot. Clique em "Atualizar dados" para carregar.</div>;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter((c) => c.nm_pessoa?.toLowerCase().includes(q) || String(c.cd_pessoa).includes(q))
    : clients;

  // KPIs — apurados no período do filtro global (consulta ao vivo);
  // enquanto a consulta carrega, usa o snapshot anual como aproximação.
  const kpiReceita = live ? live.faturamento_fiscal : receitaTotal;
  const receitaAtribuidaClientes = live ? live.receita_clientes : clients.reduce((s, c) => s + c.receita, 0);
  const faturamentoSemCliente = live ? live.faturamento_sem_cliente : Math.max(0, kpiReceita - receitaAtribuidaClientes);
  const clientesAtivos = live ? live.clientes : ((isAll ? k.clientes_ano : empRow?.clientes_ano) || clients.length);
  const top10Receita = live ? live.top10 : clients.slice(0, 10).reduce((s, c) => s + c.receita, 0);
  const concentracao = receitaAtribuidaClientes > 0 ? (top10Receita / receitaAtribuidaClientes) * 100 : 0;
  const ticketMedio = clientesAtivos > 0 ? receitaAtribuidaClientes / clientesAtivos : 0;
  // Comparativo com a janela anterior de mesma duração (série mensal do snapshot)
  const crescimento = ps.hasData ? ps.crescimento : null;
  const receitaAnterior = ps.hasData ? ps.receitaAnt : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-400">
          Clientes ativos com faturamento bruto de NF ·{" "}
          <span className="text-white font-medium">
            {isAll ? "Todas (consolidado)" : getEmpresaLabel(selectedEmpresa, empRow?.nm_empresa)}
          </span>
          {" · "}período <span className="text-white font-medium">{period.start} → {period.end}</span>
          {" · "}base do snapshot até {snapshot.max_date || "—"}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-purple-700/40 bg-purple-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-400 uppercase">Clientes ativos</span></div>
          <div className="text-2xl font-bold text-white">{liveLoading && !live ? "…" : fmtNum(clientesAtivos)}</div>
          <div className="text-xs text-gray-500 mt-1">{live ? "Com faturamento de NF no período do filtro" : "Com faturamento de NF no período"}</div>
        </div>
        <div className="rounded-xl border border-green-700/40 bg-green-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-green-400" /><span className="text-xs text-gray-400 uppercase">Faturamento fiscal total (NF)</span></div>
          <div className="text-2xl font-bold text-white">{liveLoading && !live ? "…" : fmtCur(kpiReceita)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {live ? `${fmtCur(receitaAtribuidaClientes)} atribuídos a clientes · ${fmtCur(faturamentoSemCliente)} sem cliente` : (ps.hasData ? `nf.vl_faturamento · ${ps.monthly.length} meses do período` : "nf.vl_faturamento · período acumulado")}
            {crescimento != null && (
              <span className={`ml-2 font-medium ${crescimento >= 0 ? "text-green-400" : "text-red-400"}`}>
                {crescimento >= 0 ? "▲" : "▼"} {Math.abs(crescimento).toFixed(1)}% vs período anterior ({fmtCur(receitaAnterior)})
              </span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><Percent className="w-4 h-4 text-amber-400" /><span className="text-xs text-gray-400 uppercase">Concentração Top 10</span></div>
          <div className="text-2xl font-bold text-white">{liveLoading && !live ? "…" : `${concentracao.toFixed(1)}%`}</div>
          <div className="text-xs text-gray-500 mt-1">{fmtCur(top10Receita)} no top 10 · % sobre faturamento atribuído a clientes {live ? "(período do filtro)" : "(ano civil)"}</div>
        </div>
        <div className="rounded-xl border border-blue-700/40 bg-blue-950/30 p-4">
          <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-blue-400" /><span className="text-xs text-gray-400 uppercase">Ticket médio/cliente</span></div>
          <div className="text-2xl font-bold text-white">{liveLoading && !live ? "…" : fmtCur(ticketMedio)}</div>
          <div className="text-xs text-gray-500 mt-1">Faturamento atribuído a clientes ÷ clientes ativos{live ? " · período do filtro" : ""}</div>
        </div>
      </div>

      {/* Evolução mensal da receita da base ativa */}
      <ClientesReceitaChart monthlyRevenue={snapshot.monthly_revenue} carMonthly={snapshot?.analytics?.car_monthly} selectedEmpresa={selectedEmpresa} period={period} onSelectMonth={setSelectedMonth} />

      {selectedMonth && (
        <ClientesMesPanel ano={selectedMonth.ano} mes={selectedMonth.mes} onClose={() => setSelectedMonth(null)} />
      )}

      {/* Lista completa de clientes ativos — consulta ao vivo + exportação */}
      <ClientesAtivosTable onSelectClient={setSelectedClient} />

      {selectedClient && (
        <ClientePatrimoniosModal client={selectedClient} onClose={() => setSelectedClient(null)} />
      )}

      {/* Distribuição por faixa de receita */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 text-sm">Distribuição por faixa de faturamento bruto (NF)</h3>
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