import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { Scale } from "lucide-react";

function Col({ title, subtitle, d, accent }) {
  return (
    <div className={`rounded-xl border p-4 ${accent}`}>
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="text-xs text-gray-400 mb-3">{subtitle}</div>
      <dl className="space-y-2 text-sm">
        {[
          ["Capital imobilizado", fmtCur(d.valor)],
          ["Depreciação anual", fmtCur(d.depreciacao)],
          ["Manutenção 12 meses", fmtCur(d.manutencao)],
          ["Ordens de serviço 12m", fmtNum(d.os)],
          ["Manutenção % do ativo", `${d.manut_pct.toFixed(1)}%`],
          ["Custo de posse anual", fmtCur(d.custo_posse)],
          ["Custo de posse % do ativo", `${d.posse_pct.toFixed(1)}%`],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <dt className="text-gray-400">{k}</dt>
            <dd className="text-white font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function FamiliaComparativo({ compare }) {
  const { plataformas, andaimes } = compare;
  const maisCaro = plataformas.posse_pct >= andaimes.posse_pct ? "plataformas elevatórias" : "andaimes e estruturas";
  const maisLeve = maisCaro === "plataformas elevatórias" ? "andaimes e estruturas" : "plataformas elevatórias";

  return (
    <div className="border border-gray-800 bg-gray-900/60 rounded-xl p-5">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Scale className="w-5 h-5 text-purple-400" /> Plataformas elevatórias × andaimes e estruturas
      </h2>
      <p className="text-sm text-gray-400 mt-1">
        Comparativo do custo de manter cada frente rodando: manutenção real do ERP e depreciação do ativo.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <Col
          title="Plataformas elevatórias"
          subtitle="Articuladas, tesoura, mastro vertical e low level"
          d={plataformas}
          accent="border-blue-700/50 bg-blue-950/20"
        />
        <Col
          title="Andaimes e estruturas"
          subtitle="Multidirecional, escoramento, fachadeiro, tubular e acessórios"
          d={andaimes}
          accent="border-emerald-700/50 bg-emerald-950/20"
        />
      </div>
      <p className="text-xs text-gray-400 mt-4 border-t border-gray-800 pt-3">
        Leitura: cada R$ 1 imobilizado em <span className="text-white">{maisCaro}</span> custa mais por ano para manter do
        que em <span className="text-white">{maisLeve}</span>. Plataformas concentram manutenção mecânica e vida útil
        menor; estruturas metálicas têm vida útil longa e manutenção baixa, mas exigem volume e giro para pagar o
        capital. Para decidir alocação de investimento, este custo deve ser confrontado com a receita de cada família —
        que ainda não está incluída nesta tela.
      </p>
    </div>
  );
}