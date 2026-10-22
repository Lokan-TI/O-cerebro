import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { canView } from '../../shared/access.ts';
import { execRead } from '../../shared/erpConnection.ts';

// Queda de frequência de locações por cliente entre dois períodos manuais.
// Fonte Sisloc (vínculos confirmados por FK):
//  - pessoa.cd_pessoa = fich_loc.cd_pessoa (cliente da ficha)
//  - fich_loc.tp_ope_pedido = 'O' → orçamento; demais → ficha de locação
//  - fl_fatura.cd_controle = fich_loc.cd_controle → "Movimentações" (períodos faturados).
//    Ficha FECHADA = não orçamento E com ao menos uma fatura não complementar.
//    Renovação = cada fatura não complementar além da primeira, sob o MESMO número de ficha.
//  - fl_remessa.cd_controle → fl_rem_equ (equipamentos), devolução em fl_dev_equ.
// Data de início da ficha/orçamento = fich_loc.dt_pedido (mesmo critério do RFM).
const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const nextDay = (d: string) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
const day = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : null);
const rs = (r: any) => (Array.isArray(r?.recordset) ? r.recordset : []);
const NAO_COMPL = `ISNULL(ft.fatura_complementar,'N') <> 'S'`;
const fichaNum = (r: any) => [r.numero_prefixo, r.numero, r.numero_sufixo].filter((x) => x != null && String(x).trim() !== '').map((x) => String(x).trim()).join('-') || String(r.cd_controle);

function validate(b: any) {
  const { p1, p2 } = b || {};
  if (![p1?.start, p1?.end, p2?.start, p2?.end].every(isDate)) return 'Informe datas válidas para os dois períodos.';
  if (p1.start > p1.end || p2.start > p2.end) return 'A data inicial deve ser anterior ou igual à final em cada período.';
  if (p1.end >= p2.start) return 'O Período A deve terminar antes do início do Período B.';
  const span = (p: any) => (new Date(p.end).getTime() - new Date(p.start).getTime()) / 86400000;
  if (span(p1) > 1100 || span(p2) > 1100) return 'Cada período pode ter no máximo 3 anos.';
  return null;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!canView(user)) return Response.json({ error: 'Sem permissão.' }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const err = validate(b);
    if (err) return Response.json({ error: err }, { status: 400 });
    const { p1, p2 } = b;
    const emp = b.cd_empresa != null && b.cd_empresa !== '' ? ` AND f.cd_empresa = ${Number(b.cd_empresa)}` : '';
    const source = b.source_id ? await base44.asServiceRole.entities.ErpDataSource.get(b.source_id) : { credential_reference: 'env' };
    const e1 = nextDay(p1.end), e2 = nextDay(p2.end);
    const inP = (s: string, e: string) => `f.dt_pedido >= '${s}' AND f.dt_pedido < '${e}'`;

    if (b.mode === 'detalhes') {
      const ids = (Array.isArray(b.cd_pessoas) ? b.cd_pessoas : []).slice(0, 200).map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n));
      if (!ids.length) return Response.json({ fichas: [], orcamentos: [] });
      const idList = ids.join(',');
      const fichaSql = `SELECT f.cd_controle, f.cd_pessoa, f.cd_empresa, f.numero_prefixo, f.numero, f.numero_sufixo, f.dt_pedido,
          f.dt_enc_ficha, f.tp_ope_pedido,
          (SELECT COUNT(*) FROM fl_fatura ft WITH (NOLOCK) WHERE ft.cd_controle = f.cd_controle AND ${NAO_COMPL}) AS nfat,
          (SELECT MAX(ft.dt_inicio) FROM fl_fatura ft WITH (NOLOCK) WHERE ft.cd_controle = f.cd_controle AND ${NAO_COMPL}) AS ult_ini,
          (SELECT MAX(ft.dt_fim) FROM fl_fatura ft WITH (NOLOCK) WHERE ft.cd_controle = f.cd_controle AND ${NAO_COMPL}) AS ult_fim
        FROM fich_loc f WITH (NOLOCK)
        WHERE f.cd_pessoa IN (${idList}) AND f.tp_ope_pedido <> 'O'
          AND ((${inP(p1.start, e1)}) OR (${inP(p2.start, e2)}))${emp}`;
      const fichas = rs(await execRead(source, fichaSql, 90000)).filter((r: any) => Number(r.nfat) > 0);
      const ctrl = fichas.map((r: any) => Number(r.cd_controle));
      const renov: Record<string, string[]> = {};
      const equip: Record<string, any[]> = {};
      if (ctrl.length) {
        const cl = ctrl.join(',');
        const fatSql = `SELECT ft.cd_controle, ft.dt_inicio, ft.dt_fim FROM fl_fatura ft WITH (NOLOCK)
          WHERE ft.cd_controle IN (${cl}) AND ${NAO_COMPL} ORDER BY ft.cd_controle, ft.dt_inicio`;
        for (const r of rs(await execRead(source, fatSql, 90000))) (renov[r.cd_controle] ||= []).push(`${day(r.dt_inicio) || '?'}→${day(r.dt_fim) || '?'}`);
        const eqSql = `SELECT r.cd_controle, COALESCE(q.nm_equipto, e.ds_equipto) AS nome, e.cd_patrimonio,
            SUM(e.qt_remessa) AS qt, SUM(ISNULL(dv.qt,0)) AS dev
          FROM fl_remessa r WITH (NOLOCK)
          JOIN fl_rem_equ e WITH (NOLOCK) ON e.cd_flremessa = r.cd_flremessa
          LEFT JOIN equipto q WITH (NOLOCK) ON q.cd_equipto = e.cd_equipto
          OUTER APPLY (SELECT SUM(d.qt_devolucao) AS qt FROM fl_dev_equ d WITH (NOLOCK) WHERE d.cd_flremequ = e.cd_flremequ) dv
          WHERE r.cd_controle IN (${cl}) AND r.fl_rem_cancelada = 'N'
          GROUP BY r.cd_controle, COALESCE(q.nm_equipto, e.ds_equipto), e.cd_patrimonio`;
        for (const r of rs(await execRead(source, eqSql, 90000))) {
          (equip[r.cd_controle] ||= []).push({ nome: String(r.nome || '').trim() || 'Sem descrição', patrimonio: r.cd_patrimonio ? String(r.cd_patrimonio).trim() : null, qt: Number(r.qt) || 0, em_cliente: Math.max(0, (Number(r.qt) || 0) - (Number(r.dev) || 0)) });
        }
      }
      // Último orçamento de cada cliente até o fim do Período B, com os equipamentos cotados (quando houver remessa).
      const orcSql = `SELECT o.cd_pessoa, o.cd_controle, o.dt_pedido, o.numero_prefixo, o.numero, o.numero_sufixo,
          (SELECT STRING_AGG(x.nome, ' | ') FROM (SELECT DISTINCT TOP 15 COALESCE(q.nm_equipto, e.ds_equipto) AS nome
             FROM fl_remessa r WITH (NOLOCK) JOIN fl_rem_equ e WITH (NOLOCK) ON e.cd_flremessa = r.cd_flremessa
             LEFT JOIN equipto q WITH (NOLOCK) ON q.cd_equipto = e.cd_equipto WHERE r.cd_controle = o.cd_controle) x) AS equipamentos
        FROM (SELECT f.cd_pessoa, f.cd_controle, f.dt_pedido, f.numero_prefixo, f.numero, f.numero_sufixo,
            ROW_NUMBER() OVER (PARTITION BY f.cd_pessoa ORDER BY f.dt_pedido DESC, f.cd_controle DESC) AS rn
          FROM fich_loc f WITH (NOLOCK)
          WHERE f.cd_pessoa IN (${idList}) AND f.tp_ope_pedido = 'O' AND f.dt_pedido < '${e2}'${emp}) o
        WHERE o.rn = 1`;
      const orcamentos = rs(await execRead(source, orcSql, 90000)).map((r: any) => ({
        cd_pessoa: String(r.cd_pessoa).trim(), numero: fichaNum(r), data: day(r.dt_pedido), equipamentos: r.equipamentos ? String(r.equipamentos) : null,
      }));
      return Response.json({
        fichas: fichas.map((r: any) => ({
          cd_pessoa: String(r.cd_pessoa).trim(), cd_controle: Number(r.cd_controle), numero: fichaNum(r), cd_empresa: Number(r.cd_empresa) || 0,
          inicio: day(r.dt_pedido), periodo: day(r.dt_pedido)! <= p1.end ? 'A' : 'B', encerrada: day(r.dt_enc_ficha),
          renovacoes: Math.max(0, Number(r.nfat) - 1), movimentacoes: renov[r.cd_controle] || [], ult_fim: day(r.ult_fim),
          equipamentos: equip[r.cd_controle] || [],
        })),
        orcamentos,
      });
    }

    // Resumo por cliente: fichas fechadas, renovações, sem movimentação e orçamentos em cada período.
    const sql = `WITH b AS (
        SELECT f.cd_pessoa, f.tp_ope_pedido AS tp,
          CASE WHEN ${inP(p1.start, e1)} THEN 'A' ELSE 'B' END AS per,
          (SELECT COUNT(*) FROM fl_fatura ft WITH (NOLOCK) WHERE ft.cd_controle = f.cd_controle AND ${NAO_COMPL}) AS nfat
        FROM fich_loc f WITH (NOLOCK)
        WHERE f.cd_pessoa IS NOT NULL AND ((${inP(p1.start, e1)}) OR (${inP(p2.start, e2)}))${emp}
      )
      SELECT b.cd_pessoa, MAX(p.nm_pessoa) AS nome, MAX(COALESCE(NULLIF(LTRIM(RTRIM(p.nr_cnpj_pessoa)),''), p.nr_cpf_pessoa)) AS doc,
        SUM(CASE WHEN tp <> 'O' AND nfat > 0 AND per = 'A' THEN 1 ELSE 0 END) AS loc_a,
        SUM(CASE WHEN tp <> 'O' AND nfat > 0 AND per = 'B' THEN 1 ELSE 0 END) AS loc_b,
        SUM(CASE WHEN tp <> 'O' AND nfat > 1 AND per = 'A' THEN nfat - 1 ELSE 0 END) AS ren_a,
        SUM(CASE WHEN tp <> 'O' AND nfat > 1 AND per = 'B' THEN nfat - 1 ELSE 0 END) AS ren_b,
        SUM(CASE WHEN tp <> 'O' AND nfat = 0 AND per = 'A' THEN 1 ELSE 0 END) AS semmov_a,
        SUM(CASE WHEN tp <> 'O' AND nfat = 0 AND per = 'B' THEN 1 ELSE 0 END) AS semmov_b,
        SUM(CASE WHEN tp = 'O' AND per = 'A' THEN 1 ELSE 0 END) AS orc_a,
        SUM(CASE WHEN tp = 'O' AND per = 'B' THEN 1 ELSE 0 END) AS orc_b
      FROM b LEFT JOIN pessoa p WITH (NOLOCK) ON p.cd_pessoa = b.cd_pessoa
      GROUP BY b.cd_pessoa`;
    const lastSql = `SELECT f.cd_pessoa,
        MAX(CASE WHEN f.tp_ope_pedido <> 'O' THEN f.dt_pedido END) AS ult_loc,
        MAX(CASE WHEN f.tp_ope_pedido = 'O' THEN f.dt_pedido END) AS ult_orc
      FROM fich_loc f WITH (NOLOCK)
      WHERE f.cd_pessoa IS NOT NULL AND f.dt_pedido < '${e2}'${emp}
      GROUP BY f.cd_pessoa`;
    const rows = rs(await execRead(source, sql, 120000));
    const last = new Map(rs(await execRead(source, lastSql, 120000)).map((r: any) => [String(r.cd_pessoa).trim(), r]));
    const clientes = rows.map((r: any) => {
      const id = String(r.cd_pessoa).trim();
      const l: any = last.get(id) || {};
      return {
        cd_pessoa: id, nome: String(r.nome || '').trim() || `Cliente ${id}`, doc: r.doc ? String(r.doc).trim() : '',
        loc_a: Number(r.loc_a) || 0, loc_b: Number(r.loc_b) || 0, ren_a: Number(r.ren_a) || 0, ren_b: Number(r.ren_b) || 0,
        semmov_a: Number(r.semmov_a) || 0, semmov_b: Number(r.semmov_b) || 0, orc_a: Number(r.orc_a) || 0, orc_b: Number(r.orc_b) || 0,
        ult_loc: day(l.ult_loc), ult_orc: day(l.ult_orc),
      };
    });
    return Response.json({ p1, p2, clientes });
  } catch (error) {
    return Response.json({ error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}