import { useState } from 'react';

export default function CustomerDealFields({ fields }) {
  const [open, setOpen] = useState(false);
  return <div className="pt-1">
    <button onClick={() => setOpen(!open)} className="text-customer-accent hover:underline">{open ? 'Ocultar campos do RD' : `Ver campos do RD (${fields.length})`}</button>
    {open && <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
      {fields.map((f) => <div key={f.label} className="min-w-0"><dt className="inline capitalize">{f.label}: </dt><dd className="inline break-words text-customer-ink">{f.value}</dd></div>)}
    </dl>}
  </div>;
}