import { useEffect, useMemo, useState } from "react";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { useErpSnapshot } from "@/lib/ErpSnapshotContext";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import { fetchClientesAtivos } from "@/components/erp/clientesAtivosCache";

// Fonte de verdade da aba Cliente: faturamento fiscal (NF) e clientes ativos do período do filtro,
// via a mesma consulta ao vivo (cache compartilhado). Use em qualquer módulo que exiba esses números.
export default function useClientesPeriodo(selectedEmpresa) {
  const { selectedSource } = useErpSource();
  const { snapshot } = useErpSnapshot();
  const { period } = useGlobalFilter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : null;
    fetchClientesAtivos(sourceId, period.start, period.end, snapshot?.version)
      .then((d) => alive && setData(d || null))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [period.start, period.end, selectedSource?.id, snapshot?.version]);

  const live = useMemo(() => {
    if (!data) return null;
    const rows = (data.rows || []).filter((r) => selectedEmpresa == null || Number(r.cd_empresa) === Number(selectedEmpresa));
    const clientes = new Set(rows.map((r) => r.cd_pessoa));
    const receita_clientes = rows.reduce((s, r) => s + (Number(r.receita) || 0), 0);
    const nfs = rows.reduce((s, r) => s + (Number(r.nfs) || 0), 0);
    const emp = (data.fiscal_by_empresa || []).find((r) => Number(r.cd_empresa) === Number(selectedEmpresa));
    const faturamento_fiscal = selectedEmpresa == null ? Number(data.faturamento_fiscal_total || 0) : Number(emp?.faturamento_fiscal || 0);
    return { clientes: clientes.size, receita_clientes, nfs, faturamento_fiscal, fiscalByEmpresa: data.fiscal_by_empresa || [] };
  }, [data, selectedEmpresa]);

  return { live, loading };
}