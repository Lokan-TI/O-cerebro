import { Loader2 } from 'lucide-react';
import { useGlobalFilter } from '@/lib/GlobalFilterContext';
import { useAuth } from '@/lib/AuthContext';
import useRdCustomKpis from '@/components/erp/rdmc/useRdCustomKpis';
import RdCustomMetric from '@/components/erp/rdmc/RdCustomMetric';

export default function RdCustomKpis() {
  const { period } = useGlobalFilter(), { user } = useAuth();
  const q = useRdCustomKpis(period);
  const data = q.data, coverage = q.progress?.done ?? data?.extracted ?? 0;
  return <section className="dark text-foreground space-y-4" data-testid="rd-custom-kpis">
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div><h3 className="text-base font-semibold">Demanda, perfil comercial e prazo</h3><p className="text-xs text-muted-foreground mt-1">Negociações criadas de {period.start} a {period.end} · Consolidado RD, sem filtro de empresa ERP.</p></div>
      {q.isLoading && <p className="flex gap-2 items-center text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando campos comerciais…</p>}
      {q.error && <div role="alert" className="text-sm text-destructive"><p>{q.error.response?.data?.error || q.error.message}</p><button onClick={() => q.refetch()} disabled={q.isFetching} className="underline mt-2">Tentar carregar novamente</button></div>}
      {data && <>
        <p className="text-sm" aria-live="polite" data-testid="rd-custom-coverage">Cobertura: {coverage.toLocaleString('pt-BR')}/{data.total.toLocaleString('pt-BR')} negociações extraídas · {Math.max(0, data.total - coverage).toLocaleString('pt-BR')} pendentes</p>
        <p className="text-xs text-muted-foreground">{!data.total ? 'Nenhuma negociação sincronizada neste período.' : data.pending ? 'Distribuições parciais: pendentes não contam como não informados. Os rankings atualizam ao pausar ou concluir.' : 'Extração concluída para todas as negociações sincronizadas no período.'}</p>
        {user?.role === 'admin' && data.pending > 0 && <div className="flex flex-wrap gap-2 items-center">
          <button onClick={q.extract} disabled={q.running || q.isFetching} className="rounded-md px-3 py-2 text-xs bg-chart-4 text-foreground disabled:opacity-50">{q.running ? 'Extraindo campos comerciais…' : 'Extrair campos comerciais'}</button>
          {q.running && <button onClick={q.pause} className="rounded-md border border-border px-3 py-2 text-xs">Pausar após este lote</button>}
          <span className="text-xs text-muted-foreground">Mantenha a tela aberta; ao sair, retome sem perder os registros já salvos.</span>
        </div>}
        {user?.role !== 'admin' && data.pending > 0 && <p className="text-xs text-muted-foreground">Solicite a extração a um administrador.</p>}
      </>}
      {q.extractionError && <p role="alert" className="text-sm text-destructive">{q.extractionError} Os registros já extraídos foram preservados; clique em extrair para retomar.</p>}
    </div>
    {data && [['Tipo de demanda', ['demand']], ['Perfil comercial', ['sector', 'branch', 'urgency', 'awareness']], ['Prazo de locação', ['rental_term']]].map(([title, keys]) => <div key={title} className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className={keys.length > 1 ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-4' : 'grid gap-3 md:grid-cols-2'}>{data.metrics.filter((m) => keys.includes(m.key)).map((metric) => <RdCustomMetric key={metric.key} metric={metric} extracted={data.extracted} />)}</div>
    </div>)}
  </section>;
}