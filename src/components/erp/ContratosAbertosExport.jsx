import { useState, useEffect } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { fetchContratos, exportContratosXlsx } from "./contratosAbertosExport";
import { buildResumo } from "./contratosResumo";
import { exportContratosBruto } from "./contratosBrutoExport";
import ContratosResumoTable from "./ContratosResumoTable";
import { exportMigracao } from "./migracaoExport";
import { FILTROS, aplicarFiltro } from "./fichaFiltros";

export default function ContratosAbertosExport({ sourceId, empresas = [] }) {
  const [empresa, setEmpresa] = useState(empresas[0] ? String(empresas[0].cd_empresa) : "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [filtro, setFiltro] = useState("posse");
  useEffect(() => {
    if (!empresa && empresas[0]) setEmpresa(String(empresas[0].cd_empresa));
  }, [empresas]);

  const run = async () => {
    setLoading(true); setMsg("Buscando fichas...");
    try {
      const allFichas = await fetchContratos(sourceId, empresa, (n) => setMsg(`${n} fichas carregadas...`), "fichas");
      const hist = FILTROS.find((f) => f.id === filtro).historico;
      const ctrls = allFichas.map((f) => f.cd_controle);
      const allRows = [];
      for (let i = 0; i < ctrls.length; i += 100) {
        allRows.push(...await fetchContratos(sourceId, empresa, undefined, undefined, ctrls.slice(i, i + 100), hist));
        setMsg(`Itens: ${Math.min(i + 100, ctrls.length)}/${ctrls.length} fichas analisadas...`);
      }
      const { fichas: fsel, rows } = aplicarFiltro(filtro, allFichas, allRows);
      setMsg("Buscando renovações...");
      const ids = new Set(fsel.map((f) => f.cd_controle));
      const sel = [...ids], renovs = [];
      for (let i = 0; i < sel.length; i += 100) {
        renovs.push(...await fetchContratos(sourceId, empresa, undefined, "renovacoes", sel.slice(i, i + 100)));
        setMsg(`Renovações: ${Math.min(i + 100, sel.length)}/${sel.length} fichas...`);
      }
      setResumo(buildResumo(fsel, rows));
      const n = exportContratosXlsx(fsel, rows, renovs);
      setMsg(`${FILTROS.find((f) => f.id === filtro).label}: ${n} fichas únicas (de ${allFichas.length} abertas) · ${rows.length} linhas de itens`);
    } catch (e) {
      setMsg(`Erro: ${e.message}`);
    }
    setLoading(false);
  };

  const runBruto = async () => {
    setLoading(true); setMsg("Buscando dados brutos...");
    try {
      const r = await exportContratosBruto(sourceId, empresa, setMsg);
      setMsg(`${r.contratos} contratos · ${r.itens} itens exportados (bruto)`);
    } catch (e) {
      setMsg(`Erro: ${e.message}`);
    }
    setLoading(false);
  };

  const runMigracao = async () => {
    setLoading(true);
    try {
      const r = await exportMigracao(sourceId, empresa, setMsg, filtro);
      setMsg(r.fichas ? `${r.fichas} fichas únicas (de ${r.total} abertas) · ${r.linhas} linhas` : "Nenhuma ficha encontrada para este filtro.");
    } catch (e) {
      setMsg(`Erro: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <>
    <div className="px-4 py-3 border-b border-gray-800 flex flex-wrap items-center gap-2">
      <span className="text-gray-300 text-xs font-medium">Fichas com status "Aberta" (igual ao Sisloc):</span>
      <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs">
        <option value="">Todas as empresas</option>
        {empresas.map((e) => <option key={String(e.cd_empresa)} value={String(e.cd_empresa)}>{getEmpresaLabel(e.cd_empresa, e.empresa_nome)}</option>)}
      </select>
      <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs">
        {FILTROS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select>
      {msg && <span className={`text-xs ${msg.startsWith("Erro") ? "text-red-400" : "text-gray-500"}`}>{msg}</span>}
      <button onClick={runBruto} disabled={loading || !sourceId} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs font-medium disabled:opacity-50">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Exportar bruto (Sisloc)
      </button>
      <button onClick={runMigracao} disabled={loading || !sourceId} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white text-xs font-medium disabled:opacity-50">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Exportar para migração (novo ERP)
      </button>
      <button onClick={run} disabled={loading || !sourceId} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded-lg text-white text-xs font-medium disabled:opacity-50">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Exportar contratos
      </button>
    </div>
    <ContratosResumoTable linhas={resumo} />
    </>
  );
}