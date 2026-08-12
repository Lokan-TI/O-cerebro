import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";

const PROVIDERS = [
  { value: "rdstation_crm", label: "RD Station CRM", url: "https://crm.rdstation.com/api/v1" },
  { value: "rdstation_marketing", label: "RD Station Marketing", url: "https://api.rd.services" },
  { value: "erp_api", label: "ERP via API", url: "" },
  { value: "outro", label: "Outro sistema", url: "" },
];

export default function IntegrationForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial || { provider: "rdstation_crm", name: "", base_url: PROVIDERS[0].url, auth_type: "api_key", api_key: "", account_id: "", sync_periodicity: "manual", is_active: true, notes: "" }
  );
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { id, ...data } = form;
    if (id) await base44.entities.IntegrationConnection.update(id, data);
    else await base44.entities.IntegrationConnection.create(data);
    setSaving(false);
    onSaved();
  };

  const field = "w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-white font-semibold mb-4">{form.id ? "Editar integração" : "Nova integração"}</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Sistema</label>
            <select className={field} value={form.provider} onChange={(e) => {
              const p = PROVIDERS.find((x) => x.value === e.target.value);
              setForm((f) => ({ ...f, provider: p.value, base_url: p.url || f.base_url }));
            }}>
              {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Nome da conexão</label>
            <input className={field} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: RD Station — Matriz" />
          </div>
          <div>
            <label className="text-xs text-gray-500">URL base da API</label>
            <input className={field} value={form.base_url || ""} onChange={(e) => set("base_url", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Autenticação</label>
              <select className={field} value={form.auth_type} onChange={(e) => set("auth_type", e.target.value)}>
                <option value="api_key">API Key</option>
                <option value="bearer_token">Bearer Token</option>
                <option value="oauth">OAuth</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Sincronização</label>
              <select className={field} value={form.sync_periodicity} onChange={(e) => set("sync_periodicity", e.target.value)}>
                <option value="manual">Manual</option>
                <option value="hourly">De hora em hora</option>
                <option value="daily">Diária</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Chave / token</label>
            <input type="password" className={field} value={form.api_key || ""} onChange={(e) => set("api_key", e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Conta / identificador (opcional)</label>
            <input className={field} value={form.account_id || ""} onChange={(e) => set("account_id", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Observações</label>
            <textarea className={field} rows={2} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
          <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}