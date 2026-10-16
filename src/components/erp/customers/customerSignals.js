import { computeRfm, loadLimits } from '@/lib/rfm';
import { customerDate, daysSince } from '@/components/erp/customers/customerFormat';

export function buildCustomerSignals(profile) {
  const { summary: s, scope, coverage, rd } = profile, limits = loadLimits();
  const days = daysSince(s.invoices?.last_at, scope.as_of);
  const score = days != null && days >= 0 && s.invoices?.nfs > 0 ? computeRfm([{
    cd_pessoa: profile.person.cd_pessoa, nm_pessoa: profile.person.nm_pessoa,
    receita: Number(s.invoices.receita), nfs: Number(s.invoices.nfs), ultima_nf: String(s.invoices.last_at).slice(0, 10),
  }], scope.as_of, limits).clients[0]?.R : null;
  const signals = [], active = Number(s.rentals?.active || 0);
  if (days != null && days >= 0) signals.push(`${days} dias desde a última NF válida (${customerDate(s.invoices.last_at)}). Recência R${score ?? ' indisponível'}, pelos limites configurados no RFM; não equivale à data da última locação.`);
  else signals.push(coverage.invoices.available ? 'Não há última NF com data válida neste escopo; não é possível calcular a recência fiscal.' : 'Faturamento indisponível: a recência fiscal não pôde ser avaliada.');
  if (s.rentals?.last_at) signals.push(`Última abertura de locação em ${customerDate(s.rentals.last_at)} (${daysSince(s.rentals.last_at, scope.as_of)} dias). Abertura de ficha não comprova entrega de equipamentos.`);
  else signals.push(coverage.rentals.available ? 'Nenhuma locação com data registrada nesta base/empresa. Isso não comprova ausência em outras fontes.' : 'Histórico de locações indisponível nesta consulta.');
  if (active) signals.push(`${active} ficha(s) de locação sem baixa ou encerramento. Confirme a operação antes de tratar o cliente como perdido.`);
  const lastQuote = [s.rentals?.last_quote_at, s.proposals?.last_not_cancelled_at].filter(Boolean).sort().at(-1);
  const laterQuote = lastQuote && (!s.rentals?.last_at || lastQuote > s.rentals.last_at);
  if (laterQuote) signals.push(`Há orçamento/proposta de ${customerDate(lastQuote)} posterior à última abertura de locação disponível. Isso não comprova falta de conversão.`);
  const conv = rd.rows?.find((r) => r.product === 'conversas');
  if (conv?.max_source_created_at) signals.push(`Último atendimento RD vinculado iniciou em ${customerDate(conv.max_source_created_at)}; não é a data da última mensagem.`);
  const partial = Object.values(coverage).some((c) => !c.available);
  const cold = score != null && score <= 3;
  const title = active ? 'Relacionamento em andamento: confirme o contexto' : cold ? 'Sinal de esfriamento fiscal a investigar' : score != null ? 'Acompanhar o próximo ciclo do cliente' : 'Dados insuficientes para concluir esfriamento';
  const suggestion = active ? 'Confirme a utilização e a previsão de devolução das locações em aberto. Pergunte sobre continuidade ou nova demanda antes de propor uma reativação.'
    : laterQuote ? `Retome o orçamento/proposta de ${customerDate(lastQuote)}: confirme se a necessidade continua, se houve contratação por outra ficha/filial e quais pontos impedem o avanço.`
    : cold ? `Retome o contato citando a última locação${s.rentals?.last_at ? ' de ' + customerDate(s.rentals.last_at) : ' registrada, se confirmada'}. Pergunte sobre a próxima obra, demanda de equipamentos e prazo; confirme o cenário antes de oferecer uma nova proposta.`
    : s.rentals?.rentals === 0 ? 'Qualifique a necessidade atual e confira os orçamentos e contatos comerciais existentes antes da primeira oferta de locação.'
    : 'Confirme a previsão da próxima necessidade e o responsável pela decisão. Use o histórico e os atendimentos vinculados para personalizar a abordagem, sem presumir desinteresse.';
  return { title, signals, suggestion, partial, cold, active, limits };
}