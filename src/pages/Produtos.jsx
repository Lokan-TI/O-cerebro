import { useState, useEffect, useMemo } from "react";
import { Package, Download, RefreshCw, Search, Loader2 } from "lucide-react";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { loadProdutos } from "@/lib/produtosAnalise";
import { exportProdutosXlsx } from "@/components/produtos/produtosExport";
import ProdutosKpis from "@/components/produtos/ProdutosKpis";
import ProdutosFamiliaResumo from "@/components/produtos/ProdutosFamiliaResumo";
import ProdutosTable from "@/components/produtos/ProdutosTable";

const SORTS = { valor_estoque: "Valor em estoque", saldo: "Saldo", receita: "Receita", manutencao: "Manutenção", resultado: "Resultado" };

export default function Produtos() {
  const { selectedSource } = useErpSource();
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [familia, setFamilia] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [situacao, setSituacao] = useState("");
  const [sort, setSort] = useState("valor_estoque");

  const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : null;
  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await loadProdutos(sourceId, setMsg)); }
    catch (e) { setError(e?.response?.data?.error || e.message); }
    setLoading(false); setMsg(null);
  };
  useEffect(() => { load(); }, [sourceId]);

  const all = data?.produtos || [];
  const familias = useMemo(() => [...new Set(all.map((p) => p.familia))].sort(), [all]);
  const empresas = useMemo(() => [...new Set(all.flatMap((p) => p.patrimonios.map((a) => a.cd_empresa)).filter(Boolean))].sort(), [all]);

  const rows = useMemo(() => {
    let list = all;
    if (empresa) list = list.map((p) => {
      const pats = p.patrimonios.filter((a) => a.cd_empresa === empresa);
      const s = (k) => pats.reduce((t, x) => t + x[k], 0);
      return { ...p, patrimonios: pats, qtd_patrimonios: pats.length, qtd_locados: pats.filter((a) => a.em_locacao).length, receita: s("receita"), manutencao: s("manutencao"), resultado: s("resultado") };
    }).filter((p) => p.qtd_patrimonios > 0);
    if (familia) list = list.filter((p) => p.familia === familia);
    if (situacao === "saldo") list = list.filter((p) => p.saldo > 0);
    if (situacao === "zerado") list = list.filter((p) => p.saldo <= 0);
    if (situacao === "sem_pat") list = list.filter((p) => p.qtd_patrimonios === 0);
    if (situacao === "com_pat") list = list.filter((p) => p.qtd_patrimonios > 0);
    if (situacao === "locado") list = list.filter((p) => p.qtd_locados > 0);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.nm_equipto.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q) || String(p.cd_equipto) === q || p.patrimonios.some((a) => a.nr_patrimonio.toLowerCase().includes(q)));
    return [...list].sort((a, b) => b[sort] - a[sort]);
  }, [all, empresa, familia, situacao, search, sort]);

  const sel = "bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-2 text-sm text-white";
  return (
    <div className="max-w-[1800px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-violet-400 text-xs uppercase tracking-widest"><Package className="w-4 h-4" /> Cérebro</div>
          <h1 className="text-3xl font-semibold text-white mt-1">Produtos</h1>
          <p className="text-gray-400 text-sm mt-1">Estoque completo, ativos locados, receita e custo de manutenção por patrimônio.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Recarregar
          </button>
          <button onClick={() => exportProdutosXlsx(rows)} disabled={!data || loading} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm font-medium disabled:opacity-50">
            <Download className="w-4 h-4" /> Exportar Excel
          </button>
        </div>
      </div>

      {error && <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 text-red-300 text-sm">{error}</div>}
      {loading && <div className="flex items-center justify-center gap-2 text-gray-400 py-16"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /> {msg || "Carregando..."}</div>}

      {data && !loading && (
        <>
          <ProdutosKpis produtos={rows} />
          <div className="grid md:grid-cols-2 gap-4">
            <ProdutosFamiliaResumo produtos={rows} campo="familia" titulo="Por família" />
            <ProdutosFamiliaResumo produtos={rows} campo="grupo" titulo="Por grupo (top 12 em valor)" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Produto, código ou patrimônio…" className={`${sel} pl-8 w-72`} />
            </div>
            <select value={familia} onChange={(e) => setFamilia(e.target.value)} className={sel}>
              <option value="">Todas as famílias</option>{familias.map((f) => <option key={f}>{f}</option>)}
            </select>
            <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={sel}>
              <option value="">Todas as empresas</option>{empresas.map((e) => <option key={e} value={e}>{getEmpresaLabel(e)}</option>)}
            </select>
            <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={sel}>
              <option value="">Todas as situações</option><option value="saldo">Com saldo</option><option value="zerado">Zerados</option>
              <option value="com_pat">Com patrimônio</option><option value="sem_pat">Sem patrimônio</option><option value="locado">Com ativo locado</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={sel}>
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>Ordenar: {v}</option>)}
            </select>
            <span className="text-xs text-gray-500 ml-auto">{rows.length} produtos · receita estimada = valor de locação × dias locados / 30</span>
          </div>
          <ProdutosTable key={`${familia}${empresa}${situacao}${sort}${search}`} rows={rows} />
        </>
      )}
    </div>
  );
}