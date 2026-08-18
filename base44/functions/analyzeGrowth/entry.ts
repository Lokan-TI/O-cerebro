import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { execRead } from '../../shared/erpConnection.ts';

// KPIs de Growth Marketing apurados diretamente no Sisloc, conforme o dicionário de dados:
//  · fich_loc      → proposta/ficha de locação (dt_pedido, dt_validade, dt_aprovacao)
//  · fl_remessa    → saída física do equipamento (dt_saida, fl_rem_cancelada)
//  · fl_rem_equ    → item da remessa por patrimônio (qt_remessa vs qt_devolucao)
//  · fl_devolucao / fl_dev_equ → retorno do equipamento ao pátio (dt_devolucao)
//  · patrimon      → frota própria (base de ocupação e tempo de pátio)
//  · fl_fatura     → receita gerada pelas locações no período
const rowsOf = (result: any): any[] => {
  if (Array.isArray(result?.recordset) && result.recordset.length > 0) return result.recordset;
  if (Array.isArray(result?.recordsets)) {
    for (let i = result.recordsets.length - 1; i >= 0; i--) {
      const rs = result.recordsets[i];
      if (Array.isArray(rs) && rs.length > 0) return rs;
    }
  }
  return [];
};
const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const end = String(body?.end_date || new Date().toISOString().slice(0, 10));
    const start = String(
      body?.start_date || new Date(new Date(end).getTime() - 365 * 86400000).toISOString().slice(0, 10)
    );
    const endExcl = `DATEADD(day, 1, CAST('${end}' AS date))`;

    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (body?.source_id) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(body.source_id);
      if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
    }

    const t0 = Date.now();
    const warnings: string[] = [];
    const run = async (label: string, sql: string, ms = 25000) => {
      try {
        return rowsOf(await execRead(source, sql, ms));
      } catch (e) {
        warnings.push(`${label}: ${((e as Error)?.message || String(e)).slice(0, 120)}`);
        return [];
      }
    };

    // 1 · Demanda comercial — propostas de locação criadas e aprovadas (fich_loc)
    const sqlDemanda = `SELECT
        COUNT(*) AS propostas,
        SUM(CASE WHEN dt_aprovacao IS NOT NULL THEN 1 ELSE 0 END) AS aprovadas,
        SUM(CASE WHEN dt_enc_ficha IS NOT NULL THEN 1 ELSE 0 END) AS encerradas,
        SUM(CASE WHEN dt_enc_ficha IS NULL AND UPPER(COALESCE(fl_baixada,'N')) <> 'S' THEN 1 ELSE 0 END) AS ativas,
        COUNT(DISTINCT cd_pessoa) AS clientes,
        SUM(COALESCE(vl_minimo_locacao,0)) AS vl_minimo,
        AVG(CASE WHEN dt_aprovacao IS NOT NULL
            THEN CAST(DATEDIFF(day, dt_pedido, dt_aprovacao) AS FLOAT) END) AS dias_aprovacao
      FROM fich_loc WITH (NOLOCK)
      WHERE dt_pedido >= '${start}' AND dt_pedido < ${endExcl}`;

    // 2 · Ativação — propostas que viraram saída física de equipamento
    const sqlAtivacao = `SELECT
        COUNT(DISTINCT r.cd_controle) AS fichas_com_saida,
        COUNT(*) AS remessas,
        COUNT(DISTINCT f.cd_pessoa) AS clientes_atendidos
      FROM fl_remessa r WITH (NOLOCK)
      INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = r.cd_controle
      WHERE r.dt_saida >= '${start}' AND r.dt_saida < ${endExcl}
        AND UPPER(COALESCE(r.fl_rem_cancelada,'N')) <> 'S'`;

    // 3 · Devoluções no período
    const sqlDevolucoes = `SELECT COUNT(*) AS devolucoes, COUNT(DISTINCT cd_controle) AS fichas_devolvidas
      FROM fl_devolucao WITH (NOLOCK)
      WHERE dt_devolucao >= '${start}' AND dt_devolucao < ${endExcl}
        AND UPPER(COALESCE(fl_dev_cancelada,'N')) <> 'S'`;

    // 4 · Frota própria disponível para locação
    const sqlFrota = `SELECT COUNT(*) AS pat_total, SUM(COALESCE(vl_aqu_patrimonio,0)) AS vl_frota
      FROM patrimon WITH (NOLOCK)
      WHERE UPPER(COALESCE(fl_vendido,'N')) <> 'S'`;

    // 5 · Patrimônios em campo agora (remessa com saída e item ainda não devolvido)
    const sqlLocados = `SELECT COUNT(DISTINCT re.cd_patrimonio) AS pat_locados
      FROM fl_rem_equ re WITH (NOLOCK)
      INNER JOIN fl_remessa r WITH (NOLOCK) ON r.cd_flremessa = re.cd_flremessa
      WHERE re.cd_patrimonio > 0
        AND r.dt_saida IS NOT NULL AND r.dt_saida >= DATEADD(year, -3, ${endExcl})
        AND UPPER(COALESCE(r.fl_rem_cancelada,'N')) <> 'S'
        AND COALESCE(re.qt_devolucao,0) < COALESCE(re.qt_remessa,0)`;

    // 6 · Tempo de pátio (idle time) — dias desde a última devolução dos itens que voltaram
    const sqlIdle = `SELECT COUNT(*) AS pat_patio,
        AVG(CAST(DATEDIFF(day, x.ult, GETDATE()) AS FLOAT)) AS idle_medio,
        SUM(CASE WHEN DATEDIFF(day, x.ult, GETDATE()) > 60 THEN 1 ELSE 0 END) AS idle_60
      FROM (
        SELECT re.cd_patrimonio, MAX(d.dt_devolucao) AS ult
        FROM fl_dev_equ de WITH (NOLOCK)
        INNER JOIN fl_devolucao d WITH (NOLOCK) ON d.cd_fldevolucao = de.cd_fldevolucao
        INNER JOIN fl_rem_equ re WITH (NOLOCK) ON re.cd_flremequ = de.cd_flremequ
        WHERE d.dt_devolucao >= DATEADD(month, -24, GETDATE()) AND re.cd_patrimonio > 0
        GROUP BY re.cd_patrimonio
      ) x
      WHERE x.cd_patrimonio NOT IN (
        SELECT re2.cd_patrimonio FROM fl_rem_equ re2 WITH (NOLOCK)
        INNER JOIN fl_remessa r2 WITH (NOLOCK) ON r2.cd_flremessa = re2.cd_flremessa
        WHERE re2.cd_patrimonio > 0 AND r2.dt_saida IS NOT NULL
          AND UPPER(COALESCE(r2.fl_rem_cancelada,'N')) <> 'S'
          AND COALESCE(re2.qt_devolucao,0) < COALESCE(re2.qt_remessa,0)
      )`;

    // 7 · Receita gerada pelas locações no período (fl_fatura)
    const sqlReceita = `SELECT COUNT(*) AS qtd_faturas, SUM(COALESCE(vl_fatura,0)) AS vl_gerado
      FROM fl_fatura WITH (NOLOCK)
      WHERE dt_geracao >= '${start}' AND dt_geracao < ${endExcl}`;

    const [dem] = await run('Demanda (fich_loc)', sqlDemanda);
    const [ati] = await run('Ativação (fl_remessa)', sqlAtivacao);
    const [dev] = await run('Devoluções (fl_devolucao)', sqlDevolucoes);
    const [fro] = await run('Frota própria (patrimon)', sqlFrota, 15000);
    const [loc] = await run('Patrimônios em campo (fl_rem_equ)', sqlLocados);
    const [idl] = await run('Tempo de pátio (fl_dev_equ)', sqlIdle);
    const [rec] = await run('Receita gerada (fl_fatura)', sqlReceita);

    const propostas = num(dem?.propostas);
    const aprovadas = num(dem?.aprovadas);
    const fichasComSaida = num(ati?.fichas_com_saida);
    const patTotal = num(fro?.pat_total);
    const patLocados = num(loc?.pat_locados);
    const receita = num(rec?.vl_gerado);

    return Response.json({
      generated_at: new Date().toISOString(),
      period: { start, end },
      demanda: {
        propostas,
        aprovadas,
        aprovacao_pct: propostas ? (aprovadas / propostas) * 100 : null,
        ativadas: fichasComSaida,
        ativacao_pct: propostas ? (fichasComSaida / propostas) * 100 : null,
        dias_aprovacao: dem?.dias_aprovacao == null ? null : Number(dem.dias_aprovacao),
        clientes: num(dem?.clientes),
        clientes_atendidos: num(ati?.clientes_atendidos),
        ticket_contrato: fichasComSaida ? receita / fichasComSaida : null,
        ativas: num(dem?.ativas),
        encerradas: num(dem?.encerradas),
      },
      frota: {
        pat_total: patTotal,
        vl_frota: num(fro?.vl_frota),
        pat_locados: patLocados,
        ocupacao_pct: patTotal ? (patLocados / patTotal) * 100 : null,
        remessas: num(ati?.remessas),
        devolucoes: num(dev?.devolucoes),
        pat_patio: num(idl?.pat_patio),
        idle_medio: idl?.idle_medio == null ? null : Number(idl.idle_medio),
        idle_60: num(idl?.idle_60),
      },
      receita: {
        vl_gerado: receita,
        qtd_faturas: num(rec?.qtd_faturas),
        revpae: patLocados ? receita / patLocados : null,
        receita_por_patrimonio: patTotal ? receita / patTotal : null,
        receita_por_cliente: num(ati?.clientes_atendidos) ? receita / num(ati.clientes_atendidos) : null,
      },
      warnings,
      duration_ms: Date.now() - t0,
      queries: [
        { label: 'Demanda comercial', description: 'fich_loc — propostas criadas, aprovadas e tempo até aprovação', sql: sqlDemanda },
        { label: 'Ativação', description: 'fl_remessa + fich_loc — propostas que geraram saída física', sql: sqlAtivacao },
        { label: 'Devoluções', description: 'fl_devolucao — retornos ao pátio no período', sql: sqlDevolucoes },
        { label: 'Frota própria', description: 'patrimon — base de patrimônios não vendidos', sql: sqlFrota },
        { label: 'Patrimônios em campo', description: 'fl_rem_equ — itens com saída e sem devolução', sql: sqlLocados },
        { label: 'Tempo de pátio', description: 'fl_dev_equ + fl_devolucao — dias parados desde a última devolução', sql: sqlIdle },
        { label: 'Receita gerada', description: 'fl_fatura — receita das locações no período', sql: sqlReceita },
      ],
    });
  } catch (error) {
    return Response.json({ error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}