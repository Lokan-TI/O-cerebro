import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { fmtNum } from "@/lib/erpFormat";
import { exportFichasReativacao } from "@/components/erp/fichasReativacaoExport";

// Planilha para o coordenador de cada filial ligar aos clientes: todas as fichas, de qualquer status.
export default function FichasReativacaoButton({ sourceId, selectedEmpresa }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const run = async () => {
    setBusy(true);
    setMsg("Consultando fichas no ERP…");
    try {
      const r = await exportFichasReativacao(sourceId, selectedEmpresa, (n) => setMsg(`${fmtNum(n)} fichas carregadas…`));
      setMsg(r.fichas ? `${fmtNum(r.fichas)} fichas em ${r.filiais} ${r.filiais === 1 ? "filial" : "filiais"}.` : "Nenhuma ficha encontrada.");
    } catch (e) {
      setMsg(`Erro: ${e?.response?.data?.error || e.message}`);
    }
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-2">
      {msg && <span className={`text-xs ${msg.startsWith("Erro") ? "text-red-400" : "text-gray-400"}`}>{msg}</span>}
      <button onClick={run} disabled={busy}
        title="Todas as fichas, de qualquer status: filial, cidade da obra, cliente, contato, telefone da ficha e produto, com uma aba por filial."
        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded-lg text-white text-xs font-medium disabled:opacity-50">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Lista de reativação por filial
      </button>
    </div>
  );
}