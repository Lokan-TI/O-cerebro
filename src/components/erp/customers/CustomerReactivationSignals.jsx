import { Activity } from 'lucide-react';
import { buildCustomerSignals } from '@/components/erp/customers/customerSignals';

export default function CustomerReactivationSignals({ profile }) {
  const result = buildCustomerSignals(profile);
  return <section className="rounded-xl border border-customer-accent/40 bg-customer-accent/5 p-4" aria-label="Análise de reativação">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-customer-ink"><Activity className="h-4 w-4 shrink-0 text-customer-accent" /> {result.title}</h3>
    <ul className="mt-3 space-y-2 pl-4 text-xs leading-relaxed text-customer-muted list-disc">
      {result.signals.map((signal) => <li key={signal}>{signal}</li>)}
    </ul>
    <div className="mt-4 rounded-lg bg-customer-raised/70 p-3">
      <p className="text-xs font-semibold text-customer-ink">Sugestão de próxima abordagem</p>
      <p className="mt-1 text-sm leading-relaxed text-customer-ink">{result.suggestion}</p>
    </div>
    <p className="mt-3 text-xs leading-relaxed text-customer-muted">Sugestão orientativa, não previsão de churn. Recência usa a última NF e os limites RFM vigentes: R1 ≥ {result.limits.R[0]}d; R2 ≥ {result.limits.R[1]}d; R3 ≥ {result.limits.R[2]}d; R4 ≥ {result.limits.R[3]}d; R5 abaixo disso. Contratos e contatos podem mudar a interpretação.</p>
    {result.partial && <p className="mt-2 text-xs text-customer-warning">Análise parcial: há fontes indisponíveis. Confirme as lacunas antes de concluir perda ou ausência de interesse.</p>}
  </section>;
}