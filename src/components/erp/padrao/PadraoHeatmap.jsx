const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const SHADES = ["bg-gray-800", "bg-purple-900", "bg-purple-700", "bg-purple-500", "bg-purple-300"];

export default function PadraoHeatmap({ data }) {
  const now = new Date();
  const anos = [now.getFullYear() - 3, now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];
  const map = new Map(data.map((d) => [`${d.ano}-${d.mes}`, Number(d.qtd_fichas) || 0]));
  const max = Math.max(1, ...map.values());
  const shade = (n) => (n <= 0 ? SHADES[0] : SHADES[Math.min(4, Math.ceil((n / max) * 4))]);
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1 min-w-[520px]" style={{ gridTemplateColumns: "48px repeat(12, 1fr)" }}>
        <div />
        {MESES.map((m) => <div key={m} className="text-[10px] text-gray-500 text-center">{m}</div>)}
        {anos.map((a) => [
          <div key={a} className="text-xs text-gray-400 flex items-center">{a}</div>,
          ...MESES.map((_, i) => {
            const n = map.get(`${a}-${i + 1}`) || 0;
            return <div key={`${a}-${i}`} title={`${MESES[i]}/${a}: ${n} fichas`} className={`h-7 rounded flex items-center justify-center text-[10px] text-white ${shade(n)}`}>{n || ""}</div>;
          }),
        ])}
      </div>
    </div>
  );
}