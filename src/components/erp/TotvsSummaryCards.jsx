import { CheckCircle2, AlertTriangle } from "lucide-react";

const n = (v) => Number(v || 0).toLocaleString("pt-BR");
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const ISSUES = [
  ["sem_documento", "Sem CNPJ/CPF válido"],
  ["sem_nome", "Sem nome"],
  ["sem_filial", "Sem filial"],
  ["sem_natureza", "Sem natureza"],
  ["valor_invalido", "Valor zerado/negativo"],
  ["sem_vencimento", "Sem vencimento"],
];

export default function TotvsSummaryCards({ summary }) {
  const total = Number(summary.total || 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase mb-1">Títulos a migrar</div>
          <div className="text-2xl font-bold text-white">{n(total)}</div>
          <div className="text-xs text-gray-500 mt-1">{summary.emissao_min} → {summary.emissao_max}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase mb-1">Valor total</div>
          <div className="text-2xl font-bold text-white">{brl(summary.valor_total)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase mb-1">Em aberto</div>
          <div className="text-2xl font-bold text-blue-300">{n(summary.em_aberto)}</div>
          <div className="text-xs text-gray-500 mt-1">Saldo {brl(summary.saldo_total)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase mb-1">Identidade resolvida</div>
          <div className="text-2xl font-bold text-emerald-300">
            {total ? (((total - Number(summary.sem_documento || 0)) / total) * 100).toFixed(1) : "0,0"}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Com CNPJ/CPF válido para código + loja</div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="text-xs text-gray-500 uppercase mb-3">Pendências de saneamento</div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {ISSUES.map(([key, label]) => {
            const v = Number(summary[key] || 0);
            const ok = v === 0;
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                {ok
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                <span className={ok ? "text-gray-400" : "text-gray-200"}>{label}</span>
                <span className={`ml-auto font-medium ${ok ? "text-emerald-400" : "text-amber-300"}`}>{n(v)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}