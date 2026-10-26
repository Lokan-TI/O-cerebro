import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { FileSignature, Wallet } from "lucide-react";

// Contratos abertos são estado atual (não dependem do período); respeitam fonte e empresa.
export default function ContratosAbertosCards({ selectedEmpresa }) {
  const { selectedSource } = useErpSource();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    (async () => {
      const ids = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID
        ? [selectedSource.id]
        : (await base44.entities.ErpDataSource.filter({ is_active: true })).map((s) => s.id);
      const acc = { fichas: 0, clientes: 0, valor: 0, sem_fatura: 0 };
      for (const id of ids) {
        const res = await base44.functions.invoke("listContratosAbertos", { source_id: id, mode: "resumo", cd_empresa: selectedEmpresa ?? undefined });
        if (res.data?.error) throw new Error(res.data.error);
        acc.fichas += res.data.fichas; acc.clientes += res.data.clientes; acc.valor += res.data.valor; acc.sem_fatura += res.data.sem_fatura || 0;
      }
      if (alive) setData(acc);
    })().catch((e) => alive && setError(e.response?.data?.error || e.message));
    return () => { alive = false; };
  }, [selectedSource?.id, selectedEmpresa]);

  const val = (v) => (error ? "—" : data ? v : "…");
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-cyan-700/40 bg-cyan-950/30 p-4">
        <div className="flex items-center gap-2 mb-2"><FileSignature className="w-4 h-4 text-cyan-400" /><span className="text-xs text-gray-400 uppercase">Contratos abertos</span></div>
        <div className="text-2xl font-bold text-white">{val(fmtNum(data?.fichas))}</div>
        <div className="text-xs text-gray-500 mt-1">{error ? `Erro: ${error}` : data ? `Fichas de locação abertas · ${fmtNum(data.clientes)} clientes` : "Carregando contratos…"}</div>
      </div>
      <div className="rounded-xl border border-violet-700/40 bg-violet-950/30 p-4">
        <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-violet-400" /><span className="text-xs text-gray-400 uppercase">Valor total contratos abertos</span></div>
        <div className="text-2xl font-bold text-white">{val(fmtCur(data?.valor))}</div>
        <div className="text-xs text-gray-500 mt-1">Faturamento mensal: última fatura de locação de cada contrato aberto{data?.sem_fatura ? ` · ${fmtNum(data.sem_fatura)} ainda sem fatura` : ""}</div>
      </div>
    </div>
  );
}