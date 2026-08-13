import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildConfig, runQuery, closePool } from '../../shared/erpConnection.ts';

// Patrimônios vinculados a um cliente (fich_loc -> fl_remessa -> fl_rem_equ)
// com nome do produto (equipto). Retorna histórico completo e o que está em posse hoje.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const cdPessoa = Number(body?.cd_pessoa);
    if (!cdPessoa) return Response.json({ error: 'Parâmetro "cd_pessoa" é obrigatório.' }, { status: 400 });

    const sourceId = body?.source_id;
    let source: any = { credential_reference: 'env' };
    if (sourceId) {
      source = await base44.asServiceRole.entities.ErpDataSource.get(sourceId);
      if (!source) return Response.json({ error: 'Fonte de dados não encontrada.' }, { status: 404 });
      if (source.is_active === false) return Response.json({ error: 'A fonte selecionada está inativa.' }, { status: 403 });
    }

    const built = buildConfig(source);
    if (!built) return Response.json({ error: 'Configuração de conexão incompleta.' }, { status: 500 });

    const wrap = (sql: string) =>
      built.clientId ? `EXEC DW_API '${built.clientId}', '${sql.replace(/'/g, "''")}'` : sql;

    const sql = `SELECT p.nm_pessoa,
        e.cd_patrimonio, pt.nr_patrimonio, pt.nr_serie,
        e.cd_equipto, q.nm_equipto,
        r.cd_flremessa, r.nr_contrato, r.dt_saida, d.dt_devolucao,
        e.vl_uni_locacao
      FROM fich_loc f WITH (NOLOCK)
      JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = f.cd_pessoa
      JOIN fl_remessa r WITH (NOLOCK) ON r.cd_controle = f.cd_controle
      JOIN fl_rem_equ e WITH (NOLOCK) ON e.cd_flremessa = r.cd_flremessa AND e.cd_patrimonio IS NOT NULL
      LEFT JOIN patrimon pt WITH (NOLOCK) ON pt.cd_patrimonio = e.cd_patrimonio
      LEFT JOIN equipto q WITH (NOLOCK) ON q.cd_equipto = e.cd_equipto
      LEFT JOIN fl_dev_equ de WITH (NOLOCK) ON de.cd_flremequ = e.cd_flremequ
      LEFT JOIN fl_devolucao d WITH (NOLOCK) ON d.cd_fldevolucao = de.cd_fldevolucao
      WHERE f.cd_pessoa = ${cdPessoa}`;

    const res: any = await runQuery(source, wrap(sql), 40000);
    const raw = res?.recordset || [];

    const toDate = (v: any) => {
      if (!v) return null;
      const d = new Date(v);
      if (isNaN(d.getTime())) return null;
      const y = d.getUTCFullYear();
      if (y < 1980 || y > 2100) return null;
      return d.toISOString().slice(0, 10);
    };
    const days = (a: string | null, b: string | null) => {
      if (!a) return 0;
      const end = b ? new Date(b) : new Date();
      const diff = (end.getTime() - new Date(a).getTime()) / 86400000;
      return diff > 0 && diff < 20000 ? Math.round(diff) : 0;
    };

    const movements = raw.map((r: any) => {
      const saida = toDate(r.dt_saida);
      const dev = toDate(r.dt_devolucao);
      return {
        cd_patrimonio: Number(r.cd_patrimonio),
        nr_patrimonio: String(r.nr_patrimonio || r.cd_patrimonio || ''),
        nr_serie: String(r.nr_serie || ''),
        cd_equipto: Number(r.cd_equipto) || 0,
        nm_equipto: String(r.nm_equipto || ''),
        cd_flremessa: Number(r.cd_flremessa) || 0,
        nr_contrato: String(r.nr_contrato || ''),
        dt_saida: saida,
        dt_devolucao: dev,
        em_posse: !dev,
        dias: days(saida, dev),
        vl_locacao: Number(r.vl_uni_locacao) || 0,
      };
    });

    // Histórico agregado por patrimônio
    const map: Record<string, any> = {};
    for (const m of movements) {
      const key = String(m.cd_patrimonio);
      if (!map[key]) {
        map[key] = {
          cd_patrimonio: m.cd_patrimonio,
          nr_patrimonio: m.nr_patrimonio,
          nr_serie: m.nr_serie,
          nm_equipto: m.nm_equipto,
          qtd_locacoes: 0,
          dias_total: 0,
          primeira_saida: m.dt_saida,
          ultima_saida: m.dt_saida,
          ultima_devolucao: m.dt_devolucao,
          em_posse: false,
        };
      }
      const g = map[key];
      g.qtd_locacoes += 1;
      g.dias_total += m.dias;
      if (m.dt_saida && (!g.primeira_saida || m.dt_saida < g.primeira_saida)) g.primeira_saida = m.dt_saida;
      if (m.dt_saida && (!g.ultima_saida || m.dt_saida > g.ultima_saida)) g.ultima_saida = m.dt_saida;
      if (m.dt_devolucao && (!g.ultima_devolucao || m.dt_devolucao > g.ultima_devolucao)) g.ultima_devolucao = m.dt_devolucao;
      if (m.em_posse) g.em_posse = true;
    }

    const history = Object.values(map).sort((a: any, b: any) => b.dias_total - a.dias_total);
    const current = movements.filter((m: any) => m.em_posse).sort((a: any, b: any) => (b.dias || 0) - (a.dias || 0));

    return Response.json({
      cd_pessoa: cdPessoa,
      nm_pessoa: raw[0]?.nm_pessoa || '',
      history,
      current,
      totals: {
        patrimonios_historico: history.length,
        patrimonios_em_posse: new Set(current.map((c: any) => c.cd_patrimonio)).size,
        locacoes: movements.length,
        dias_total: history.reduce((s: number, h: any) => s + h.dias_total, 0),
      },
      queries: [
        { label: 'Patrimônios do cliente', description: 'fich_loc → fl_remessa → fl_rem_equ → patrimon/equipto + devoluções', sql },
      ],
    });
  } catch (error) {
    try {
      const body2 = await req.clone().json().catch(() => ({}));
      if (body2?.source_id) await closePool({ id: body2.source_id, credential_reference: 'entity' });
      else await closePool({ credential_reference: 'env' });
    } catch {}
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});