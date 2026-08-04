import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import SourceStatusBadge from "@/components/erp/SourceStatusBadge";
import AdicionarFonteModal from "@/components/erp/AdicionarFonteModal";
import { Plus, Pencil, Wifi, Loader2, Eye, Power, ChevronLeft } from "lucide-react";

function formatDate(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return String(dt); }
}

export default function GerenciarFontes() {
  const { sources, selectedSource, selectSource, refreshSources, loading } = useErpSource();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [testMsg, setTestMsg] = useState({});

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (s) => { setEditing(s); setModalOpen(true); };

  const handleTest = async (s) => {
    setTestingId(s.id);
    try {
      const res = await base44.functions.invoke("testErpConnection", { source_id: s.id });
      const data = res?.data || {};
      setTestMsg((m) => ({ ...m, [s.id]: data }));
      if (data.success !== undefined) {
        const newStatus = data.success ? "connected" : (data.tables && Object.values(data.tables).some(Boolean) ? "mapping_pending" : "error");
        await base44.entities.ErpDataSource.update(s.id, { status: newStatus, last_connection_test: new Date().toISOString() });
        await refreshSources();
      }
    } catch (err) {
      setTestMsg((m) => ({ ...m, [s.id]: { success: false, message: err?.response?.data?.error || err?.message || "Erro" } }));
    } finally {
      setTestingId(null);
    }
  };

  const toggleActive = async (s) => {
    const newActive = s.is_active === false;
    await base44.entities.ErpDataSource.update(s.id, { is_active: newActive, status: newActive ? "disconnected" : "inactive" });
    await refreshSources();
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/ErpCrmDashboard" className="flex items-center gap-1 text-gray-500 hover:text-white text-sm">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold bg-purple-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">ERP</span>
                <h1 className="text-white font-bold text-xl">Gerenciar fontes</h1>
              </div>
              <p className="text-gray-500 text-sm">Cadastre e gerencie as conexões com os bancos do ERP (Matriz e filiais)</p>
            </div>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Adicionar fonte
          </button>
        </div>

        {/* Tabela de fontes */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Fonte</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Unidade</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Ambiente</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Última sincronização</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Registros</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline" /> Carregando fontes...</td></tr>
                )}
                {!loading && sources.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Nenhuma fonte cadastrada. Clique em "Adicionar fonte".</td></tr>
                )}
                {sources.map((s) => (
                  <tr key={s.id} className={`border-b border-gray-800 hover:bg-gray-800/40 ${selectedSource?.id === s.id ? "bg-purple-950/30" : ""}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => selectSource(s.id)} className="text-white font-medium hover:text-purple-400 text-left">
                        {s.name}
                      </button>
                      {s.credential_reference === "env" && <span className="ml-2 text-xs text-gray-600">(env)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{s.branch_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 capitalize">{s.environment || "—"}</td>
                    <td className="px-4 py-3"><SourceStatusBadge status={s.status || "disconnected"} /></td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(s.last_successful_sync)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{s.records_count?.toLocaleString("pt-BR") || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => selectSource(s.id)} title="Selecionar" className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(s)} title="Editar" className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleTest(s)} disabled={testingId === s.id} title="Testar conexão" className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded disabled:opacity-50">
                          {testingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                        </button>
                        <button onClick={() => toggleActive(s)} title={s.is_active === false ? "Ativar" : "Desativar"} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded">
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                      {testMsg[s.id] && (
                        <p className={`text-xs mt-1 text-right ${testMsg[s.id].success ? "text-green-400" : "text-red-400"}`}>{testMsg[s.id].message}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-gray-600 text-xs mt-4">
          As credenciais são processadas exclusivamente pelo back-end e nunca exibidas na interface. As consultas ao ERP permanecem somente leitura (SELECT / WITH). Fontes com dados históricos podem apenas ser desativadas, não excluídas.
        </p>
      </div>

      <AdicionarFonteModal open={modalOpen} onClose={() => setModalOpen(false)} existing={editing} />
    </div>
  );
}