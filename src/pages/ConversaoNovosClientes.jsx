import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";
import { useGlobalFilter } from "@/lib/GlobalFilterContext";
import ConversionHeader from "@/components/conversao/ConversionHeader";
import ConversionKpis from "@/components/conversao/ConversionKpis";
import ConversionFunnel from "@/components/conversao/ConversionFunnel";
import ConversionCohorts from "@/components/conversao/ConversionCohorts";
import ConversionBreakdowns from "@/components/conversao/ConversionBreakdowns";
import ConversionClientsTable from "@/components/conversao/ConversionClientsTable";
import ConversionQuality from "@/components/conversao/ConversionQuality";
import ConversionDocsPanel from "@/components/conversao/ConversionDocsPanel";

function toCsv(clients) {
  const cols = ["gid", "cd_pessoa", "nome", "doc", "doc_tipo", "dt_cad", "coorte", "nm_empresa", "vendedor_ficha",
    "dt_ficha", "nr_ficha", "dias_ficha", "qtd_fichas", "fichas_ativas", "dt_nf", "nr_nf", "dias_nf",
    "vl_primeira_nf", "vl_total", "qtd_nfs", "qtd_nfs_canceladas", "status", "duplicidade"];
  const head = cols.join(";");
  const body = clients.map((c) => cols.map((k) => String(c[k] ?? "").replace(/;/g, ",")).join(";")).join("\n");
  return `${head}\n${body}`;
}

export default function ConversaoNovosClientes() {
  const { selectedSource } = useErpSource();
  // Período do filtro global — mesma janela usada em todas as abas.
  const { period } = useGlobalFilter();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!selectedSource) return;
    setLoading(true);
    const list = await base44.entities.ClientConversionSnapshot.filter(
      { source_id: selectedSource.id, is_current: true }, "-created_date", 1
    );
    setSnapshot(list[0] || null);
    setLoading(false);
  }, [selectedSource]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    if (!selectedSource) return;
    setRefreshing(true);
    setError(null);
    const res = await base44.functions.invoke("refreshClientConversion", {
      source_id: selectedSource.id,
      start_date: period.start,
      end_date: period.endExclusive,
    });
    if (res?.data?.success) {
      await load();
    } else {
      setError(res?.data?.error || "Falha ao atualizar os dados. A versão anterior continua publicada.");
    }
    setRefreshing(false);
  };

  const handleExport = () => {
    const csv = toCsv(snapshot?.clients || []);
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversao-novos-clientes-${snapshot?.version || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lists = useMemo(() => {
    const clients = snapshot?.clients || [];
    return {
      statusList: [...new Set(clients.map((c) => c.status))].sort(),
      empresaList: [...new Set(clients.map((c) => c.nm_empresa).filter(Boolean))].sort(),
      vendorList: [...new Set(clients.map((c) => c.vendedor_ficha).filter(Boolean))].sort(),
    };
  }, [snapshot]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <ConversionHeader
        snapshot={snapshot}
        loading={loading}
        refreshing={refreshing}
        error={error}
        periodStart={period.start}
        periodEnd={period.end}
        periodEndExclusive={period.endExclusive}
        onRefresh={handleRefresh}
        onExport={handleExport}
      />

      {!snapshot ? (
        <div className="text-gray-500 text-center py-16 text-sm">
          {loading ? "Carregando camada analítica…" : 'Nenhuma versão publicada para esta fonte. Selecione o período e clique em "Atualizar dados".'}
        </div>
      ) : (
        <>
          <ConversionKpis k={snapshot.kpis || {}} />
          <ConversionFunnel funnel={snapshot.funnel || []} />
          <ConversionCohorts cohorts={snapshot.cohorts} />
          <ConversionBreakdowns
            byVendor={snapshot.by_vendor}
            byEmpresa={snapshot.by_empresa}
            windows={snapshot.windows}
            statusDistribution={snapshot.status_distribution}
          />
          <ConversionClientsTable
            clients={snapshot.clients}
            truncated={snapshot.clients_truncated}
            {...lists}
          />
          <ConversionQuality
            duplicates={snapshot.duplicates}
            validations={snapshot.validations}
            clients={snapshot.clients}
          />
          <ConversionDocsPanel />
        </>
      )}
    </div>
  );
}