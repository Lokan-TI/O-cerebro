import { customerDate } from '@/components/erp/customers/customerFormat';

const titles = { invoices: 'Faturamento fiscal (nf)', rentals: 'Locações/orçamentos (fich_loc)', proposals: 'Propostas comerciais (mkt_orcamento)' };
export default function CustomerSourceCoverage({ profile }) {
  const { coverage, summary, rd } = profile;
  const ranges = [['invoices', summary.invoices], ['rentals', summary.rentals], ['proposals', summary.proposals]];
  return <section className="rounded-xl border border-customer-border p-4 text-xs">
    <h3 className="mb-3 font-semibold text-customer-ink">Fontes, cobertura e limites</h3>
    <div className="space-y-2">
      {ranges.map(([key, s]) => <p key={key} className={coverage[key].available ? 'text-customer-muted' : 'text-customer-warning'}>
        <b>{titles[key]}:</b> {coverage[key].available ? s?.first_at || s?.last_at ? `${customerDate(s.first_at)} a ${customerDate(s.last_at)}` : 'consulta concluída, sem eventos com datas neste escopo' : `consulta indisponível: ${coverage[key].error}`}
      </p>)}
      <p className="text-customer-muted">NFs: somente saídas não canceladas/anuladas. Última NF e última locação são métricas distintas. Fichas O e propostas comerciais podem representar o mesmo processo e não são somadas.</p>
      <p className={rd.available ? 'text-customer-muted' : 'text-customer-warning'}>{rd.note}</p>
      {['crm', 'conversas'].map((key) => {
        const sync = rd.sync?.[key], row = rd.rows?.find((r) => r.product === (key === 'crm' ? 'crm_deal' : 'conversas'));
        return <p key={key} className="text-customer-muted"><b>{key === 'crm' ? 'RD CRM' : 'RD Conversas'}:</b> {row ? `${row.count} registro(s) vinculados, de ${customerDate(row.min_source_created_at)} a ${customerDate(row.max_source_created_at)}.` : 'Sem registros atribuídos com segurança nesta consulta; não comprova ausência na origem.'} {sync ? `Última sincronização iniciada em ${customerDate(sync.started_at)}: ${sync.status === 'done' ? 'concluída' : sync.status === 'error' ? 'com erro' : 'em andamento'}.` : 'Sem execução de sincronização informada.'}{sync?.last_error && <span className="text-customer-warning"> {sync.last_error}</span>}</p>;
      })}
    </div>
  </section>;
}