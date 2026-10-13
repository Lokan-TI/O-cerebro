import { motion } from "framer-motion";
import { fmtCur } from "@/lib/erpFormat";

const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

export default function RdFunnelStages({ data }) {
  const steps = [
    ["Entrada (pessoas)", data.entrada, null],
    ["Cadastrados no RD CRM", data.crm, pct(data.crm, data.entrada)],
    ["Negociação ganha no CRM", data.ganhos, pct(data.ganhos, data.crm)],
    ["Vinculados a cliente ERP", data.erp_vinculados, pct(data.erp_vinculados, data.entrada)],
    ["Geraram receita no ERP", data.clientes, pct(data.clientes, data.entrada)],
  ];
  const max = Math.max(1, data.entrada);
  return (
    <div className="space-y-2.5">
      {steps.map(([label, n, rate], i) => (
        <div key={label} className="grid grid-cols-[180px_1fr_70px] items-center gap-3">
          <p className="text-xs text-gray-400 text-right">{label}</p>
          <div className="h-9 bg-gray-800/50 rounded-lg overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(2, (n / max) * 100)}%` }} transition={{ duration: 0.7, delay: i * 0.08, ease: "easeOut" }}
              className="h-full rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-500 flex items-center px-3">
              <span className="text-xs font-semibold text-white">{n.toLocaleString("pt-BR")}</span>
            </motion.div>
          </div>
          <p className="text-xs text-gray-500">{rate || ""}</p>
        </div>
      ))}
      <div className="grid grid-cols-[180px_1fr] gap-3 pt-2">
        <p className="text-xs text-gray-400 text-right">Receita ERP após a entrada</p>
        <p className="text-lg font-semibold text-emerald-400">{fmtCur(data.receita)}</p>
      </div>
    </div>
  );
}