import { fmtCur, fmtNum } from "@/lib/erpFormat";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const pctTxt = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);
const dayTxt = (v) => (v == null ? "—" : `${v.toFixed(1)} d`);

function Panel({ title, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-semibold text-sm mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function ConversionBreakdowns({ byVendor, byEmpresa, windows, statusDistribution }) {
  const winData = (windows || []).map((w) => ({ label: w.label, Ficha: w.ficha, "Nota fiscal": w.nf }));
  const stData = (statusDistribution || []).map((s) => ({ status: s.status, Clientes: s.qtd }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Janelas de conversão (dias após o cadastro)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={winData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" stroke="#6b7280" fontSize={10} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Ficha" fill="#2563eb" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Nota fiscal" fill="#16a34a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Distribuição dos status da conversão">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" stroke="#6b7280" fontSize={11} />
              <YAxis type="category" dataKey="status" stroke="#6b7280" fontSize={9} width={190} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="Clientes" fill="#9333ea" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Conversão por vendedor (vendedor da primeira ficha)">
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left py-2 px-2">Vendedor</th>
                <th className="text-right py-2 px-2">Novos</th>
                <th className="text-right py-2 px-2">Ficha</th>
                <th className="text-right py-2 px-2">NF</th>
                <th className="text-right py-2 px-2">Sem ficha</th>
                <th className="text-right py-2 px-2">Cad→Ficha</th>
                <th className="text-right py-2 px-2">Cad→NF</th>
                <th className="text-right py-2 px-2">T. ficha</th>
                <th className="text-right py-2 px-2">T. NF</th>
                <th className="text-right py-2 px-2">Faturamento</th>
                <th className="text-right py-2 px-2">Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {(byVendor || []).map((v) => (
                <tr key={v.vendedor} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-2 text-white truncate max-w-[200px]">{v.vendedor}</td>
                  <td className="py-2 px-2 text-right text-gray-200">{fmtNum(v.novos)}</td>
                  <td className="py-2 px-2 text-right text-blue-400">{fmtNum(v.com_ficha)}</td>
                  <td className="py-2 px-2 text-right text-green-400">{fmtNum(v.com_nf)}</td>
                  <td className="py-2 px-2 text-right text-amber-400">{fmtNum(v.sem_ficha)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{pctTxt(v.taxa_ficha)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{pctTxt(v.taxa_nf)}</td>
                  <td className="py-2 px-2 text-right text-gray-400">{dayTxt(v.tempo_medio_ficha)}</td>
                  <td className="py-2 px-2 text-right text-gray-400">{dayTxt(v.tempo_medio_nf)}</td>
                  <td className="py-2 px-2 text-right text-green-400">{fmtCur(v.faturamento)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{fmtCur(v.ticket_medio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Conversão por filial">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left py-2 px-2">Filial</th>
                <th className="text-right py-2 px-2">Novos</th>
                <th className="text-right py-2 px-2">Com ficha</th>
                <th className="text-right py-2 px-2">Com NF</th>
                <th className="text-right py-2 px-2">Cad→Ficha</th>
                <th className="text-right py-2 px-2">Cad→NF</th>
                <th className="text-right py-2 px-2">Faturamento</th>
                <th className="text-right py-2 px-2">Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {(byEmpresa || []).map((e) => (
                <tr key={e.empresa} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-2 text-white">{e.empresa}</td>
                  <td className="py-2 px-2 text-right text-gray-200">{fmtNum(e.novos)}</td>
                  <td className="py-2 px-2 text-right text-blue-400">{fmtNum(e.com_ficha)}</td>
                  <td className="py-2 px-2 text-right text-green-400">{fmtNum(e.com_nf)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{pctTxt(e.taxa_ficha)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{pctTxt(e.taxa_nf)}</td>
                  <td className="py-2 px-2 text-right text-green-400">{fmtCur(e.faturamento)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{fmtCur(e.ticket_medio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}