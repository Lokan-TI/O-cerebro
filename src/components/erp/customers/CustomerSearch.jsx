import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useErpSource } from '@/lib/ErpSourceContext';
import { useEmpresaFilter } from '@/lib/EmpresaFilterContext';
import useCustomerSearch from '@/components/erp/customers/useCustomerSearch';
import CustomerSearchResults from '@/components/erp/customers/CustomerSearchResults';
import CustomerProfileDialog from '@/components/erp/customers/CustomerProfileDialog';
import CustomerGroupDialog from '@/components/erp/customers/CustomerGroupDialog';

export default function CustomerSearch() {
  const { selectedSource, loading } = useErpSource();
  const { selectedEmpresa } = useEmpresaFilter();
  const { term, setTerm, state, search } = useCustomerSearch(selectedSource?.id, selectedEmpresa);
  const [customer, setCustomer] = useState(null);
  const [group, setGroup] = useState(null);
  useEffect(() => { setCustomer(null); setGroup(null); }, [selectedSource?.id, selectedEmpresa]);
  return <section className="rounded-xl border border-customer-border bg-customer-surface p-4 text-customer-ink" aria-label="Busca geral de clientes">
    <div className="mb-3"><h2 className="text-sm font-semibold">Buscar cliente e analisar histórico</h2>
      <p className="mt-1 text-xs leading-relaxed text-customer-muted">Toda a base de clientes, inclusive inativos, sem filtro de período ou segmento RFM. Fonte: {selectedSource?.name || 'Matriz'} · {selectedEmpresa == null ? 'todas as empresas' : `empresa ${selectedEmpresa}`}.</p></div>
    <form onSubmit={(e) => { e.preventDefault(); search(); }} className="flex flex-col gap-2 sm:flex-row">
      <label className="relative block min-w-0 flex-1"><span className="sr-only">Nome, CPF/CNPJ ou telefone do cliente</span>
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-customer-muted" />
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Nome, razão social, CPF/CNPJ ou telefone" maxLength={100}
          className="h-10 w-full rounded-lg border border-customer-border bg-customer-raised pl-9 pr-3 text-sm text-customer-ink placeholder:text-customer-muted focus:outline-none focus:ring-2 focus:ring-customer-accent" />
      </label>
      <button type="submit" disabled={loading || state.loading || term.trim().length < 3} className="h-10 rounded-lg bg-customer-accent px-5 text-sm font-medium text-customer-ink transition-opacity hover:opacity-90 disabled:opacity-50">Pesquisar clientes</button>
    </form>
    <p className="mt-2 text-xs text-customer-muted">Digite pelo menos 3 caracteres. A pesquisa é feita na base, não apenas na lista visível.</p>
    <CustomerSearchResults state={state} onPick={setCustomer} onGroup={setGroup} onMore={() => search(true)} />
    {group && <CustomerGroupDialog group={group} empresa={selectedEmpresa} onClose={() => setGroup(null)} onPick={(m) => { setGroup(null); setCustomer(m); }} />}
    {customer && <CustomerProfileDialog key={`${customer.source_id}:${customer.id}`} customer={customer} empresa={selectedEmpresa} onClose={() => setCustomer(null)} />}
  </section>;
}