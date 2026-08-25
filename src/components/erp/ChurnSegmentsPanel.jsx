const GROWTH_LABELS = {
  ATIVO_CONTRATO: "Ativo — ficha aberta saudável",
  ATIVO_CONTRATO_ALERTA: "Ativo — ficha aberta com alerta de faturamento",
  ATIVO_RECENTE: "Ativo — sem ficha aberta, NF recente",
  MONITORAR: "Monitorar recompra",
  PRE_CHURN: "Pré-churn / janela de recompra",
  CHURN_CONFIRMADO: "Churn confirmado",
  AUDITAR_SEM_NF: "Auditar — locação sem NF válida",
};

const BILLING_LABELS = {
  DIARIA: "Diária",
  SEMANAL: "Semanal",
  QUINZENAL: "Quinzenal",
  MENSAL: "Mensal",
  CICLO_LONGO: "Ciclo longo (36–100 dias)",
  MULTIMENSAL: "Multimensal",
  ANUAL: "Anual",
  NAO_CLASSIFICADO: "Não classificado",
};

const HORIZON_LABELS = {
  ATE_2_DIAS: "Até 2 dias",
  "3_A_8_DIAS": "3 a 8 dias",
  "9_A_16_DIAS": "9 a 16 dias",
  "17_A_45_DIAS": "17 a 45 dias",
  "46_A_180_DIAS": "46 a 180 dias",
  "181_A_300_DIAS": "181 a 300 dias",
  "301_DIAS_OU_MAIS": "301 dias ou mais",
  NAO_CLASSIFICADO: "Não classificado",
};

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function SegmentTable({ title, subtitle, rows = [], labels = {} }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-950 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Segmento</th>
              <th className="text-right px-4 py-2 font-medium">Clientes</th>
              <th className="text-right px-4 py-2 font-medium">Ativos</th>
              <th className="text-right px-4 py-2 font-medium">Churn</th>
              <th className="text-right px-4 py-2 font-medium">Auditar</th>
              <th className="text-right px-4 py-2 font-medium">Receita ref.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-gray-800">
                <td className="px-4 py-2 text-gray-300">{labels[r.label] || r.label}</td>
                <td className="px-4 py-2 text-right text-white">{Number(r.clients || 0).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2 text-right text-emerald-400">{Number(r.active || 0).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2 text-right text-red-400">{Number(r.churned || 0).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2 text-right text-amber-400">{Number(r.audit || 0).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2 text-right text-gray-300">{brl(r.revenue_ref)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">Sem dados para segmentar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ChurnSegmentsPanel({ segments, summary }) {
  if (!segments) return null;
  return (
    <div className="space-y-3">
      <div className="bg-cyan-950/20 border border-cyan-900/60 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-cyan-200">Leitura de Growth Marketing</h3>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
          A hierarquia oficial agora é: <span className="text-cyan-200">ficha aberta primeiro → última NF válida depois → {summary?.inactivity_months || 13} meses por último</span>.
          Se existe ficha efetivamente aberta, o cliente permanece ativo. Se todas estão encerradas, somente a última NF válida de locação renova a recência.
          Casos com locação efetiva sem NF ficam em auditoria e não entram automaticamente no denominador de churn.
        </p>
      </div>

      <SegmentTable
        title="Status de Growth"
        subtitle="Separa contrato em andamento, recompra, pré-churn, churn confirmado e exceções para auditoria."
        rows={segments.growth_status || []}
        labels={GROWTH_LABELS}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <SegmentTable
          title="Periodicidade de faturamento da locação"
          subtitle="Derivada de fich_loc.cd_calcfat → calcfat.num_dias_periodo."
          rows={segments.billing_cycle || []}
          labels={BILLING_LABELS}
        />
        <SegmentTable
          title="Horizonte estimado do contrato"
          subtitle="Duração total estimada pela vigência prevista ou nº de períodos × dias por período."
          rows={segments.contract_horizon || []}
          labels={HORIZON_LABELS}
        />
      </div>
    </div>
  );
}
