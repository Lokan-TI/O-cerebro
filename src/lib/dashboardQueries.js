// Catálogo das queries SQL executadas pelo sync (refreshErpData + analyticsBlock)
// que capturam os dados exibidos nos dashboards. Espelha os templates do back-end
// (base44/functions/refreshErpData + base44/shared/analyticsBlock).
//
// As queries de nf usam fragments GETDATE() (valem direto no SQL Server).
// As queries de analytics usam {start}/{end} = período selecionado no filtro global.

export const DASHBOARD_QUERIES = [
  {
    id: "kpi_financeiro",
    group: "Financeiro (nf)",
    label: "KPIs financeiros combinados (ano × mês × ano anterior)",
    sql: `SELECT
  ISNULL(SUM(CASE WHEN dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
    AND dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1)) THEN vl_faturamento ELSE 0 END),0) AS fat_ano,
  ISNULL(SUM(CASE WHEN dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE())-1,1,1)
    AND dt_emi_nf < DATEADD(year,-1,GETDATE()) THEN vl_faturamento ELSE 0 END),0) AS fat_ano_ant,
  ISNULL(SUM(CASE WHEN dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)
    AND dt_emi_nf < DATEADD(month,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)) THEN vl_faturamento ELSE 0 END),0) AS fat_mes,
  ISNULL(SUM(CASE WHEN dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE())-1,MONTH(GETDATE()),1)
    AND dt_emi_nf < DATEADD(month,1,DATEFROMPARTS(YEAR(GETDATE())-1,MONTH(GETDATE()),1)) THEN vl_faturamento ELSE 0 END),0) AS fat_mes_ant,
  COUNT(CASE WHEN dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)
    AND dt_emi_nf < DATEADD(month,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)) THEN 1 END) AS nfs_mes,
  COUNT(CASE WHEN dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
    AND dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1)) THEN 1 END) AS nfs_ano,
  COUNT(DISTINCT CASE WHEN dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)
    AND dt_emi_nf < DATEADD(month,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)) THEN cd_pessoa END) AS clientes_mes,
  COUNT(DISTINCT CASE WHEN dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
    AND dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1)) THEN cd_pessoa END) AS clientes_ano,
  MAX(dt_emi_nf) AS max_date
FROM nf
WHERE dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE())-1,1,1)
  AND dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))
  AND fl_can_nf <> 'S'`,
  },
  {
    id: "clientes_fichloc_empresa",
    group: "Clientes (locação)",
    label: "Clientes ativos por locação (fich_loc) por empresa",
    sql: `SELECT cd_empresa,
  COUNT(DISTINCT CASE WHEN dt_pedido >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
    AND dt_pedido < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1)) THEN cd_pessoa END) AS clientes_ano,
  COUNT(DISTINCT CASE WHEN dt_pedido >= DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)
    AND dt_pedido < DATEADD(month,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)) THEN cd_pessoa END) AS clientes_mes
FROM fich_loc WITH (NOLOCK)
WHERE dt_pedido >= DATEFROMPARTS(YEAR(GETDATE())-1,1,1)
  AND dt_pedido < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))
  AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''
GROUP BY cd_empresa`,
  },
  {
    id: "clientes_fichloc_global",
    group: "Clientes (locação)",
    label: "Clientes ativos global distinto (fich_loc)",
    sql: `SELECT
  COUNT(DISTINCT CASE WHEN dt_pedido >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
    AND dt_pedido < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1)) THEN cd_pessoa END) AS clientes_ano,
  COUNT(DISTINCT CASE WHEN dt_pedido >= DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)
    AND dt_pedido < DATEADD(month,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)) THEN cd_pessoa END) AS clientes_mes
FROM fich_loc WITH (NOLOCK)
WHERE dt_pedido >= DATEFROMPARTS(YEAR(GETDATE())-1,1,1)
  AND dt_pedido < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))
  AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''`,
  },
  {
    id: "top_clientes",
    group: "Top clientes",
    label: "Top 100 clientes por faturamento (ano)",
    sql: `SELECT TOP 100 cd_pessoa, ISNULL(SUM(vl_faturamento),0) AS total, COUNT(*) AS nfs, MAX(dt_emi_nf) AS ultima_nf
FROM nf
WHERE dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
  AND dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))
  AND fl_can_nf <> 'S'
GROUP BY cd_pessoa
ORDER BY ISNULL(SUM(vl_faturamento),0) DESC`,
  },
  {
    id: "top_clientes_empresa",
    group: "Top clientes",
    label: "Top 15 clientes por empresa (particionado)",
    sql: `SELECT cd_empresa, cd_pessoa, total, nfs, ultima_nf FROM (
  SELECT cd_empresa, cd_pessoa, ISNULL(SUM(vl_faturamento),0) AS total, COUNT(*) AS nfs, MAX(dt_emi_nf) AS ultima_nf,
    ROW_NUMBER() OVER (PARTITION BY cd_empresa ORDER BY ISNULL(SUM(vl_faturamento),0) DESC) AS rn
  FROM nf WITH (NOLOCK)
  WHERE dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
    AND dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))
    AND fl_can_nf <> 'S'
  GROUP BY cd_empresa, cd_pessoa
) x WHERE rn <= 15 ORDER BY cd_empresa, rn`,
  },
  {
    id: "top_vendedores",
    group: "Top vendedores",
    label: "Top 15 vendedores por comissão (financas_car_comissao × nf)",
    sql: `SELECT TOP 15 c.cd_pessoa,
  COALESCE(NULLIF(p.nm_fan_pessoa,''), p.nm_pessoa) AS nm_pessoa,
  ISNULL(SUM(c.vl_base_comissao),0) AS total,
  COUNT(DISTINCT c.cd_nf) AS nfs
FROM financas_car_comissao c WITH (NOLOCK)
JOIN nf n WITH (NOLOCK) ON n.cd_nf = c.cd_nf
JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = c.cd_pessoa
WHERE n.dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
  AND n.dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))
  AND n.fl_can_nf <> 'S'
  AND c.cd_pessoa IS NOT NULL
GROUP BY c.cd_pessoa, p.nm_fan_pessoa, p.nm_pessoa
ORDER BY ISNULL(SUM(c.vl_base_comissao),0) DESC`,
  },
  {
    id: "top_vendedores_empresa",
    group: "Top vendedores",
    label: "Top 15 vendedores por empresa (particionado)",
    sql: `SELECT cd_empresa, cd_pessoa, nm_pessoa, total, nfs FROM (
  SELECT n.cd_empresa, c.cd_pessoa,
    COALESCE(NULLIF(p.nm_fan_pessoa,''), p.nm_pessoa) AS nm_pessoa,
    ISNULL(SUM(c.vl_base_comissao),0) AS total,
    COUNT(DISTINCT c.cd_nf) AS nfs,
    ROW_NUMBER() OVER (PARTITION BY n.cd_empresa ORDER BY ISNULL(SUM(c.vl_base_comissao),0) DESC) AS rn
  FROM financas_car_comissao c WITH (NOLOCK)
  JOIN nf n WITH (NOLOCK) ON n.cd_nf = c.cd_nf
  JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = c.cd_pessoa
  WHERE n.dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
    AND n.dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))
    AND n.fl_can_nf <> 'S'
    AND c.cd_pessoa IS NOT NULL
  GROUP BY n.cd_empresa, c.cd_pessoa, p.nm_fan_pessoa, p.nm_pessoa
) x WHERE rn <= 15 ORDER BY cd_empresa, rn`,
  },
  {
    id: "nomes_clientes",
    group: "Resolução de nomes",
    label: "Resolução de nomes de clientes (pessoa)",
    sql: `SELECT cd_pessoa, COALESCE(NULLIF(nm_fan_pessoa,''), nm_pessoa) AS nome
FROM pessoa WITH (NOLOCK)
WHERE cd_pessoa IN ({cd_pessoa_lista})`,
  },
  {
    id: "serie_mensal",
    group: "Séries temporais",
    label: "Série mensal de faturamento (12 meses por empresa)",
    sql: `SELECT cd_empresa, YEAR(dt_emi_nf) AS ano, MONTH(dt_emi_nf) AS mes,
  ISNULL(SUM(vl_faturamento),0) AS valor, COUNT(*) AS nfs, COUNT(DISTINCT cd_pessoa) AS clientes
FROM nf
WHERE dt_emi_nf >= DATEADD(month,-12,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))
  AND dt_emi_nf < DATEADD(month,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))
  AND fl_can_nf <> 'S'
GROUP BY cd_empresa, YEAR(dt_emi_nf), MONTH(dt_emi_nf)
ORDER BY 1, 2, 3`,
  },
  {
    id: "coorte_ano_passado",
    group: "Coorte / Retenção",
    label: "Coorte — clientes com remessa aprovada (ano passado)",
    sql: `SELECT DISTINCT f.cd_empresa, f.cd_pessoa
FROM fich_loc f WITH (NOLOCK)
INNER JOIN fl_remessa r WITH (NOLOCK) ON r.cd_controle = f.cd_controle
WHERE r.dt_saida IS NOT NULL
  AND r.fl_cancelada <> 'S'
  AND r.dt_saida >= DATEFROMPARTS(YEAR(GETDATE())-1,1,1)
  AND r.dt_saida < DATEFROMPARTS(YEAR(GETDATE()),1,1)`,
  },
  {
    id: "coorte_ano_atual",
    group: "Coorte / Retenção",
    label: "Coorte — clientes com remessa aprovada (ano atual)",
    sql: `SELECT DISTINCT f.cd_empresa, f.cd_pessoa
FROM fich_loc f WITH (NOLOCK)
INNER JOIN fl_remessa r WITH (NOLOCK) ON r.cd_controle = f.cd_controle
WHERE r.dt_saida IS NOT NULL
  AND r.fl_cancelada <> 'S'
  AND r.dt_saida >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
  AND r.dt_saida < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))`,
  },
  {
    id: "coorte_receita",
    group: "Coorte / Retenção",
    label: "Receita do ano por cliente (fl_fatura × fich_loc)",
    sql: `SELECT f.cd_empresa, f.cd_pessoa, ISNULL(SUM(fat.vl_fatura),0) AS rev
FROM fl_fatura fat WITH (NOLOCK)
INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = fat.cd_controle
WHERE fat.dt_geracao >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
  AND fat.dt_geracao < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))
GROUP BY f.cd_empresa, f.cd_pessoa`,
  },
  {
    id: "novos_clientes_mes",
    group: "Aquisição",
    label: "Novos clientes por mês (primeira locação)",
    sql: `SELECT YEAR(first_ficha) AS ano, MONTH(first_ficha) AS mes, COUNT(*) AS new_clients
FROM (
  SELECT cd_pessoa, MIN(dt_pedido) AS first_ficha
  FROM fich_loc WITH (NOLOCK)
  WHERE dt_pedido >= DATEFROMPARTS(YEAR(GETDATE())-1,1,1)
    AND dt_pedido < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))
    AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''
  GROUP BY cd_pessoa
) x
WHERE first_ficha >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
  AND first_ficha < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))
GROUP BY YEAR(first_ficha), MONTH(first_ficha)
ORDER BY 1, 2`,
  },
  {
    id: "distribuicao_geo",
    group: "Geográfico",
    label: "Distribuição geográfica de receita por UF",
    sql: `SELECT TOP 15 uf_destinatario AS uf, ISNULL(SUM(vl_faturamento),0) AS revenue,
  COUNT(*) AS nfs, COUNT(DISTINCT cd_pessoa) AS clients
FROM nf WITH (NOLOCK)
WHERE dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
  AND dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))
  AND fl_can_nf <> 'S'
  AND uf_destinatario IS NOT NULL AND uf_destinatario <> ''
GROUP BY uf_destinatario
ORDER BY ISNULL(SUM(vl_faturamento),0) DESC`,
  },
  {
    id: "kpis_empresa",
    group: "Financeiro (nf)",
    label: "KPIs financeiros por empresa (matriz e filiais)",
    sql: `SELECT nf.cd_empresa,
  ISNULL(SUM(CASE WHEN nf.dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
    AND nf.dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1)) THEN nf.vl_faturamento ELSE 0 END),0) AS fat_ano,
  ISNULL(SUM(CASE WHEN nf.dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE())-1,1,1)
    AND nf.dt_emi_nf < DATEADD(year,-1,GETDATE()) THEN nf.vl_faturamento ELSE 0 END),0) AS fat_ano_ant,
  ISNULL(SUM(CASE WHEN nf.dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)
    AND nf.dt_emi_nf < DATEADD(month,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)) THEN nf.vl_faturamento ELSE 0 END),0) AS fat_mes,
  COUNT(CASE WHEN nf.dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
    AND nf.dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1)) THEN 1 END) AS nfs_ano,
  COUNT(DISTINCT CASE WHEN nf.dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE()),1,1)
    AND nf.dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1)) THEN nf.cd_pessoa END) AS clientes_ano
FROM nf WITH (NOLOCK)
WHERE nf.dt_emi_nf >= DATEFROMPARTS(YEAR(GETDATE())-1,1,1)
  AND nf.dt_emi_nf < DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))
  AND nf.fl_can_nf <> 'S'
GROUP BY nf.cd_empresa`,
  },
  {
    id: "nomes_empresas",
    group: "Resolução de nomes",
    label: "Nomes de empresas (empresa)",
    sql: `SELECT cd_empresa, nm_fan_empresa FROM empresa WHERE cd_empresa <= 50`,
  },
  // ── Analytics (CAR / CAP / Locações / Operacional / Balancete) ──
  {
    id: "car_empresa",
    group: "Analytics · CAR/CAP",
    label: "CAR (Contas a Receber) por empresa gestora",
    sql: `SELECT cd_empresa_gestora, COUNT(*) AS qtd,
  ISNULL(SUM(vl_pre_car),0) AS vl_total,
  ISNULL(SUM(CASE WHEN dt_bai_car IS NULL AND dt_cancelamento IS NULL THEN vl_pre_car ELSE 0 END),0) AS vl_aberto,
  ISNULL(SUM(CASE WHEN dt_bai_car IS NOT NULL THEN vl_pre_car ELSE 0 END),0) AS vl_baixado,
  ISNULL(SUM(CASE WHEN dt_ven_car < GETDATE() AND dt_bai_car IS NULL AND dt_cancelamento IS NULL THEN vl_pre_car ELSE 0 END),0) AS vl_vencido
FROM car WITH (NOLOCK)
WHERE dt_emi_car >= '{start}' AND dt_emi_car < '{end}' AND dt_cancelamento IS NULL
GROUP BY cd_empresa_gestora
ORDER BY ISNULL(SUM(vl_pre_car),0) DESC`,
  },
  {
    id: "cap_conta",
    group: "Analytics · CAR/CAP",
    label: "CAP (Contas a Pagar) por conta",
    sql: `SELECT cd_conta, COUNT(*) AS qtd,
  ISNULL(SUM(vl_pre_cap),0) AS vl_total,
  ISNULL(SUM(CASE WHEN dt_bai_cap IS NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_aberto,
  ISNULL(SUM(CASE WHEN dt_bai_cap IS NOT NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_baixado,
  ISNULL(SUM(CASE WHEN dt_ven_cap < GETDATE() AND dt_bai_cap IS NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_vencido
FROM cap WITH (NOLOCK)
WHERE dt_emi_cap >= '{start}' AND dt_emi_cap < '{end}'
GROUP BY cd_conta
ORDER BY ISNULL(SUM(vl_pre_cap),0) DESC`,
  },
  {
    id: "car_mensal",
    group: "Analytics · Séries",
    label: "CAR mensal (últimos ~24 meses)",
    sql: `SELECT YEAR(dt_emi_car) AS ano, MONTH(dt_emi_car) AS mes,
  ISNULL(SUM(vl_pre_car),0) AS vl_total,
  ISNULL(SUM(CASE WHEN dt_bai_car IS NULL AND dt_cancelamento IS NULL THEN vl_pre_car ELSE 0 END),0) AS vl_aberto,
  ISNULL(SUM(CASE WHEN dt_bai_car IS NOT NULL THEN vl_pre_car ELSE 0 END),0) AS vl_baixado,
  COUNT(*) AS qtd
FROM car WITH (NOLOCK)
WHERE dt_emi_car >= '{start_ano_ant}' AND dt_emi_car < '{end}' AND dt_cancelamento IS NULL
GROUP BY YEAR(dt_emi_car), MONTH(dt_emi_car)
ORDER BY 1, 2`,
  },
  {
    id: "cap_mensal",
    group: "Analytics · Séries",
    label: "CAP mensal",
    sql: `SELECT YEAR(dt_emi_cap) AS ano, MONTH(dt_emi_cap) AS mes,
  ISNULL(SUM(vl_pre_cap),0) AS vl_total,
  ISNULL(SUM(CASE WHEN dt_bai_cap IS NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_aberto,
  ISNULL(SUM(CASE WHEN dt_bai_cap IS NOT NULL THEN vl_pre_cap ELSE 0 END),0) AS vl_baixado,
  COUNT(*) AS qtd
FROM cap WITH (NOLOCK)
WHERE dt_emi_cap >= '{start_ano_ant}' AND dt_emi_cap < '{end}'
GROUP BY YEAR(dt_emi_cap), MONTH(dt_emi_cap)
ORDER BY 1, 2`,
  },
  {
    id: "fichloc_empresa",
    group: "Analytics · Locações",
    label: "Fichas de locação por empresa (ativas/encerradas)",
    sql: `SELECT cd_empresa, COUNT(*) AS qtd,
  ISNULL(SUM(CASE WHEN fl_baixada <> 'S' AND dt_enc_ficha IS NULL THEN 1 ELSE 0 END),0) AS qtd_ativas,
  ISNULL(SUM(CASE WHEN dt_enc_ficha IS NOT NULL THEN 1 ELSE 0 END),0) AS qtd_encerradas,
  ISNULL(SUM(vl_minimo_locacao),0) AS vl_minimo,
  ISNULL(SUM(vl_encerramento),0) AS vl_encerramento
FROM fich_loc WITH (NOLOCK)
WHERE dt_pedido >= '{start}' AND dt_pedido < '{end}'
GROUP BY cd_empresa
ORDER BY COUNT(*) DESC`,
  },
  {
    id: "fichloc_mensal",
    group: "Analytics · Locações",
    label: "Locações mensais (aberturas × encerramentos)",
    sql: `SELECT YEAR(dt_pedido) AS ano, MONTH(dt_pedido) AS mes, COUNT(*) AS qtd,
  ISNULL(SUM(CASE WHEN dt_enc_ficha IS NOT NULL THEN 1 ELSE 0 END),0) AS qtd_encerradas,
  ISNULL(SUM(vl_minimo_locacao),0) AS vl_minimo
FROM fich_loc WITH (NOLOCK)
WHERE dt_pedido >= '{start_ano_ant}' AND dt_pedido < '{end}'
GROUP BY YEAR(dt_pedido), MONTH(dt_pedido)
ORDER BY 1, 2`,
  },
  {
    id: "fichloc_top_clientes",
    group: "Analytics · Locações",
    label: "Top 20 clientes por locações",
    sql: `SELECT TOP 20 cd_pessoa, COUNT(*) AS qtd_loc,
  ISNULL(SUM(vl_minimo_locacao),0) AS vl_minimo,
  ISNULL(SUM(CASE WHEN dt_enc_ficha IS NULL AND fl_baixada <> 'S' THEN 1 ELSE 0 END),0) AS qtd_ativas
FROM fich_loc WITH (NOLOCK)
WHERE dt_pedido >= '{start}' AND dt_pedido < '{end}'
GROUP BY cd_pessoa
ORDER BY COUNT(*) DESC`,
  },
  {
    id: "est_mov_operacao",
    group: "Analytics · Operacional",
    label: "Movimentações de estoque por operação",
    sql: `SELECT m.cd_movoperacao, o.ds_movoperacao, COUNT(*) AS qtd,
  COUNT(DISTINCT m.cd_controle) AS qtd_controles
FROM est_mov m WITH (NOLOCK)
LEFT JOIN est_movoperacao o WITH (NOLOCK) ON m.cd_movoperacao = o.cd_movoperacao
WHERE m.dt_geracao >= '{start}' AND m.dt_geracao < '{end}'
GROUP BY m.cd_movoperacao, o.ds_movoperacao
ORDER BY COUNT(*) DESC`,
  },
  {
    id: "est_mov_mensal",
    group: "Analytics · Operacional",
    label: "Movimentações de estoque mensais",
    sql: `SELECT YEAR(dt_geracao) AS ano, MONTH(dt_geracao) AS mes, COUNT(*) AS qtd
FROM est_mov WITH (NOLOCK)
WHERE dt_geracao >= '{start_ano_ant}' AND dt_geracao < '{end}'
GROUP BY YEAR(dt_geracao), MONTH(dt_geracao)
ORDER BY 1, 2`,
  },
  {
    id: "balancete",
    group: "Analytics · Balancete",
    label: "Balancete analítico (plano × CAP)",
    sql: `SELECT p.cd_planfin, p.nr_planfin, p.ds_planfin, p.fl_cla_planfin, p.fl_resultpatr,
  ISNULL(SUM(c.vl_pre_cap),0) AS vl_total,
  ISNULL(SUM(CASE WHEN c.dt_bai_cap IS NULL THEN c.vl_pre_cap ELSE 0 END),0) AS vl_aberto,
  ISNULL(SUM(CASE WHEN c.dt_bai_cap IS NOT NULL THEN c.vl_pre_cap ELSE 0 END),0) AS vl_baixado,
  COUNT(c.cd_lan) AS qtd
FROM plano p WITH (NOLOCK)
LEFT JOIN cap c WITH (NOLOCK) ON p.cd_planfin = c.cd_conta
  AND c.dt_emi_cap >= '{start}' AND c.dt_emi_cap < '{end}'
WHERE p.fl_planfin <> 'N' OR p.fl_planfin IS NULL
GROUP BY p.cd_planfin, p.nr_planfin, p.ds_planfin, p.fl_cla_planfin, p.fl_resultpatr
HAVING COUNT(c.cd_lan) > 0
ORDER BY p.nr_planfin`,
  },
  {
    id: "receita_gerada_empresa",
    group: "Analytics · Receita",
    label: "Receita gerada (fl_fatura) por empresa",
    sql: `SELECT c.cd_empresa, COUNT(*) AS qtd, ISNULL(SUM(f.vl_fatura),0) AS vl_gerado
FROM fl_fatura f WITH (NOLOCK)
INNER JOIN fich_loc c WITH (NOLOCK) ON c.cd_controle = f.cd_controle
WHERE f.dt_geracao >= '{start}' AND f.dt_geracao < '{end}'
GROUP BY c.cd_empresa
ORDER BY ISNULL(SUM(f.vl_fatura),0) DESC`,
  },
  {
    id: "clientes_ativos_locacao",
    group: "Analytics · Locações",
    label: "Clientes ativos por locação (distinto)",
    sql: `SELECT COUNT(DISTINCT cd_pessoa) AS total
FROM fich_loc WITH (NOLOCK)
WHERE dt_pedido >= '{start}' AND dt_pedido < '{end}'
  AND cd_pessoa IS NOT NULL AND cd_pessoa <> ''`,
  },
  {
    id: "pessoa_total",
    group: "Resolução de nomes",
    label: "Total de pessoas cadastradas",
    sql: `SELECT COUNT(*) AS total FROM pessoa WITH (NOLOCK)`,
  },
];

export const DASHBOARD_QUERY_GROUPS = [
  ...new Set(DASHBOARD_QUERIES.map(q => q.group)),
];