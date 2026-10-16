import { ArrowRight, Loader2 } from 'lucide-react';

export default function CustomerSearchResults({ state, onPick, onMore }) {
  if (!state.searched) return null;
  return <div className="mt-4 space-y-3" aria-live="polite">
    {state.error && <p role="alert" className="text-sm text-customer-warning">{state.error}</p>}
    {state.warnings.map((w, i) => <p key={i} className="text-xs text-customer-warning">{w}</p>)}
    {state.loading && <p className="flex items-center gap-2 text-sm text-customer-muted"><Loader2 className="h-4 w-4 animate-spin" /> Buscando em toda a base…</p>}
    {!state.loading && !state.rows.length && !state.error && <p className="text-sm text-customer-muted">{state.warnings.length ? 'Consulta incompleta: verifique as fontes indisponíveis acima.' : 'Nenhum cliente encontrado. Tente outro nome, documento ou telefone.'}</p>}
    <div className="divide-y divide-customer-border/60">
      {state.rows.map((c) => <button key={`${c.source_id}:${c.id}`} onClick={() => onPick(c)} aria-label={`Analisar ${c.name}`}
        className="group flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-customer-raised focus-visible:outline focus-visible:outline-customer-accent">
        <span className="min-w-0"><span className="block break-words text-sm font-medium text-customer-ink">{c.name}</span>
          {c.trade_name && c.trade_name !== c.name && <span className="block text-xs text-customer-muted">{c.trade_name}</span>}
          <span className="mt-1 block break-words text-xs text-customer-muted">{c.document || 'Documento não informado'} · {c.phone || 'Telefone não informado'}</span>
          <span className="block text-xs text-customer-muted">{c.source_name} · Cliente {c.id}</span></span>
        <ArrowRight className="h-4 w-4 shrink-0 text-customer-accent" />
      </button>)}
    </div>
    {state.cursor && <button onClick={onMore} disabled={state.loading} className="rounded-lg border border-customer-border px-4 py-2 text-xs text-customer-ink disabled:opacity-50">Carregar mais clientes</button>}
  </div>;
}