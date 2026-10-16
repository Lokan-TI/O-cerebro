import { customerDate, customerMoney } from '@/components/erp/customers/customerFormat';

export default function CustomerProfileSummary({ profile }) {
  const { person: p, summary: s, scope } = profile;
  const lastQuote = [s.rentals?.last_quote_at, s.proposals?.last_at].filter(Boolean).sort().at(-1);
  const metrics = [
    ['Última locação', customerDate(s.rentals?.last_at), 'Data de abertura da ficha L'],
    ['Locações no histórico', s.rentals?.rentals ?? 'Indisponível', s.rentals ? `${s.rentals.active} sem baixa/encerramento` : 'Fonte indisponível'],
    ['Último faturamento', customerDate(s.invoices?.last_at), 'Emissão de NF válida, não última locação'],
    ['Faturamento histórico', customerMoney(s.invoices?.receita), s.invoices ? `${s.invoices.nfs} NFs válidas` : 'Fonte indisponível'],
    ['Último orçamento/proposta', customerDate(lastQuote), 'Data de abertura; consulte o status abaixo'],
    ['Orçamentos / propostas', `${s.rentals?.quotes ?? '—'} / ${s.proposals?.proposals ?? '—'}`, 'Fichas O / propostas comerciais; não somados'],
  ];
  return <section className="space-y-4">
    <div className="rounded-xl border border-customer-border bg-customer-raised/40 p-4 text-xs text-customer-muted">
      <p className="break-words text-sm text-customer-ink">{p.nm_fan_pessoa || p.nm_pessoa} · Cliente {p.cd_pessoa}</p>
      <p className="mt-1 break-words">CPF/CNPJ: {p.nr_cnpj_pessoa?.trim() || p.nr_cpf_pessoa?.trim() || 'Não informado'} · {p.cidade_pessoa || 'Cidade não informada'} / {p.uf_pessoa || '—'}</p>
      <p className="mt-1 break-words">Telefones: {[p.tel_pessoa, p.tl_cel_pessoa, p.tl_res_pessoa].map((v) => String(v || '').trim()).filter(Boolean).join(' / ') || 'Não informados'}</p>
      <p className="mt-1 break-all">E-mail: {p.en_mail_pessoa || 'Não informado'}</p>
      <p className="mt-2">Cadastro: {customerDate(p.dt_cad_pessoa)} · Fonte: {scope.source_name} · {scope.cd_empresa == null ? 'Todas as empresas desta base' : `Empresa ${scope.cd_empresa}`}</p>
    </div>
    <p className="text-xs text-customer-muted">Todo o histórico disponível até {customerDate(scope.as_of)}, sem o recorte de período/segmento RFM. Totais não somam valores do CRM às NFs.</p>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map(([label, value, note]) => <div key={label} className="rounded-xl border border-customer-border p-3">
        <p className="text-xs text-customer-muted">{label}</p><p className="mt-1 break-words text-lg font-semibold text-customer-ink">{value}</p>
        <p className="mt-1 text-xs text-customer-muted">{note}</p>
      </div>)}
    </div>
  </section>;
}