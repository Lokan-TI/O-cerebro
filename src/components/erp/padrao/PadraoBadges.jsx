const TEND = {
  CRESCENTE: ["Crescente", "bg-emerald-900/50 text-emerald-300 border-emerald-700/50"],
  ESTAVEL: ["Estável", "bg-gray-800 text-gray-300 border-gray-700"],
  DECRESCENTE: ["Decrescente", "bg-red-900/50 text-red-300 border-red-700/50"],
  NOVO_PADRAO: ["Novo padrão", "bg-sky-900/40 text-sky-300 border-sky-700/50"],
  SEM_FICHAS_RECENTES: ["Sem fichas recentes", "bg-gray-800 text-gray-500 border-gray-700"],
};
const CICLO = {
  CICLO_VENCIDO: ["Ciclo vencido", "bg-red-900/50 text-red-300 border-red-700/50"],
  APROXIMANDO_CICLO: ["Aproximando", "bg-amber-900/50 text-amber-300 border-amber-700/50"],
  DENTRO_DO_CICLO: ["Dentro do ciclo", "bg-gray-800 text-gray-300 border-gray-700"],
  SEM_PADRAO_RECORRENTE: ["Sem padrão", "bg-gray-800 text-gray-500 border-gray-700"],
};

function Badge({ map, value }) {
  const [label, cls] = map[value] || ["—", "bg-gray-800 text-gray-500 border-gray-700"];
  return <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded border text-[11px] ${cls}`}>{label}</span>;
}

export const TendenciaBadge = ({ value }) => <Badge map={TEND} value={value} />;
export const CicloBadge = ({ value }) => <Badge map={CICLO} value={value} />;

export default TendenciaBadge;