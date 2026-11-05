import { useState, useMemo, useEffect } from "react";
import { byEmpresa, monthlySeries, anosDisponiveis, sumRows } from "@/lib/carAnalise";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import CarEmpresaTable from "@/components/financeiro/car/CarEmpresaTable";
import CarEvolucaoChart from "@/components/financeiro/car/CarEvolucaoChart";
import CarKpis from "@/components/financeiro/car/CarKpis";

export default function CarEmpresaDetalhe({ rows }) {
  const empresas = useMemo(() => byEmpresa(rows), [rows]);
  const anos = useMemo(() => anosDisponiveis(rows), [rows]);
  const [emp, setEmp] = useState(undefined);
  const [ano, setAno] = useState(null);

  useEffect(() => {
    if (!empresas.some((e) => e.cd_empresa === emp)) setEmp(empresas[0]?.cd_empresa);
  }, [empresas]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!anos.includes(ano)) setAno(anos[0] ?? null); }, [anos]); // eslint-disable-line react-hooks/exhaustive-deps

  const empRows = useMemo(() => rows.filter((r) => r.cd_empresa === emp), [rows, emp]);
  const anoRows = useMemo(() => empRows.filter((r) => r.ano === ano), [empRows, ano]);
  const serie = useMemo(() => monthlySeries(anoRows), [anoRows]);
  const nome = emp == null ? "Sem empresa" : getEmpresaLabel(emp);

  return (
    <div className="space-y-4">
      <CarEmpresaTable empresas={empresas} selected={emp} onSelect={setEmp} />
      {emp !== undefined && empresas.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-white font-semibold text-sm">Evolução de {nome} em {ano}</h3>
            <select value={ano ?? ""} onChange={(e) => setAno(Number(e.target.value))} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white">
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <CarKpis t={sumRows(anoRows)} />
          <CarEvolucaoChart data={serie} />
        </div>
      )}
    </div>
  );
}