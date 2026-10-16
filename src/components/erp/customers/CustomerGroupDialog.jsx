import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BarChart3, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import CustomerGroupCompare from '@/components/erp/customers/CustomerGroupCompare';

export default function CustomerGroupDialog({ group, empresa, onPick, onClose }) {
  const [compare, setCompare] = useState(false);
  const call = (action) => base44.functions.invoke('customerReactivation', { action, name: group.name, source_id: group.source_id, cd_empresa: empresa }).then(({ data }) => {
    if (!data.success) throw new Error(data.error); return data; });
  const members = useQuery({ queryKey: ['customerGroup', group.source_id, group.name, empresa], queryFn: () => call('group') });
  const list = members.data?.members || group.rows;
  return <Dialog open onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto border-customer-border bg-customer-surface text-customer-ink">
      <DialogHeader className="pr-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><DialogTitle className="break-words text-base">{group.name}</DialogTitle>
            <DialogDescription className="text-xs text-customer-muted">Grupo por nome semelhante · {list.length} CNPJ(s) · {group.source_name}. Cada CNPJ é analisado separadamente.</DialogDescription></div>
          <button onClick={() => setCompare(!compare)} className="flex items-center gap-2 rounded-lg bg-customer-accent px-3 py-2 text-xs font-medium text-customer-ink hover:opacity-90">
            {compare ? <><ArrowLeft className="h-4 w-4" /> Voltar à lista</> : <><BarChart3 className="h-4 w-4" /> Analisar grupo</>}</button>
        </div>
      </DialogHeader>
      {compare ? <CustomerGroupCompare load={() => call('group_compare')} queryKey={['customerGroupCompare', group.source_id, group.name, empresa]} onPick={onPick} />
        : <div className="divide-y divide-customer-border/60">
          {members.isLoading && <p className="flex items-center gap-2 py-3 text-xs text-customer-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando todos os CNPJs do grupo…</p>}
          {members.error && <p className="py-2 text-xs text-customer-warning">{members.error.message}</p>}
          {members.data?.truncated && <p className="py-2 text-xs text-customer-warning">Exibindo os primeiros 200 CNPJs.</p>}
          {list.map((m) => <button key={m.id} onClick={() => onPick(m)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left hover:bg-customer-raised">
            <span className="min-w-0"><span className="block text-sm font-medium">{m.document} · {m.name}</span>
              <span className="block text-xs text-customer-muted">{[m.city, m.uf].filter(Boolean).join('/') || 'Local não informado'}{m.trade_name && m.trade_name !== m.name ? ` · ${m.trade_name}` : ''} · Cliente {m.id}</span></span>
            <ArrowRight className="h-4 w-4 shrink-0 text-customer-accent" /></button>)}
        </div>}
    </DialogContent>
  </Dialog>;
}