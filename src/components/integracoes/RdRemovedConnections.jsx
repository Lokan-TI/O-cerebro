import { base44 } from "@/api/base44Client";

// Conexões excluídas, com opção de restaurar (os dados apagados não voltam; é preciso sincronizar de novo).
export default function RdRemovedConnections({ removed, labels, onChange }) {
  if (!removed.length) return null;
  const restore = async (p) => {
    await base44.functions.invoke("rdApiConnection", { action: "save", product: p, restore: true });
    onChange();
  };
  return (
    <div className="rounded-2xl border border-dashed border-gray-800 p-4 text-xs text-gray-500 flex flex-wrap items-center gap-3">
      <span>Conexões excluídas:</span>
      {removed.map((c) => (
        <button key={c.product} onClick={() => restore(c.product)} className="px-2.5 py-1 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800">
          Restaurar {c.label || labels[c.product]}
        </button>
      ))}
    </div>
  );
}