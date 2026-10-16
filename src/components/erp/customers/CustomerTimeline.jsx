import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import useCustomerTimeline from '@/components/erp/customers/useCustomerTimeline';
import CustomerTimelineEvent from '@/components/erp/customers/CustomerTimelineEvent';

export default function CustomerTimeline({ profile }) {
  const [category, setCategory] = useState('erp');
  const query = useCustomerTimeline(profile, category);
  const events = query.data?.pages.flatMap((p) => p.events) || [];
  const note = query.data?.pages[0]?.note;
  return <section aria-label="Linha do tempo" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-customer-ink">Linha do tempo do cliente</h3>
      <div className="flex flex-wrap gap-1">
        {[['erp', 'Histórico ERP'], ['crm', 'Negociações CRM'], ['conversas', 'Atendimentos']].map(([key, label]) => <button key={key} onClick={() => setCategory(key)} aria-pressed={category === key}
          className={category === key ? 'rounded-lg bg-customer-accent px-3 py-2 text-xs text-customer-ink' : 'rounded-lg border border-customer-border px-3 py-2 text-xs text-customer-muted hover:text-customer-ink'}>{label}</button>)}
      </div>
    </div>
    <p className="text-xs text-customer-muted">Mais recentes primeiro, por data de abertura/emissão. Consulte cada fonte; registros sem data aparecem ao final.</p>
    {note && <p className="text-xs text-customer-warning">{note}</p>}
    {query.isPending && <p className="flex items-center gap-2 py-6 text-sm text-customer-muted"><Loader2 className="h-4 w-4 animate-spin" /> Consultando histórico…</p>}
    {query.isError && <div role="alert" className="text-sm text-customer-warning">Histórico indisponível: {query.error.response?.data?.error || query.error.message} <button onClick={() => query.refetch()} className="underline">Tentar novamente</button></div>}
    {!query.isPending && !query.isError && !events.length && <p className="rounded-lg border border-customer-border p-4 text-sm text-customer-muted">{category === 'erp' ? 'Nenhum evento encontrado nas fontes ERP consultadas para este cliente e empresa.' : 'Nenhum registro sincronizado pôde ser atribuído com segurança. Isso não comprova ausência de atividade na origem.'}</p>}
    <div className="space-y-3">{events.map((event) => <CustomerTimelineEvent key={event.event_id} event={event} />)}</div>
    {query.hasNextPage && <button onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} className="rounded-lg border border-customer-border px-4 py-2 text-xs text-customer-ink disabled:opacity-50">{query.isFetchingNextPage ? 'Carregando…' : 'Carregar eventos anteriores'}</button>}
  </section>;
}