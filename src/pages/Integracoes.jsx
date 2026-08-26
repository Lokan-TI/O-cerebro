import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import IntegrationForm from "@/components/integracoes/IntegrationForm";
import RdStationApiPanel from "@/components/integracoes/RdStationApiPanel";
import RdStationOAuthCard from "@/components/integracoes/RdStationOAuthCard";
import { Plug, Plus, Pencil, Trash2 } from "lucide-react";

const LABEL = {
  rdstation_crm: "RD Station CRM",
  rdstation_marketing: "RD Station Marketing",
  erp_api: "ERP via API",
  outro: "Outro sistema",
};

export default function Integracoes() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    base44.entities.IntegrationConnection.list("-created_date")
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remove = async (id) => {
    await base44.entities.IntegrationConnection.delete(id);
    load();
  };

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Plug className="w-6 h-6 text-purple-400" /> Integrações
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Conecte CRMs (RD Station) e sistemas de gestão via API para alimentar o cérebro junto com as bases ERP.
            </p>
          </div>
          <button
            onClick={() => setEditing({})}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm"
          >
            <Plus className="w-4 h-4" /> Nova integração
          </button>
        </div>

        {loading ? (
          <p className="text-gray-600 text-sm">Carregando…</p>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-gray-800 rounded-xl p-10 text-center text-gray-600 text-sm">
            Nenhuma integração cadastrada. Comece pelo RD Station CRM ou por uma API de ERP.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.id} className="border border-gray-800 rounded-xl p-4 bg-gray-900/40">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-medium">{r.name}</p>
                    <p className="text-xs text-gray-500">{LABEL[r.provider] || r.provider}</p>
                  </div>
                  <div className="flex gap-2 text-gray-500">
                    <button onClick={() => setEditing(r)} aria-label={`Editar ${r.name}`} className="hover:text-white"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(r.id)} aria-label={`Excluir ${r.name}`} className="hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-3 truncate">{r.base_url}</p>
                <div className="flex items-center gap-2 mt-3 text-xs">
                  <span className={`px-2 py-0.5 rounded ${r.status === "connected" ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-800 text-gray-400"}`}>
                    {r.status === "connected" ? "Conectado" : r.status === "error" ? "Erro" : "Não conectado"}
                  </span>
                  <span className="text-gray-600">Sync {r.sync_periodicity}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <RdStationOAuthCard />
        <RdStationApiPanel />
      </div>

      {editing && (
        <IntegrationForm
          initial={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}