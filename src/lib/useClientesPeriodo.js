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
  const [prev, setPrev] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPrev(null);
    const sourceId = selectedSource?.id && selectedSource.id !== ALL_SOURCES_ID ? selectedSource.id : null;
    fetchClientesAtivos(sourceId, period.start, period.end, snapshot?.version)
      .then((d) => alive && setData(d || null))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    // Janela anterior de mesma duração, terminando no dia anterior ao início do período.
    const day = 86400000;
    const s = new Date(`${period.start}T00:00:00Z`).getTime();
    const e = new Date(`${period.end}T00:00:00Z`).getTime();
    const pe = new Date(s - day).toISOString().slice(0, 10);
    const ps = new Date(s - day - (e - s)).toISOString().slice(0, 10);
    fetchClientesAtivos(sourceId, ps, pe, snapshot?.version)
      .then((d) => alive && setPrev(d || null))
      .catch(() => alive && setPrev(null));
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
    const fiscalOf = (d, cd) => cd == null ? Number(d?.faturamento_fiscal_total || 0)
      : Number((d?.fiscal_by_empresa || []).find((r) => Number(r.cd_empresa) === Number(cd))?.faturamento_fiscal || 0);
    const faturamento_fiscal_ant = prev ? fiscalOf(prev, selectedEmpresa) : null;
    const pct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    const crescimentoByEmpresa = (cd) => (prev ? pct(fiscalOf(data, cd), fiscalOf(prev, cd)) : null);
    return { clientes: clientes.size, receita_clientes, nfs, faturamento_fiscal, faturamento_fiscal_ant,
      crescimento: faturamento_fiscal_ant != null ? pct(faturamento_fiscal, faturamento_fiscal_ant) : null,
      crescimentoByEmpresa, fiscalByEmpresa: data.fiscal_by_empresa || [] };
  }, [data, prev, selectedEmpresa]);

  return { live, loading };
}