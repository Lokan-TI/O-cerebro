import { SEGMENTS, GRID } from "@/lib/rfm";

// Calcula a área (linha/coluna inicial e final) de cada segmento no grid 5×5.
function areas() {
  const a = {};
  GRID.forEach((row, r) => row.forEach((k, c) => {
    const x = (a[k] ||= { r0: r, r1: r, c0: c, c1: c });
    x.r1 = r; x.c1 = Math.max(x.c1, c); x.c0 = Math.min(x.c0, c);
  }));
  return a;
}

export default function RfmSegmentMap({ segs, total }) {
  return (
    <div className="flex gap-2 h-full">
      <div className="flex items-center"><span className="text-[10px] text-gray-500 -rotate-90 whitespace-nowrap w-4">Frequência e Monetário</span></div>
      <div className="flex-1">
        <div className="grid grid-cols-5 grid-rows-5 gap-1 h-80">
          {Object.entries(areas()).map(([k, a]) => (
            <div key={k} className={`${SEGMENTS[k].color} rounded-md p-2 flex flex-col items-center justify-center text-center text-gray-950`}
              style={{ gridRow: `${a.r0 + 1} / ${a.r1 + 2}`, gridColumn: `${a.c0 + 1} / ${a.c1 + 2}` }}>
              <span className="text-[10px] font-semibold leading-tight">{SEGMENTS[k].label}</span>
              <span className="text-base font-bold">{total ? ((segs[k].qtd / total) * 100).toFixed(2).replace(".", ",") : "0,00"}%</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 text-center mt-1">Recência (R1 → R5)</p>
      </div>
    </div>
  );
}