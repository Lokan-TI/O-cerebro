import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Circle } from "lucide-react";

export default function ArchiveReadiness({ run, tables, onChange }) {
  const [notes, setNotes] = useState(run.analysis_parity_notes || "");
  const allValidated = tables.length > 0 && tables.every((t) => t.status === "validated");
  const parity = !!run.analysis_parity_confirmed;

  const save = async (confirmed) => {
    const ready = confirmed && allValidated;
    await base44.entities.SislocArchiveRun.update(run.id, {
      analysis_parity_confirmed: confirmed, analysis_parity_notes: notes,
      status: ready ? "ready_for_shutdown" : allValidated ? "validated" : run.status,
      ...(allValidated && !run.validated_at ? { validated_at: new Date().toISOString() } : {}),
    });
    onChange();
  };

  const Item = ({ ok, label }) => (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-gray-600" />}
      <span className={ok ? "text-gray-200" : "text-gray-500"}>{label}</span>
    </div>
  );

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-white">Liberação para desligamento</h3>
      <Item ok={allValidated} label="Cópia integral validada (todas as tabelas com contagem igual à Sisloc)" />
      <Item ok={parity} label="Análises prioritárias reproduzidas e com paridade confirmada" />
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Evidências de paridade das análises (métricas, períodos, diferenças aceitas)" className="bg-gray-950 border-gray-800" />
      <div className="flex gap-2">
        <Button size="sm" disabled={!allValidated} onClick={() => save(true)}>Confirmar paridade</Button>
        {parity && <Button size="sm" variant="outline" className="bg-transparent border-gray-700 text-gray-200 hover:bg-gray-800" onClick={() => save(false)}>Revogar</Button>}
      </div>
      <p className="text-xs text-gray-500">A Sisloc nunca é desligada ou alterada automaticamente.</p>
    </div>
  );
}