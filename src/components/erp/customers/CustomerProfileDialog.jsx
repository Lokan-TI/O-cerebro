import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import CustomerProfileSummary from '@/components/erp/customers/CustomerProfileSummary';
import CustomerReactivationSignals from '@/components/erp/customers/CustomerReactivationSignals';
import CustomerSourceCoverage from '@/components/erp/customers/CustomerSourceCoverage';
import CustomerTimeline from '@/components/erp/customers/CustomerTimeline';

export default function CustomerProfileDialog({ customer, empresa, onClose }) {
  const query = useQuery({
    queryKey: ['customer-profile', customer.source_id, customer.id, empresa],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('customerReactivation', { action: 'profile',
        source_id: customer.source_id, client_id: customer.id, cd_empresa: empresa });
      if (!data.success) throw new Error(data.error || 'Não foi possível consultar o cliente.');
      return data;
    }, staleTime: 60000, retry: false,
  });
  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-5xl overflow-y-auto border-customer-border bg-customer-surface p-4 text-customer-ink sm:p-6">
      <DialogHeader className="pr-7 text-left">
        <DialogTitle className="break-words leading-snug">{customer.name}</DialogTitle>
        <DialogDescription className="text-customer-muted">Histórico e reativação · {customer.source_name} · cliente {customer.id}</DialogDescription>
      </DialogHeader>
      {query.isPending && <div role="status" className="flex items-center gap-2 py-12 text-sm text-customer-muted"><Loader2 className="h-4 w-4 animate-spin" /> Reunindo histórico e validando identidades…</div>}
      {query.isError && <div role="alert" className="text-sm text-customer-warning">{query.error.response?.data?.error || query.error.message} <button onClick={() => query.refetch()} className="underline">Tentar novamente</button></div>}
      {query.data && <div className="min-w-0 space-y-5">
        <CustomerProfileSummary profile={query.data} />
        <CustomerReactivationSignals profile={query.data} />
        <CustomerSourceCoverage profile={query.data} />
        <CustomerTimeline profile={query.data} />
      </div>}
    </DialogContent>
  </Dialog>;
}