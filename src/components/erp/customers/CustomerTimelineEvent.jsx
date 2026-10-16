import { customerDate, customerMoney } from '@/components/erp/customers/customerFormat';

const kinds = { locacao: 'Locação', orcamento_ficha: 'Orçamento de locação', proposta: 'Proposta comercial', faturamento: 'Faturamento fiscal', crm_deal: 'Negociação RD CRM', crm_task: 'Ação comercial RD CRM', conversas: 'Atendimento RD Conversas' };
export default function CustomerTimelineEvent({ event: e }) {
  return <article className="relative min-w-0 rounded-xl border border-customer-border bg-customer-raised/30 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><p className="text-xs font-medium text-customer-accent">{kinds[e.kind] || e.kind}</p>
        <h4 className="mt-1 break-words text-sm font-semibold text-customer-ink">{e.title || `${kinds[e.kind]} ${e.reference || '(sem número)'}`}</h4></div>
      <time className="text-xs text-customer-muted">{customerDate(e.event_at)}</time>
    </div>
    <div className="mt-2 space-y-1 text-xs leading-relaxed text-customer-muted">
      <p className="break-words">{e.status}{e.empresa != null && ` · Empresa ${e.empresa}`}</p>
      {e.amount != null && <p>{e.amount_label}: <b className="text-customer-ink">{customerMoney(e.amount)}</b></p>}
      {e.closed_at && <p>{e.kind === 'proposta' ? 'Aprovação' : e.kind === 'crm_deal' ? 'Fechamento' : 'Encerramento'}: {customerDate(e.closed_at)}</p>}
      {e.expected_return && <p>Devolução prevista: {customerDate(e.expected_return)}</p>}
      {(e.contact || e.phone) && <p className="break-words">Contato da ficha: {e.contact || 'Não informado'} · {e.phone || 'Telefone não informado'}</p>}
      {e.owner && <p>Responsável: {e.owner}</p>}
      {(e.pipeline || e.stage) && <p>Funil / etapa: {e.pipeline || '—'} / {e.stage || '—'}</p>}
      {(e.origin || e.campaign) && <p>Origem / campanha: {e.origin || '—'} / {e.campaign || '—'}</p>}
      {e.notes && <p className="whitespace-pre-wrap break-words">Observação: {e.notes}</p>}
      {e.deal_name && <p className="break-words">Negociação: {e.deal_name}</p>}
      {e.link && <p>Vínculo com o cliente: {e.link}</p>}
      {e.synced_at && <p>Registro sincronizado em {customerDate(e.synced_at)}</p>}
    </div>
  </article>;
}