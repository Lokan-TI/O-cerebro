import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { customerMoney as formatCurrency, customerDate as formatDate } from '@/components/erp/customers/customerFormat';
import { daysSince } from '@/components/erp/customers/customerGroups';

const RD = { won: 'vendida', lost: 'perdida' };
function diagnosis(s, rd) {
  if (Number(s.active_rentals) > 0) return 'Ativo: possui locação em aberto.';
  if (!s.last_rental) return s.proposals ? 'Nunca locou; só tem propostas.' : 'Sem locações registradas.';
  const parts = [`Parou há ${daysSince(s.last_rental)} dias`];
  if (s.last_quote && s.last_quote > s.last_rental) parts.push('pediu orçamento depois e não fechou');
  if (Number(s.cancelled) > 0) parts.push(`${s.cancelled} proposta(s) cancelada(s)`);
  if (rd?.last) parts.push(`última negociação RD ${RD[rd.last.deal_status] || 'em andamento'} (${rd.last.stage || 'sem etapa'})`);
  return parts.join(' · ') + '.';
}

export default function CustomerGroupCompare({ load, queryKey, onPick }) {
  const q = useQuery({ queryKey, queryFn: load, staleTime: 600000 });
  if (q.isLoading) return <p className="flex items-center gap-2 py-4 text-xs text-customer-muted"><Loader2 className="h-4 w-4 animate-spin" /> Comparando os CNPJs do grupo…</p>;
  if (q.error) return <p className="py-3 text-xs text-customer-warning">{q.error.message}</p>;
  const rows = [...q.data.members].sort((a, b) => String(b.stats.last_rental || '').localeCompare(String(a.stats.last_rental || '')));
  const total = rows.reduce((t, m) => t + Number(m.stats.receita || 0), 0);
  return <div className="space-y-3">
    <p className="text-xs text-customer-muted">Comparação até {formatDate(q.data.as_of)} · faturamento total do grupo {formatCurrency(total)}. Clique em um CNPJ para o histórico completo.</p>
    <div className="overflow-x-auto"><table className="text-xs">
      <thead><tr><th className="text-left">CNPJ / local</th><th className="text-right">Faturamento</th><th>Última locação</th><th>Dias sem locar</th><th>Em aberto</th><th>Propostas (aprov./canc.)</th><th>RD</th><th className="text-left">Leitura</th></tr></thead>
      <tbody>{rows.map((m) => { const s = m.stats; return <tr key={m.id} onClick={() => onPick(m)} className="cursor-pointer">
        <td><span className="block font-medium">{m.document}</span><span className="text-customer-muted">{[m.city, m.uf].filter(Boolean).join('/') || '—'}</span></td>
        <td className="text-right">{formatCurrency(s.receita || 0)}{total > 0 && <span className="block text-customer-muted">{Math.round((s.receita || 0) / total * 100)}%</span>}</td>
        <td className="text-center">{s.last_rental ? formatDate(s.last_rental) : '—'}</td>
        <td className="text-center">{daysSince(s.last_rental) ?? '—'}</td>
        <td className="text-center">{s.active_rentals || 0}</td>
        <td className="text-center">{s.proposals || 0} ({s.approved || 0}/{s.cancelled || 0})</td>
        <td className="text-center">{m.rd ? `${m.rd.deals} (${m.rd.won}V/${m.rd.lost}P)` : '—'}</td>
        <td className="min-w-[220px] text-customer-muted">{diagnosis(s, m.rd)}</td>
      </tr>; })}</tbody>
    </table></div>
  </div>;
}