import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { X, Loader2, Wifi, Copy, Stethoscope, Save } from "lucide-react";

const ENVIRONMENTS = [
  { value: "producao", label: "Produção" },
  { value: "homologacao", label: "Homologação" },
  { value: "teste", label: "Teste" },
];

const EMPTY = {
  name: "", branch_name: "", branch_code: "", description: "",
  environment: "producao", is_active: true,
  database_type: "sqlserver", host: "", port: "1433", database_name: "",
  instance_name: "", default_schema: "", username: "", password: "",
  auth_type: "sql", use_ssl: false, extra_params: "",
  is_read_only: true, sync_periodicity: "manual", sync_mode: "manual",
  connection_timeout: 25, row_limit: 10000, import_start_date: "",
  tech_contact: "", notes: "", dw_api_client_id: "",
  credential_reference: "entity", status: "disconnected",
};

export default function AdicionarFonteModal({ open, onClose, existing = null }) {
  const { refreshSources } = useErpSource();
  const [form, setForm] = useState(() => existing ? { ...EMPTY, ...existing } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await base44.functions.invoke("testErpConnection", { source: form });
      setTestResult(res?.data || null);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { setError("Informe o nome da fonte."); return; }
    if (form.credential_reference !== "env" && (!form.host || !form.database_name)) {
      setError("Informe host e nome do banco para a conexão."); return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form };
      if (existing?.id) {
        // On edit, don't clear an existing password if the field was left blank
        if (!payload.password) delete payload.password;
        await base44.entities.ErpDataSource.update(existing.id, payload);
      } else {
        await base44.entities.ErpDataSource.create(payload);
      }
      await refreshSources();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = () => {
    setForm((f) => ({ ...f, name: `${f.name} (cópia)`, branch_code: "" }));
  };

  const inputCls = "w-full bg-gray-950 text-gray-200 text-sm rounded-lg px-3 py-2 border border-gray-800 focus:border-purple-500 outline-none";
  const labelCls = "text-gray-400 text-xs font-medium mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-white font-bold text-lg">Adicionar fonte de dados do ERP</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Identificação */}
          <section>
            <h3 className="text-purple-400 text-sm font-semibold uppercase tracking-wider mb-3">Identificação</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Nome da fonte *</label><input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Piracicaba" /></div>
              <div><label className={labelCls}>Nome da unidade / filial</label><input className={inputCls} value={form.branch_name} onChange={(e) => set("branch_name", e.target.value)} /></div>
              <div><label className={labelCls}>Código interno da unidade</label><input className={inputCls} value={form.branch_code} onChange={(e) => set("branch_code", e.target.value)} placeholder="Ex: PIRACICABA" /></div>
              <div><label className={labelCls}>Ambiente</label>
                <select className={inputCls} value={form.environment} onChange={(e) => set("environment", e.target.value)}>
                  {ENVIRONMENTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2"><label className={labelCls}>Descrição</label><input className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
              <div><label className={labelCls}>Status ativo</label>
                <select className={inputCls} value={form.is_active ? "true" : "false"} onChange={(e) => set("is_active", e.target.value === "true")}>
                  <option value="true">Ativo</option><option value="false">Inativo</option>
                </select>
              </div>
            </div>
          </section>

          {/* Conexão */}
          <section>
            <h3 className="text-purple-400 text-sm font-semibold uppercase tracking-wider mb-3">Conexão</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Tipo do banco de dados</label>
                <select className={inputCls} value={form.database_type} onChange={(e) => set("database_type", e.target.value)}>
                  <option value="sqlserver">SQL Server</option>
                </select>
              </div>
              <div><label className={labelCls}>Servidor / host</label><input className={inputCls} value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="exemplo.com.br" /></div>
              <div><label className={labelCls}>Porta</label><input className={inputCls} value={form.port} onChange={(e) => set("port", e.target.value)} /></div>
              <div><label className={labelCls}>Nome do banco</label><input className={inputCls} value={form.database_name} onChange={(e) => set("database_name", e.target.value)} /></div>
              <div><label className={labelCls}>Instância</label><input className={inputCls} value={form.instance_name} onChange={(e) => set("instance_name", e.target.value)} /></div>
              <div><label className={labelCls}>Schema padrão</label><input className={inputCls} value={form.default_schema} onChange={(e) => set("default_schema", e.target.value)} /></div>
              <div><label className={labelCls}>Usuário</label><input className={inputCls} value={form.username} onChange={(e) => set("username", e.target.value)} /></div>
              <div><label className={labelCls}>{existing ? "Senha (deixe em branco para manter)" : "Senha"}</label>
                <input type="password" className={inputCls} value={form.password || ""} onChange={(e) => set("password", e.target.value)} placeholder={existing?.has_password ? "Senha configurada" : ""} />
              </div>
              <div><label className={labelCls}>Tipo de autenticação</label>
                <select className={inputCls} value={form.auth_type} onChange={(e) => set("auth_type", e.target.value)}>
                  <option value="sql">SQL Server</option><option value="windows">Windows</option>
                </select>
              </div>
              <div><label className={labelCls}>Utilização de SSL</label>
                <select className={inputCls} value={form.use_ssl ? "true" : "false"} onChange={(e) => set("use_ssl", e.target.value === "true")}>
                  <option value="false">Não</option><option value="true">Sim</option>
                </select>
              </div>
              <div className="sm:col-span-2"><label className={labelCls}>Client ID do wrapper DW_API (SISLOC)</label><input className={inputCls} value={form.dw_api_client_id} onChange={(e) => set("dw_api_client_id", e.target.value)} placeholder="Deixe em branco para consultas diretas (sem DW_API)" /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Parâmetros adicionais de conexão</label><input className={inputCls} value={form.extra_params} onChange={(e) => set("extra_params", e.target.value)} /></div>
            </div>
          </section>

          {/* Configuração operacional */}
          <section>
            <h3 className="text-purple-400 text-sm font-semibold uppercase tracking-wider mb-3">Configuração operacional</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Conexão somente leitura</label>
                <select className={inputCls} value={form.is_read_only ? "true" : "false"} onChange={(e) => set("is_read_only", e.target.value === "true")}>
                  <option value="true">Sim</option><option value="false">Não</option>
                </select>
              </div>
              <div><label className={labelCls}>Periodicidade de sincronização</label>
                <select className={inputCls} value={form.sync_periodicity} onChange={(e) => set("sync_periodicity", e.target.value)}>
                  <option value="manual">Manual</option><option value="hourly">A cada hora</option><option value="daily">Diária</option><option value="weekly">Semanal</option>
                </select>
              </div>
              <div><label className={labelCls}>Sincronização</label>
                <select className={inputCls} value={form.sync_mode} onChange={(e) => set("sync_mode", e.target.value)}>
                  <option value="manual">Manual</option><option value="automatic">Automática</option>
                </select>
              </div>
              <div><label className={labelCls}>Timeout da conexão (s)</label><input type="number" className={inputCls} value={form.connection_timeout} onChange={(e) => set("connection_timeout", parseInt(e.target.value) || 25)} /></div>
              <div><label className={labelCls}>Limite de registros por consulta</label><input type="number" className={inputCls} value={form.row_limit} onChange={(e) => set("row_limit", parseInt(e.target.value) || 10000)} /></div>
              <div><label className={labelCls}>Data inicial para importação</label><input type="date" className={inputCls} value={form.import_start_date || ""} onChange={(e) => set("import_start_date", e.target.value)} /></div>
              <div><label className={labelCls}>Responsável técnico</label><input className={inputCls} value={form.tech_contact} onChange={(e) => set("tech_contact", e.target.value)} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Observações</label><textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
            </div>
          </section>

          {/* Resultado do teste */}
          {testResult && (
            <div className={`rounded-xl p-4 border ${testResult.success ? "bg-green-950 border-green-800" : "bg-red-950 border-red-800"}`}>
              <p className={`text-sm font-medium ${testResult.success ? "text-green-400" : "text-red-400"}`}>{testResult.message}</p>
              {testResult.responseTimeMs != null && <p className="text-gray-400 text-xs mt-1">Tempo de resposta: {testResult.responseTimeMs}ms</p>}
              {testResult.tables && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(testResult.tables).map(([t, ok]) => (
                    <span key={t} className={`text-xs px-2 py-0.5 rounded ${ok ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>{t}: {ok ? "✓" : "✗"}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Ações */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={handleTest} disabled={testing} className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />} Testar conexão
            </button>
            <button onClick={handleDuplicate} className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors">
              <Copy className="w-4 h-4" /> Duplicar
            </button>
            <span className="text-gray-600 text-xs flex items-center gap-1"><Stethoscope className="w-3 h-3" /> Diagnóstico após conectar</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}