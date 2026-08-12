// Consolida vários snapshots ERP (multi-base) em um único snapshot "Todas as bases".
const SUM_KPIS = [
  "fat_ano", "fat_ano_ant", "fat_mes", "nfs_ano", "nfs_mes", "clientes_ano", "clientes_mes",
  "new_clients", "new_client_revenue", "retained_revenue", "retained_clients",
  "clients_last_year", "churned_clients",
];
const SUM_ANALYTICS = [
  "car_total", "car_aberto", "car_vencido", "cap_total", "cap_aberto", "receita_gerada",
  "margem_fluxo", "fichloc_total", "fichloc_ativas", "fichloc_encerradas",
  "fichloc_clientes_ativos", "pessoa_total", "est_mov_total",
];

const sumBy = (rows, keys, pick) => {
  const out = {};
  for (const key of keys) {
    out[key] = rows.reduce((s, r) => s + Number(pick(r)?.[key] || 0), 0);
  }
  return out;
};

export function mergeSnapshots(snapshots) {
  const rows = (snapshots || []).filter(Boolean);
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  const k = sumBy(rows, SUM_KPIS, (r) => r.kpis || {});
  const a = sumBy(rows, SUM_ANALYTICS, (r) => r.analytics?.kpis || {});

  k.ticket_ano = k.nfs_ano ? k.fat_ano / k.nfs_ano : 0;
  k.ticket_mes = k.nfs_mes ? k.fat_mes / k.nfs_mes : 0;
  k.crescimento_ano = k.fat_ano_ant ? ((k.fat_ano - k.fat_ano_ant) / k.fat_ano_ant) * 100 : 0;
  k.retention_rate = k.clients_last_year ? (k.retained_clients / k.clients_last_year) * 100 : 0;
  k.churn_rate = k.clients_last_year ? (k.churned_clients / k.clients_last_year) * 100 : 0;
  k.receita_por_cliente = k.clientes_ano ? k.fat_ano / k.clientes_ano : 0;
  // Concentração e margem: média ponderada pelo faturamento de cada base
  const weighted = (get) => {
    const total = rows.reduce((s, r) => s + Number(r.kpis?.fat_ano || 0), 0);
    if (!total) return 0;
    return rows.reduce((s, r) => s + Number(get(r) || 0) * Number(r.kpis?.fat_ano || 0), 0) / total;
  };
  k.concentracao_top10 = weighted((r) => r.kpis?.concentracao_top10);
  a.margem_percent = weighted((r) => r.analytics?.kpis?.margem_percent);

  const opMap = new Map();
  for (const r of rows) {
    for (const o of r.analytics?.est_mov_by_operacao || []) {
      const key = o.ds_movoperacao || "—";
      opMap.set(key, { ds_movoperacao: key, qtd: (opMap.get(key)?.qtd || 0) + Number(o.qtd || 0) });
    }
  }

  return {
    id: "__all__",
    source_id: "__all__",
    source_name: "Todas as bases",
    is_current: true,
    max_date: rows.map((r) => r.max_date).filter(Boolean).sort().pop() || null,
    kpis: k,
    analytics: { kpis: a, est_mov_by_operacao: [...opMap.values()] },
    by_empresa: rows.flatMap((r) => r.by_empresa || []),
    top_clients: rows.flatMap((r) => r.top_clients || []),
    alerts: rows.flatMap((r) => r.alerts || []),
    merged_sources: rows.map((r) => r.source_name).filter(Boolean),
  };
}