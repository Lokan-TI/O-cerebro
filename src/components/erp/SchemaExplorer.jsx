import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Database, Link2 } from "lucide-react";
import SchemaSidebar from "./SchemaSidebar.jsx";
import TableDetail from "./TableDetail.jsx";

const Q_TABLES = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME";
const Q_ROW_COUNTS = "SELECT t.name AS tabela, SUM(p.rows) AS qt_linhas FROM sys.tables t JOIN sys.partitions p ON t.object_id = p.object_id WHERE p.index_id IN (0, 1) GROUP BY t.name";
const Q_FKS = "SELECT pkt.name AS pk_table, pkc.name AS pk_column, fkt.name AS fk_table, fkc2.name AS fk_column FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id JOIN sys.tables pkt ON fk.referenced_object_id = pkt.object_id JOIN sys.columns pkc ON fkc.referenced_object_id = pkc.object_id AND fkc.referenced_column_id = pkc.column_id JOIN sys.tables fkt ON fk.parent_object_id = fkt.object_id JOIN sys.columns fkc2 ON fkc.parent_object_id = fkc2.object_id AND fkc.parent_column_id = fkc2.column_id";

export default function SchemaExplorer() {
  const [tables, setTables] = useState(null);
  const [rowCounts, setRowCounts] = useState({});
  const [fks, setFks] = useState(null);
  const [loadStage, setLoadStage] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoadStage("tables");
      try {
        const res = await base44.functions.invoke("sqlServerQuery", { query: Q_TABLES });
        const list = (res?.data?.rows || []).map(r => r.TABLE_NAME).filter(Boolean);
        setTables(list);
      } catch { setTables([]); }

      setLoadStage("rows");
      try {
        const res = await base44.functions.invoke("sqlServerQuery", { query: Q_ROW_COUNTS });
        const counts = {};
        (res?.data?.rows || []).forEach(r => { counts[r.tabela] = parseInt(r.qt_linhas) || 0; });
        setRowCounts(counts);
      } catch {}

      setLoadStage("fks");
      try {
        const res = await base44.functions.invoke("sqlServerQuery", { query: Q_FKS });
        setFks(res?.data?.rows || []);
      } catch { setFks([]); }

      setLoadStage(null);
    };
    load();
  }, []);

  // Compute incoming (referenced by) and outgoing (references) FK counts per table
  const connectionCounts = useMemo(() => {
    const counts = {};
    (fks || []).forEach(f => {
      if (!counts[f.pk_table]) counts[f.pk_table] = { in: 0, out: 0 };
      counts[f.pk_table].in++;
      if (!counts[f.fk_table]) counts[f.fk_table] = { in: 0, out: 0 };
      counts[f.fk_table].out++;
    });
    return counts;
  }, [fks]);

  const loading = loadStage !== null;

  return (
    <div>
      {loading && (
        <div className="flex items-center gap-3 text-gray-400 text-sm mb-4">
          <RefreshCw className="w-4 h-4 animate-spin" />
          {loadStage === "tables" && "Carregando tabelas..."}
          {loadStage === "rows" && "Contando registros..."}
          {loadStage === "fks" && "Mapeando relacionamentos..."}
        </div>
      )}

      {tables && fks && !loading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wider mb-1">
                <Database className="w-3.5 h-3.5" /> Tabelas
              </div>
              <p className="text-2xl font-bold text-white">{tables.length}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wider mb-1">
                <Link2 className="w-3.5 h-3.5" /> Relacionamentos
              </div>
              <p className="text-2xl font-bold text-white">{fks.length}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wider mb-1">
                <Database className="w-3.5 h-3.5" /> Com dados
              </div>
              <p className="text-2xl font-bold text-white">
                {tables.filter(t => (rowCounts[t] || 0) > 0).length}
              </p>
            </div>
          </div>

          {/* Sidebar + Detail */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="lg:w-80 shrink-0">
              <SchemaSidebar
                tables={tables}
                rowCounts={rowCounts}
                connectionCounts={connectionCounts}
                selectedTable={selectedTable}
                onSelectTable={setSelectedTable}
              />
            </div>
            <div className="flex-1 min-w-0">
              {selectedTable ? (
                <TableDetail
                  tableName={selectedTable}
                  rowCounts={rowCounts}
                  fks={fks}
                  onSelectTable={setSelectedTable}
                />
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
                  <Database className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Selecione uma tabela para ver colunas e relacionamentos</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}