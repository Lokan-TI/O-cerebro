// Recorta o snapshot para uma empresa específica, mantendo o mesmo formato
// esperado por buildDecisionKpis. cdEmpresa null = consolidado (geral).
export function scopeSnapshotByEmpresa(snapshot, cdEmpresa) {
  if (!snapshot || cdEmpresa == null) return snapshot;

  const kpis = (snapshot.by_empresa || []).find((e) => e.cd_empresa === cdEmpresa);
  const a = snapshot.analytics || {};
  const pick = (list) => (list || []).find((r) => r.cd_empresa === cdEmpresa) || {};
  const car = pick(a.car_by_empresa);
  const fich = pick(a.fichloc_by_empresa);
  const rec = pick(a.receita_gerada_by_empresa);

  return {
    ...snapshot,
    kpis: kpis || {},
    analytics: {
      ...a,
      kpis: {
        car_total: car.vl_total,
        car_aberto: car.vl_aberto,
        car_vencido: car.vl_vencido,
        receita_gerada: rec.vl_gerado,
        fichloc_total: fich.qtd,
        fichloc_ativas: fich.qtd_ativas,
        fichloc_encerradas: fich.qtd_encerradas,
      },
    },
  };
}

export function empresaOptions(snapshot) {
  const list = snapshot?.analytics?.empresas?.length
    ? snapshot.analytics.empresas.map((e) => ({ cd_empresa: e.cd_empresa, nm_empresa: e.nm_fan_empresa }))
    : (snapshot?.by_empresa || []).map((e) => ({ cd_empresa: e.cd_empresa, nm_empresa: e.nm_empresa }));
  return list.sort((a, b) => a.cd_empresa - b.cd_empresa);
}