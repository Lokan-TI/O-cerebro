import { ArrowRight, Building2, Loader2 } from 'lucide-react';
import { groupResults } from '@/components/erp/customers/customerGroups';

const place = (c) => [c.city, c.uf].filter(Boolean).join('/');
const rowCls = 'group flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-customer-raised focus-visible:outline focus-visible:outline-customer-accent';

export default function CustomerSearchResults({ state, onPick, onGroup, onMore }) {
  if (!state.searched) return null;
  const items = groupResults(state.rows);
  return <div className="mt-4 space-y-3" aria-live="polite">
    {state.error && <p role="alert" className="text-sm text-customer-warning">{state.error}</p>}
    {state.warnings.map((w, i) => <p key={i} className="text-xs text-customer-warning">{w}</p>)}
    {state.loading && <p className="flex items-center gap-2 text-sm text-customer-muted"><Loader2 className="h-4 w-4 animate-spin" /> Buscando em toda a base…</p>}
    {!state.loading && !state.rows.length && !state.error && <p className="text-sm text-customer-muted">{state.warnings.length ? 'Consulta incompleta: verifique as fontes indisponíveis acima.' : 'Nenhum cliente encontrado. Tente outro nome, documento ou telefone.'}</p>}
    <div className="divide-y divide-customer-border/60">
      {items.map((it) => it.type === 'group'
        ? <button key={`g:${it.source_id}:${it.name}`} onClick={() => onGroup(it)} aria-label={`Abrir grupo ${it.name}`} className={rowCls}>
            <span className="flex min-w-0 items-start gap-3"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-customer-accent" />
              <span className="min-w-0"><span className="block break-words text-sm font-medium text-customer-ink">{it.name}</span>
                <span className="mt-1 block text-xs text-customer-muted">Grupo · {it.rows.length}+ CNPJs com o mesmo nome · {[...new Set(it.rows.map(place).filter(Boolean))].slice(0, 3).join(', ') || 'localização não informada'}</span>
                <span className="block text-xs text-customer-muted">{it.source_name} · clique para escolher o CNPJ</span></span></span>
            <span className="shrink-0 rounded-full bg-customer-accent/20 px-2 py-0.5 text-xs text-customer-ink">Grupo</span>
          </button>
        : <button key={`${it.row.source_id}:${it.row.id}`} onClick={() => (it.groupable ? onGroup({ name: it.row.name, source_id: it.row.source_id, source_name: it.row.source_name, rows: [it.row] }) : onPick(it.row))} aria-label={`Analisar ${it.row.name}`} className={rowCls}>
            <span className="min-w-0"><span className="block break-words text-sm font-medium text-customer-ink">{it.row.name}</span>
              {it.row.trade_name && it.row.trade_name !== it.row.name && <span className="block text-xs text-customer-muted">{it.row.trade_name}</span>}
              <span className="mt-1 block break-words text-xs text-customer-muted">{it.row.document || 'Documento não informado'} · {place(it.row) || 'Local não informado'} · {it.row.phone || 'Telefone não informado'}</span>
              <span className="block text-xs text-customer-muted">{it.row.source_name} · Cliente {it.row.id}</span></span>
            <ArrowRight className="h-4 w-4 shrink-0 text-customer-accent" />
          </button>)}
    </div>
    {state.cursor && <button onClick={onMore} disabled={state.loading} className="rounded-lg border border-customer-border px-4 py-2 text-xs text-customer-ink disabled:opacity-50">Carregar mais clientes</button>}
  </div>;
}