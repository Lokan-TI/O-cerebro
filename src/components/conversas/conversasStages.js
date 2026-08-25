export const STAGES = [
  { id: "BOAS_VINDAS", label: "Recebeu boas-vindas, não pediu orçamento", color: "text-sky-400" },
  { id: "INTERESSE", label: "Visitou produtos ou clicou no CTA / Entrou em contato", color: "text-purple-400" },
  { id: "RECUPERACAO", label: "Recuperação | Pediu orçamento e sumiu", color: "text-amber-400" },
  { id: "POS_LOCACAO", label: "Pós-locação | Já alugou e devolveu equipamento", color: "text-emerald-400" },
  { id: "ORCAMENTO_ATIVO", label: "Orçamento em andamento", color: "text-blue-400" },
  { id: "CLIENTE_ATIVO", label: "Contrato fechado", color: "text-green-400" },
  { id: "DESCARTADO", label: "Fora do funil (spam/currículo)", color: "text-gray-500" },
];

export function stageLabel(id) {
  return STAGES.find((s) => s.id === id)?.label || id;
}