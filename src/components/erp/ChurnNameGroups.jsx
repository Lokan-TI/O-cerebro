import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronRight } from "lucide-react";
import { buildNameGroups, clientDocument } from "@/lib/nameGroups";

const fmtCurrency = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtDoc = (d) => {
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d || "—";
};

export default function ChurnNameGroups({ clients }) {
  const groups = useMemo(() => buildNameGroups(clients), [clients]);
  const [open, setOpen] = useState({});

  if (groups.length === 0) return null;

  const totalMembers = groups.reduce((s, g) => s + g.members.length, 0);
  const totalRevenue = groups.reduce((s, g) => s + g.revenue, 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Building2 className="w-4 h-4 text-amber-400" />
          Nomes quase iguais com documentos diferentes ({groups.length} grupos)
        </h3>
        <p className="text-gray-500 text-xs mt-1">
          {totalMembers} cadastros perdidos podem pertencer ao mesmo grupo econômico ou ser
          duplicidade de cadastro — {fmtCurrency(totalRevenue)} de receita no período de referência.
          Interpretação por nome normalizado; a decisão de unificar exige conferência.
        </p>
      </div>

      <div className="divide-y divide-gray-800">
        {groups.map((g) => (
          <div key={g.key}>
            <button
              onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/40"
            >
              {open[g.key] ? (
                <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
              )}
              <span className="text-white text-sm font-medium truncate">{g.key}</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
                  g.relation === "filiais"
                    ? "bg-blue-500/15 text-blue-300"
                    : "bg-amber-500/15 text-amber-300"
                }`}
              >
                {g.relation === "filiais" ? "Filiais (mesma raiz CNPJ)" : "Grupo provável / duplicidade"}
              </span>
              <span className="text-gray-400 text-xs shrink-0 ml-auto">
                {g.members.length} cadastros · {g.documents} documentos
              </span>
              <span className="text-red-400 text-xs font-medium shrink-0 w-28 text-right">
                {fmtCurrency(g.revenue)}
              </span>
            </button>

            {open[g.key] && (
              <div className="px-4 pb-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 uppercase tracking-wider">
                      <th className="py-2 text-left">Nome cadastrado</th>
                      <th className="py-2 text-left">Documento</th>
                      <th className="py-2 text-left">Cidade / UF</th>
                      <th className="py-2 text-right">Receita (ref.)</th>
                      <th className="py-2 text-right">Última NF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.members.map((m) => (
                      <tr key={m.cd_pessoa} className="border-t border-gray-800/60">
                        <td className="py-2 text-gray-200">{m.nm_pessoa || "—"}</td>
                        <td className="py-2 text-gray-300 whitespace-nowrap">{fmtDoc(clientDocument(m))}</td>
                        <td className="py-2 text-gray-400 whitespace-nowrap">
                          {[m.cidade_pessoa, m.uf_pessoa].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="py-2 text-red-400 text-right whitespace-nowrap">
                          {fmtCurrency(m.ref_revenue)}
                        </td>
                        <td className="py-2 text-gray-400 text-right whitespace-nowrap">
                          {m.ref_last_nf ? new Date(m.ref_last_nf + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}