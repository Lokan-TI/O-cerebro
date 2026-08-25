import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import QueryInspector from "@/components/erp/QueryInspector";
import {
  AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { AlertTriangle, CalendarClock, CircleDollarSign, RefreshCw, TrendingDown, TrendingUp, WalletCards } from "lucide-react";

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const pct = (v) => v == null ? "—" : `${(Number(v) * 100).toFixed(1)}%`;
const pctDirect = (v) => v == null ? "—" : `${Number(v).toFixed(1)}%`;
const short = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mi`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} mil`;
  return n.toFixed(0);
};

function localIsoToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateLabel(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

function chartDate(iso) {
  if (!iso) return "";
  const [, m, d] = String(iso).split("-");
  return `${d}/${m}`;
}

function StatCard({ title, value, subtitle, tone = "neutral", icon: Icon = CircleDollarSign }) {
  const tones = {
    red: "border-red-900/50 bg-red-950/20 text-red-300",
    green: "border-emerald-900/50 bg-emerald-950/20 text-emerald-300",
    amber: "border-amber-900/50 bg-amber-950/20 text-amber-300",
    blue: "border-blue-900/50 bg-blue-950/20 text-blue-300",
    neutral: "border-gray-800 bg-gray-900 text-gray-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.neutral}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80"><Icon className="w-4 h-4" />{title}</div>
      <div className="text-xl font-bold text-white mt-2">{value}</div>
      {subtitle && <div className="text-[11px] text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function PeakTable({ title, rows = [], field, empty = "Sem dados" }) {
  const top = rows.filter(r => Number(r?.[field]) > 0).slice(0, 10);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      <div className="max-h-[370px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-950 text-gray-500 text-xs uppercase">
            <tr><th className="text-left px-4 py-2">Data</th><th className="text-right px-4 py-2">Valor</th><th className="text-right px-4 py-2">Saldo do dia</th></tr>
          </thead>
          <tbody>
            {top.map((r, i) => (
              <tr key={`${r.date}-${i}`} className="border-t border-gray-800/80">
                <td className="px-4 py-2 text-gray-300">{dateLabel(r.date)}</td>
                <td className="px-4 py-2 text-right text-white font-medium">{brl2(r[field])}</td>
                <td className={`px-4 py-2 text-right ${(Number(r.saldo) || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{brl2(r.saldo)}</td>
              </tr>
            ))}
            {top.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-600">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpenTable({ title, rows = [], direction }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800"><h4 className="text-sm font-semibold text-white">{title}</h4></div>
      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-950 text-gray-500 uppercase">
            <tr><th className="text-left px-3 py-2">Data</th><th className="text-left px-3 py-2">Contraparte</th><th className="text-left px-3 py-2">Situação</th><th className="text-right px-3 py-2">Valor</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((r, i) => (
              <tr key={`${direction}-${i}`} className="border-t border-gray-800/70">
                <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{dateLabel(r.data)}</td>
                <td className="px-3 py-2 text-gray-300 max-w-[250px] truncate" title={r.pessoa}>{r.pessoa}</td>
                <td className="px-3 py-2 text-gray-500">{r.situacao}</td>
                <td className={`px-3 py-2 text-right font-medium ${direction === "out" ? "text-red-300" : "text-emerald-300"}`}>{brl2(r.valor)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-600">Sem títulos no horizonte.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CashFlowForecastTab() {
  const { selectedSource } = useErpSource();
  const [pastDays, setPastDays] = useState(180);
  const [futureDays, setFutureDays] = useState(90);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!selectedSource) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("analyzeCashFlowForecast", {
        source_id: selectedSource.id,
        as_of_date: localIsoToday(),
        past_days: pastDays,
        future_days: futureDays,
      });
      const d = res?.data || res;
      if (d?.error) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const historyChart = useMemo(() => (data?.history || []).slice(-90).map(r => ({ ...r, label: chartDate(r.date) })), [data]);
  const futureChart = useMemo(() => (data?.future?.expected || []).map(r => ({ ...r, label: chartDate(r.date) })), [data]);
  const w30 = (data?.future?.windows || []).find(w => w.days === 30) || data?.future?.windows?.at(-1) || {};
  const coverage = data?.future?.coverage;

  const weekday = useMemo(() => {
    const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const map = names.map((name, i) => ({ name, i, entradas: 0, saidas: 0, dias: 0 }));
    for (const r of data?.history || []) {
      const dt = new Date(`${r.date}T12:00:00`);
      const x = map[dt.getDay()];
      x.entradas += Number(r.entradas) || 0;
      x.saidas += Number(r.saidas) || 0;
      x.dias += 1;
    }
    return map.map(x => ({ ...x, entradas_media: x.dias ? x.entradas / x.dias : 0, saidas_media: x.dias ? x.saidas / x.dias : 0 }));
  }, [data]);

  const lineage = (data?.lineage || []).map(q => ({ label: q.label, description: "SQL de origem da previsibilidade financeira", sql: q.sql }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-cyan-400" /><h3 className="text-lg font-semibold text-white">Fluxo & Previsibilidade de Caixa</h3></div>
          <p className="text-xs text-gray-500 mt-1 max-w-3xl">Passado realizado por baixa, posição atual da carteira e futuro comprometido/esperado por CAP e CAR. A previsão esperada é modelada; não substitui o título financeiro do ERP.</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-xs text-gray-500">Histórico
            <select value={pastDays} onChange={e => setPastDays(Number(e.target.value))} className="block mt-1 bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-3 py-2">
              <option value={90}>90 dias</option><option value={180}>180 dias</option><option value={365}>12 meses</option><option value={730}>24 meses</option>
            </select>
          </label>
          <label className="text-xs text-gray-500">Futuro
            <select value={futureDays} onChange={e => setFutureDays(Number(e.target.value))} className="block mt-1 bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-3 py-2">
              <option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option><option value={180}>180 dias</option><option value={365}>12 meses</option>
            </select>
          </label>
          {lineage.length > 0 && <QueryInspector queries={lineage} title="SQLs — Fluxo e previsibilidade" />}
          <button onClick={load} disabled={loading || !selectedSource} className="flex items-center gap-2 px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 rounded-lg text-sm text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Analisando…" : "Executar análise"}
          </button>
        </div>
      </div>

      {error && <div className="flex gap-2 items-start bg-red-950/30 border border-red-900 rounded-lg p-3 text-sm text-red-300"><AlertTriangle className="w-4 h-4 mt-0.5" />{error}</div>}
      {!data && !error && <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">Execute a análise para construir a linha temporal de caixa.</div>}

      {data && <>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-xs text-gray-400 leading-relaxed">
          <span className="text-gray-200 font-medium">Contrato analítico:</span> passado = <span className="font-mono">dt_bai_cap / dt_bai_car</span> · futuro CAP = <span className="font-mono">dt_agendpagto</span> quando houver, senão <span className="font-mono">dt_ven_cap</span> · futuro CAR = <span className="font-mono">dt_ven_car</span> · valor = <span className="font-mono">vl_pre + vl_acr − vl_des</span>. CAP é consolidado porque não há dimensão física de empresa comprovada.
        </div>

        <section className="space-y-3">
          <div><h3 className="text-sm font-semibold text-white">Presente · pressão imediata sobre o caixa</h3><p className="text-xs text-gray-500">Posição em {dateLabel(data.as_of_date)}.</p></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="CAP vencido" value={brl(data.present?.cap_overdue)} subtitle={`${Number(data.present?.cap_overdue_count || 0).toLocaleString("pt-BR")} títulos em atraso`} tone="red" icon={TrendingDown} />
            <StatCard title="CAR vencido" value={brl(data.present?.car_overdue)} subtitle={`${Number(data.present?.car_overdue_count || 0).toLocaleString("pt-BR")} títulos ainda não recebidos`} tone="amber" icon={TrendingUp} />
            <StatCard title="CAP agendado · 7 dias" value={brl(data.present?.cap_scheduled_7d)} subtitle="Saída com data programada no ERP" tone="blue" icon={CalendarClock} />
            <StatCard title="Saldo previsto · 30 dias" value={brl(w30?.saldo)} subtitle={`Entradas ${brl(w30?.entradas)} · saídas ${brl(w30?.saidas)}`} tone={(Number(w30?.saldo) || 0) >= 0 ? "green" : "red"} icon={WalletCards} />
          </div>
        </section>

        <section className="space-y-3">
          <div><h3 className="text-sm font-semibold text-cyan-300">Futuro · previsibilidade e necessidade de liquidez</h3><p className="text-xs text-gray-500">Calendário esperado ajustado pelo comportamento histórico. CAP agendado permanece na data agendada.</p></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title={`Entradas · ${futureDays}d`} value={brl(data.future?.total_expected_in)} subtitle="CAR esperado" tone="green" icon={TrendingUp} />
            <StatCard title={`Saídas · ${futureDays}d`} value={brl(data.future?.total_expected_out)} subtitle="CAP esperado" tone="red" icon={TrendingDown} />
            <StatCard title="Cobertura de saídas" value={pct(coverage)} subtitle="Entradas esperadas ÷ saídas esperadas" tone={coverage >= 1 ? "green" : coverage >= 0.85 ? "amber" : "red"} icon={CircleDollarSign} />
            <StatCard title="Necessidade máxima de caixa" value={brl(data.future?.liquidity_need_from_zero)} subtitle="Maior déficit acumulado partindo de saldo zero; não considera saldo bancário inicial" tone={Number(data.future?.liquidity_need_from_zero) > 0 ? "red" : "green"} icon={WalletCards} />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="mb-3"><h4 className="text-sm font-semibold text-white">Fluxo diário esperado</h4><p className="text-xs text-gray-500">Entradas, saídas e saldo acumulado no horizonte selecionado.</p></div>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={futureChart} margin={{ top: 10, right: 15, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} minTickGap={22} />
                  <YAxis tickFormatter={short} tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <Tooltip formatter={(v) => brl2(v)} labelFormatter={(l) => `Data ${l}`} contentStyle={{ background: "#111827", border: "1px solid #374151" }} />
                  <Legend />
                  <ReferenceLine y={0} stroke="#4b5563" />
                  <Area type="monotone" dataKey="entradas" name="Entradas esperadas" stroke="#10b981" fill="#10b981" fillOpacity={0.16} />
                  <Area type="monotone" dataKey="saidas" name="Saídas esperadas" stroke="#ef4444" fill="#ef4444" fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PeakTable title="Dias com maior saída prevista" rows={data.future?.peak_out_days} field="saidas" />
            <PeakTable title="Dias com maior entrada prevista" rows={data.future?.peak_in_days} field="entradas" />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800"><h4 className="text-sm font-semibold text-white">Janelas de liquidez</h4></div>
            <table className="w-full text-sm">
              <thead className="bg-gray-950 text-xs uppercase text-gray-500"><tr><th className="text-left px-4 py-2">Horizonte</th><th className="text-right px-4 py-2">Entradas</th><th className="text-right px-4 py-2">Saídas</th><th className="text-right px-4 py-2">Saldo</th><th className="text-right px-4 py-2">Cobertura</th></tr></thead>
              <tbody>{(data.future?.windows || []).map(w => <tr key={w.days} className="border-t border-gray-800"><td className="px-4 py-2 text-gray-300">Próximos {w.days} dias</td><td className="px-4 py-2 text-right text-emerald-300">{brl2(w.entradas)}</td><td className="px-4 py-2 text-right text-red-300">{brl2(w.saidas)}</td><td className={`px-4 py-2 text-right font-medium ${w.saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>{brl2(w.saldo)}</td><td className="px-4 py-2 text-right text-gray-300">{pct(w.cobertura)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div><h3 className="text-sm font-semibold text-blue-300">Passado · comportamento real do caixa</h3><p className="text-xs text-gray-500">Movimentação efetiva registrada por baixa nos últimos {pastDays} dias.</p></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Entradas realizadas" value={brl(data.past_summary?.total_in)} subtitle={`Média/dia ${brl(data.past_summary?.avg_daily_in)}`} tone="green" icon={TrendingUp} />
            <StatCard title="Saídas realizadas" value={brl(data.past_summary?.total_out)} subtitle={`Média/dia ${brl(data.past_summary?.avg_daily_out)}`} tone="red" icon={TrendingDown} />
            <StatCard title="Saldo realizado" value={brl(data.past_summary?.net)} subtitle="Entradas − saídas no histórico analisado" tone={Number(data.past_summary?.net) >= 0 ? "green" : "red"} icon={WalletCards} />
            <StatCard title="Amostra de comportamento" value={`${Number(data.behavior?.cap?.sample_size || 0).toLocaleString("pt-BR")} CAP`} subtitle={`${Number(data.behavior?.car?.sample_size || 0).toLocaleString("pt-BR")} CAR com vencimento e baixa`} tone="neutral" icon={CircleDollarSign} />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="mb-3"><h4 className="text-sm font-semibold text-white">Fluxo realizado · últimos 90 dias do recorte</h4><p className="text-xs text-gray-500">Somente movimentos com baixa efetiva.</p></div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historyChart} margin={{ top: 10, right: 15, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} minTickGap={22} />
                  <YAxis tickFormatter={short} tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <Tooltip formatter={(v) => brl2(v)} contentStyle={{ background: "#111827", border: "1px solid #374151" }} />
                  <Legend />
                  <Bar dataKey="entradas" name="Entradas realizadas" fill="#10b981" />
                  <Bar dataKey="saidas" name="Saídas realizadas" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PeakTable title="Maiores dias de saída realizados" rows={data.past_summary?.peak_out_days} field="saidas" />
            <PeakTable title="Maiores dias de entrada realizados" rows={data.past_summary?.peak_in_days} field="entradas" />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-white">Padrão por dia da semana</h4>
            <p className="text-xs text-gray-500 mt-0.5 mb-4">Média apenas dos dias com movimentação registrada no histórico; serve para identificar concentração operacional.</p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekday}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tickFormatter={short} tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <Tooltip formatter={(v) => brl2(v)} contentStyle={{ background: "#111827", border: "1px solid #374151" }} />
                  <Legend />
                  <Bar dataKey="entradas_media" name="Entrada média" fill="#10b981" />
                  <Bar dataKey="saidas_media" name="Saída média" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div><h3 className="text-sm font-semibold text-purple-300">Comportamento de liquidação · vencimento → baixa</h3><p className="text-xs text-gray-500">Usado para transformar o calendário contratual em calendário esperado.</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-white">CAP · quando a empresa costuma pagar</h4>
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm"><div><span className="text-gray-500">Mediana</span><div className="text-white text-lg font-bold">{Number(data.behavior?.cap?.median_days || 0)} dias</div></div><div><span className="text-gray-500">Média</span><div className="text-white text-lg font-bold">{Number(data.behavior?.cap?.avg_days || 0).toFixed(1)} dias</div></div></div>
              <div className="text-xs text-gray-400 mt-3">Antes do vencimento {pctDirect(data.behavior?.cap?.pct_before_due)} · no dia {pctDirect(data.behavior?.cap?.pct_on_due)} · depois {pctDirect(data.behavior?.cap?.pct_after_due)}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-white">CAR · quando a empresa costuma receber</h4>
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm"><div><span className="text-gray-500">Mediana</span><div className="text-white text-lg font-bold">{Number(data.behavior?.car?.median_days || 0)} dias</div></div><div><span className="text-gray-500">Média</span><div className="text-white text-lg font-bold">{Number(data.behavior?.car?.avg_days || 0).toFixed(1)} dias</div></div></div>
              <div className="text-xs text-gray-400 mt-3">Antes do vencimento {pctDirect(data.behavior?.car?.pct_before_due)} · no dia {pctDirect(data.behavior?.car?.pct_on_due)} · depois {pctDirect(data.behavior?.car?.pct_after_due)}</div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div><h3 className="text-sm font-semibold text-white">Maiores títulos que pressionam o horizonte</h3><p className="text-xs text-gray-500">Contrapartes e contas que mais explicam os próximos picos.</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><OpenTable title="CAP · maiores obrigações em aberto" rows={data.top_open?.cap || []} direction="out" /><OpenTable title="CAR · maiores recebimentos em aberto" rows={data.top_open?.car || []} direction="in" /></div>
        </section>

        {(data.warnings || []).length > 0 && <div className="bg-amber-950/30 border border-amber-900 rounded-xl p-4 text-xs text-amber-300"><p className="font-medium mb-1">Consultas com ressalva</p>{data.warnings.map((w, i) => <div key={i}>{w}</div>)}</div>}
      </>}
    </div>
  );
}
