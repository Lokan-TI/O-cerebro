export default function RdCustomMetric({ metric, extracted }) {
  const peak = Math.max(1, ...metric.rows.map((r) => r.value));
  return <article className="rounded-xl border border-border bg-card p-4 min-w-0">
    <h5 className="font-semibold text-sm text-foreground">{metric.title}</h5>
    <p className="mt-1 text-xs text-muted-foreground">Preenchimento: {metric.filled}/{extracted} extraídas</p>
    <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
      {!metric.rows.length && <p className="text-xs text-muted-foreground">{extracted ? 'Nenhum valor informado nas negociações extraídas.' : 'Aguardando extração no período.'}</p>}
      {metric.rows.map((row) => <div key={row.label}>
        <div className="flex justify-between gap-3 text-xs mb-1"><span className="break-words min-w-0">{row.label}</span><span className="shrink-0 tabular-nums">{row.value.toLocaleString('pt-BR')} · {metric.filled ? (100 * row.value / metric.filled).toFixed(1) : 0}%</span></div>
        <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-chart-4" style={{ width: `${100 * row.value / peak}%` }} /></div>
      </div>)}
    </div>
    <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
      <p>Não informado: {metric.empty} · Campo ausente na resposta: {metric.absent}</p>
      <p>{metric.key === 'demand' ? 'Uma negociação pode ter várias demandas; percentuais podem somar mais de 100%.' : 'Percentual sobre negociações com valor preenchido.'}</p>
      {metric.key === 'rental_term' && <p>Prazo solicitado no RD, não duração efetiva dos contratos ERP.</p>}
      {metric.key === 'sector' && <p>Setor informado no RD; não representa necessariamente o segmento econômico do cliente.</p>}
    </div>
  </article>;
}