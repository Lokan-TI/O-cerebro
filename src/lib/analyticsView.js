// Visão client-side do bloco analytics do snapshot, filtrada pela empresa selecionada.
// CAP, est_mov e plano não têm dimensão empresa no Sisloc — permanecem consolidados.
import { useErpSnapshot } from "./ErpSnapshotContext";
import { useEmpresaFilter } from "./EmpresaFilterContext";
import { useGlobalFilter } from "./GlobalFilterContext";

export function buildAnalyticsView(a, emp) {
  if (!a) return null;
  const isAll = emp == null;
  const carByEmp = isAll ? (a.car_by_empresa || []) : (a.car_by_empresa || []).filter(r => r.cd_empresa === emp);
  const fichByEmp = isAll ? (a.fichloc_by_empresa || []) : (a.fichloc_by_empresa || []).filter(r => r.cd_empresa === emp);
  const recByEmp = isAll ? (a.receita_gerada_by_empresa || []) : (a.receita_gerada_by_empresa || []).filter(r => r.cd_empresa === emp);
  const sum = (arr, k) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const car_total = sum(carByEmp, "vl_total");
  const car_aberto = sum(carByEmp, "vl_aberto");
  const car_baixado = sum(carByEmp, "vl_baixado");
  const car_vencido = sum(carByEmp, "vl_vencido");
  const car_a_vencer = sum(carByEmp, "vl_a_vencer");
  const car_provisorio = sum(carByEmp, "vl_provisorio");
  const car_juros_multa = sum(carByEmp, "vl_juros_multa");
  const car_qtd = sum(carByEmp, "qtd");
  const car_qtd_com_juros = sum(carByEmp, "qtd_com_juros");
  // CAP = despesa real: contas do grupo "1" do plano financeiro são entradas
  // (incl. Transferência entre Contas) e ficam fora do total a pagar.
  const capRows = (a.cap_by_conta || []).filter(r => r.natureza !== "entrada");
  const capFora = (a.cap_by_conta || []).filter(r => r.natureza === "entrada");
  const cap_total = sum(capRows, "vl_total");
  const cap_aberto = sum(capRows, "vl_aberto");
  const cap_baixado = sum(capRows, "vl_baixado");
  const cap_vencido = sum(capRows, "vl_vencido");
  const cap_transferencias_internas = sum(capFora.filter(r => r.is_transferencia), "vl_total");
  const cap_excluido_total = sum(capFora, "vl_total");
  const fichloc_total = sum(fichByEmp, "qtd");
  const fichloc_ativas = sum(fichByEmp, "qtd_ativas");
  const fichloc_encerradas = sum(fichByEmp, "qtd_encerradas");
  const est_mov_total = sum(a.est_mov_by_operacao || [], "qtd");
  const receita_gerada = sum(recByEmp, "vl_gerado");
  const kpis = {
    ...(a.kpis || {}),
    car_total, car_aberto, car_baixado, car_vencido,
    car_liquidado: car_baixado, car_a_vencer, car_provisorio,
    car_juros_multa, car_qtd, car_qtd_com_juros,
    car_juros_pct_titulos: car_qtd > 0 ? (car_qtd_com_juros / car_qtd * 100) : null,
    cap_total, cap_aberto, cap_baixado, cap_vencido,
    cap_transferencias_internas, cap_excluido_total,
    fichloc_total, fichloc_ativas, fichloc_encerradas,
    est_mov_total, receita_gerada,
    margem_fluxo: car_total - cap_total,
    margem_percent: car_total > 0 ? ((car_total - cap_total) / car_total * 100) : null,
  };
  return { isAll, carByEmp, fichByEmp, recByEmp, kpis };
}

export function useAnalyticsView() {
  const { snapshot, loading } = useErpSnapshot();
  const { selectedEmpresa } = useEmpresaFilter();
  const { period } = useGlobalFilter();
  const analytics = snapshot?.analytics || null;
  const view = analytics ? buildAnalyticsView(analytics, selectedEmpresa) : null;
  return {
    analytics,
    view,
    loading,
    period,
    selectedEmpresa,
    isAll: selectedEmpresa == null,
    dateRange: analytics?.date_range || null,
  };
}