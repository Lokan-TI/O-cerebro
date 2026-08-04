import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import KpiCard from "@/components/erp/KpiCard.jsx";
import QueryRunner from "@/components/erp/QueryRunner.jsx";
import SchemaExplorer from "@/components/erp/SchemaExplorer.jsx";
import { Database, RefreshCw, Wifi, WifiOff } from "lucide-react";

const TABS = [
  { id: "kpis", label: "KPIs" },
  { id: "estrutura", label: "Estrutura" },
  { id: "query", label: "Query SQL" },
  { id: "tabelas", label: "Tabelas" },
];

const CUR_MONTH_START = "DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)";
const CUR_MONTH_END = `DATEADD(month,1,${CUR_MONTH_START})`;
const PREV_MONTH_START = `DATEADD(month,-1,${CUR_MONTH_START})`;

const DEFAULT_KPIS = [
  { id: "fat_mes", label: "Faturamento Mês", sub: "Mês atual · vl_faturamento", accent: "border-purple-500", format: "currency", defaultSql: `SELECT ISNULL(SUM(vl_faturamento),0) AS valor FROM nf WHERE dt_emi_nf >= ${CUR_MONTH_START} AND dt_emi_nf < ${CUR_MONTH_END}` },
  { id: "fat_ano", label: "Faturamento Ano", sub: `Acumulado ${new Date().getFullYear()}`, accent: "border-blue-500", format: "currency", defaultSql: `SELECT ISNULL(SUM(vl_faturamento),0) AS valor FROM nf WHERE dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),1,1) AND dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))` },
  { id: "ticket_mes", label: "Ticket Médio", sub: "Por NF no mês atual", accent: "border-green-500", format: "currency", defaultSql: `SELECT ISNULL(SUM(vl_faturamento)/NULLIF(COUNT(*),0),0) AS valor FROM nf WHERE dt_emi_nf >= ${CUR_MONTH_START} AND dt_emi_nf < ${CUR_MONTH_END}` },
  { id: "nfs_mes", label: "NFs no Mês", sub: "Notas emitidas no mês", accent: "border-yellow-500", format: "number", defaultSql: `SELECT COUNT(*) AS valor FROM nf WHERE dt_emi_nf >= ${CUR_MONTH_START} AND dt_emi_nf < ${CUR_MONTH_END}` },
  { id: "clientes_ativos", label: "Clientes Ativos", sub: "Clientes que faturaram no mês", accent: "border-cyan-500", format: "number", defaultSql: `SELECT COUNT(DISTINCT cd_pessoa) AS valor FROM nf WHERE dt_emi_nf >= ${CUR_MONTH_START} AND dt_emi_nf < ${CUR_MONTH_END}` },
  { id: "fat_ant", label: "Fat. Mês Anterior", sub: "Mês anterior completo", accent: "border-indigo-500", format: "currency", defaultSql: `SELECT ISNULL(SUM(vl_faturamento),0) AS valor FROM nf WHERE dt_emi_nf >= ${PREV_MONTH_START} AND dt_emi_nf < ${CUR_MONTH_START}` },
];

export default function ErpCrmDashboard() {
  const [activeTab, setActiveTab] = useState("kpis");
  const [connStatus, setConnStatus] = useState(null);
  const [tables, setTables] = useState(null);
  const [tablesLoading, setTablesLoading] = useState(false);

  const testConnection = async () => {
    setConnStatus(null);
    try {
      await base44.functions.invoke("sqlServerQuery", { query: "SELECT 1 AS test" });
      setConnStatus(true);
    } catch {
      setConnStatus(false);
    }
  };

  useEffect(() => { testConnection(); }, []);

  const loadTables = async () => {
    setTablesLoading(true);
    try {
      const res = await base44.functions.invoke("sqlServerQuery", {
        query: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
      });
      setTables(res?.data?.rows || []);
    } catch {
      setTables([]);
    } finally {
      setTablesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "tabelas" && tables === null) loadTables();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-bold bg-purple-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">ERP / CRM</span>
              <h1 className="text-white font-bold text-xl">KPIs em Tempo Real</h1>
            </div>
            <p className="text-gray-500 text-sm">Conexão direta com SQL Server · dados atualizados sob demanda</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              connStatus === null ? "bg-gray-800 text-gray-400 border-gray-700" :
              connStatus ? "bg-green-950 text-green-400 border-green-800" :
              "bg-red-950 text-red-400 border-red-800"
            }`}>
              {connStatus === null ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> :
               connStatus ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {connStatus === null ? "Conectando..." : connStatus ? "Conectado" : "Desconectado"}
            </div>
            <button onClick={testConnection} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white text-xs transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Testar
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Connection error banner */}
        {connStatus === false && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <WifiOff className="w-5 h-5 text-red-400" />
              <h2 className="text-red-400 font-semibold">Falha na conexão com SQL Server</h2>
            </div>
            <p className="text-red-300 text-sm">Verifique as credenciais configuradas (host, porta, banco, usuário e senha) nas variáveis de ambiente do app.</p>
          </div>
        )}

        {/* Content */}
        {activeTab === "kpis" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {DEFAULT_KPIS.map(kpi => (
              <KpiCard key={kpi.id} {...kpi} />
            ))}
          </div>
        )}

        {activeTab === "estrutura" && <SchemaExplorer />}

        {activeTab === "query" && <QueryRunner />}

        {activeTab === "tabelas" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Tabelas do Banco</h2>
            {tablesLoading ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm"><RefreshCw className="w-4 h-4 animate-spin" /> Carregando...</div>
            ) : tables?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {tables.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                    <Database className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-gray-300 text-xs truncate">{t.TABLE_NAME || Object.values(t)[0]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Nenhuma tabela encontrada ou conexão indisponível</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}