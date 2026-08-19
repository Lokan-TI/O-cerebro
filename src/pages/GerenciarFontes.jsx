import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import SourceStatusBadge from "@/components/erp/SourceStatusBadge";
import AdicionarFonteModal from "@/components/erp/AdicionarFonteModal";
import SchemaValidationResult from "@/components/erp/SchemaValidationResult";
import VerConfigModal from "@/components/erp/VerConfigModal";
import DicionarioExtractPanel from "@/components/erp/DicionarioExtractPanel";
import { Plus, Pencil, Wifi, Loader2, Eye, Power, ChevronLeft, RefreshCw, CheckCircle2, AlertTriangle, Clock, ShieldCheck, FileText } from "lucide-react";
import { pollRun } from "@/lib/erpSync";

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
  const [refreshProgress, setRefreshProgress] = useState({});
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [validatingId, setValidatingId] = useState(null);
  const [validation, setValidation] = useState(null); // { sourceName, result, loading }
  const [viewingConfig, setViewingConfig] = useState(null);

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

  const handleValidate = async (s) => {
    setValidatingId(s.id);
    setValidation({ sourceName: s.name, result: null, loading: true });
    try {
      const res = await base44.functions.invoke("validateSislocSchema", { source_id: s.id });
      setValidation({ sourceName: s.name, result: res?.data || res, loading: false });
    } catch (err) {
      setValidation({ sourceName: s.name, result: { success: false, classification: "Incompatível", message: err?.response?.data?.error || err?.message || "Erro ao validar" }, loading: false });
    } finally {
      setValidatingId(null);
    }
  };

  const handleRefresh = async (s) => {
    setRefreshProgress(prev => ({ ...prev, [s.id]: "processing" }));
    try {
      const res = await base44.functions.invoke("refreshErpData", { source_id: s.id });
      const data = res?.data || {};
      if (data.success && data.run_id) {
        await pollRun(data.run_id, (run) => {
          setRefreshProgress(prev => ({ ...prev, [s.id]: run.status === "running" ? "processing" : run.status }));
        });
      } else {
        setRefreshProgress(prev => ({ ...prev, [s.id]: "failed" }));
      }
    } catch {
      setRefreshProgress(prev => ({ ...prev, [s.id]: "failed" }));
    }
    await refreshSources();
  };

  const refreshAll = async () => {
    const activeSources = sources.filter(s => s.is_active !== false);
    setRefreshingAll(true);
    setRefreshProgress({});
    for (const s of activeSources) {
      setRefreshProgress(prev => ({ ...prev, [s.id]: "processing" }));
      try {
        const res = await base44.functions.invoke("refreshErpData", { source_id: s.id });
        const data = res?.data || {};
        if (data.success && data.run_id) {
          await pollRun(data.run_id, (run) => {
            setRefreshProgress(prev => ({ ...prev, [s.id]: run.status === "running" ? "processing" : run.status }));
          });
        } else {
          setRefreshProgress(prev => ({ ...prev, [s.id]: "failed" }));
        }
      } catch {
        setRefreshProgress(prev => ({ ...prev, [s.id]: "failed" }));
      }
    }
    setRefreshingAll(false);
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
          <div className="flex items-center gap-2">
            <button
              onClick={refreshAll}
              disabled={refreshingAll || sources.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {refreshingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {refreshingAll ? "Atualizando..." : "Atualizar todas as fontes"}
            </button>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Adicionar fonte
            </button>
          </div>
        </div>

        <DicionarioExtractPanel />

        {/* Painel de progresso da atualização consolidada */}
        {refreshingAll && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
            <h3 className="text-white font-medium text-sm mb-3">Atualizando todas as fontes</h3>
            <div className="space-y-2">
              {sources.filter(s => s.is_active !== false).map(s => {
                const st = refreshProgress[s.id] || "waiting";
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    {st === "processing" ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> :
                     st === "success" ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
                     st === "failed" || st === "partial" ? <AlertTriangle className="w-4 h-4 text-yellow-400" /> :
                     <Clock className="w-4 h-4 text-gray-600" />}
                    <span className="text-gray-300 text-sm flex-1">{s.name}</span>
                    <span className="text-gray-500 text-xs">
                      {st === "processing" ? "Em processamento" :
                       st === "waiting" ? "Aguardando" :
                       st === "success" ? "Concluída" :
                       st === "failed" ? "Falha" : st === "partial" ? "Com ressalvas" : st}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                        <button onClick={() => setViewingConfig(s)} title="Ver configuração" className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-gray-800 rounded">
                          <FileText className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(s)} title="Editar" className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleTest(s)} disabled={testingId === s.id} title="Testar conexão" className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded disabled:opacity-50">
                          {testingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleValidate(s)} disabled={validatingId === s.id} title="Validar estrutura (schema Sisloc)" className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-gray-800 rounded disabled:opacity-50">
                          {validatingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleRefresh(s)} disabled={refreshProgress[s.id] === "processing"} title="Atualizar dados" className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded disabled:opacity-50">
                          {refreshProgress[s.id] === "processing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
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

      {validation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setValidation(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-white font-bold text-lg">Validação de estrutura — {validation.sourceName}</h2>
              <button onClick={() => setValidation(null)} className="text-gray-500 hover:text-white text-sm">Fechar</button>
            </div>
            <div className="p-6">
              <SchemaValidationResult result={validation.result} loading={validation.loading} />
            </div>
          </div>
        </div>
      )}

      {viewingConfig && <VerConfigModal source={viewingConfig} onClose={() => setViewingConfig(null)} />}

      <AdicionarFonteModal open={modalOpen} onClose={() => setModalOpen(false)} existing={editing} />
    </div>
  );
}