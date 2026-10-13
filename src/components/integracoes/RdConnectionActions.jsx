import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import RdConnectionEditDialog from "./RdConnectionEditDialog";
import RdConnectionDeleteDialog from "./RdConnectionDeleteDialog";

// Botões Editar/Excluir de uma conexão RD via API.
export default function RdConnectionActions({ conn, defaultLabel, onChange }) {
  const [mode, setMode] = useState(null);
  const label = conn?.label || defaultLabel;
  const done = () => { setMode(null); onChange?.(); };
  return (
    <>
      <button onClick={() => setMode("edit")} disabled={!conn} title="Editar conexão" aria-label={`Editar ${label}`} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded disabled:opacity-40"><Pencil className="w-4 h-4" /></button>
      <button onClick={() => setMode("delete")} disabled={!conn} title="Excluir conexão" aria-label={`Excluir ${label}`} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded disabled:opacity-40"><Trash2 className="w-4 h-4" /></button>
      {mode === "edit" && <RdConnectionEditDialog conn={conn} defaultLabel={defaultLabel} onClose={() => setMode(null)} onSaved={done} />}
      {mode === "delete" && <RdConnectionDeleteDialog product={conn.product} label={label} onClose={() => setMode(null)} onDeleted={done} />}
    </>
  );
}