import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { canView } from '../../shared/access.ts';
import { execRead } from '../../shared/erpConnection.ts';
import { fichaStatus, fmtFicha } from '../../shared/fichaLifecycle.ts';

// Linha do tempo da ficha (tela "Movimentação" do Sisloc): remessas expedidas, devoluções,
// faturas/renovações e saldo real por equipamento. Identificação por cd_controle.
const rs = (r: any) => (Array.isArray(r?.recordset) ? r.recordset : []);
const day = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : null);
const num = (v: unknown) => Number(v) || 0;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!canView(user)) return Response.json({ error: 'Sem permissão.' }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const id = Number(b.cd_controle);
    if (!Number.isInteger(id) || id <= 0) return Response.json({ error: 'cd_controle inválido.' }, { status: 400 });
    const source = b.source_id ? await base44.asServiceRole.entities.ErpDataSource.get(b.source_id) : { credential_reference: 'env' };

    const [ficha] = rs(await execRead(source, `SELECT cd_controle, numero, cd_empresa, cd_pessoa, tp_ope_pedido, dt_pedido, dt_aprovacao, dt_enc_ficha, fl_baixada FROM fich_loc WITH (NOLOCK) WHERE cd_controle = ${id}`, 30000));
    if (!ficha) return Response.json({ error: 'Ficha não encontrada.' }, { status: 404 });

    const rem = rs(await execRead(source, `SELECT r.cd_flremessa, r.sequencia, r.dt_saida, r.cd_nf, e.cd_flremequ, e.cd_equipto, e.cd_patrimonio,
        COALESCE(q.nm_equipto, e.ds_equipto) AS nome, e.qt_remessa, e.vl_uni_locacao
      FROM fl_remessa r WITH (NOLOCK) JOIN fl_rem_equ e WITH (NOLOCK) ON e.cd_flremessa = r.cd_flremessa
      LEFT JOIN equipto q WITH (NOLOCK) ON q.cd_equipto = e.cd_equipto
      WHERE r.cd_controle = ${id} AND ISNULL(r.fl_rem_cancelada,'N') = 'N'`, 60000));
    const dev = rs(await execRead(source, `SELECT d.cd_fldevolucao, d.sequencia, d.dt_devolucao, d.dt_entrada, d.cd_nf, de.cd_flremequ, de.qt_devolucao
      FROM fl_devolucao d WITH (NOLOCK) JOIN fl_dev_equ de WITH (NOLOCK) ON de.cd_fldevolucao = d.cd_fldevolucao
      WHERE d.cd_controle = ${id} AND ISNULL(d.fl_dev_cancelada,'N') = 'N'`, 60000));
    const fat = rs(await execRead(source, `SELECT ft.cd_flfatura, ft.dt_geracao, ft.dt_inicio, ft.dt_fim, ft.vl_fatura, ft.cd_nf, ft.fatura_complementar, n.nr_nf_ini AS nr_nf
      FROM fl_fatura ft WITH (NOLOCK) LEFT JOIN nf n WITH (NOLOCK) ON n.cd_nf = ft.cd_nf WHERE ft.cd_controle = ${id}`, 60000));

    const items = new Map<string, any>();
    const expedidas = rem.filter((r: any) => r.dt_saida);
    for (const r of expedidas) items.set(String(r.cd_flremequ), { nome: String(r.nome || '').trim(), patrimonio: r.cd_patrimonio ? String(r.cd_patrimonio).trim() : null, remetido: num(r.qt_remessa), devolvido: 0 });
    for (const d of dev) { const it = items.get(String(d.cd_flremequ)); if (it) it.devolvido += num(d.qt_devolucao); }
    const saldo = [...items.values()].map((it) => ({ ...it, saldo: Math.max(0, it.remetido - it.devolvido) }));

    const group = (rows: any[], key: string) => Object.values(rows.reduce((a: any, r: any) => ((a[r[key]] ||= []).push(r), a), {})) as any[][];
    const timeline = [
      ...group(expedidas, 'cd_flremessa').map((g) => ({ descricao: 'Remessa', numero: g[0].sequencia, data: day(g[0].dt_saida), cd_nf: g[0].cd_nf || null, itens: g.map((r) => ({ nome: String(r.nome || '').trim(), patrimonio: r.cd_patrimonio, qt: num(r.qt_remessa) })), valor: null })),
      ...group(dev, 'cd_fldevolucao').map((g) => ({ descricao: 'Devolução', numero: g[0].sequencia, data: day(g[0].dt_devolucao || g[0].dt_entrada), cd_nf: g[0].cd_nf || null, itens: g.map((d) => ({ nome: items.get(String(d.cd_flremequ))?.nome || '', qt: num(d.qt_devolucao) })), valor: null })),
      ...fat.map((f: any) => ({ descricao: f.fatura_complementar === 'S' ? 'Fatura complementar' : 'Fatura', numero: f.cd_flfatura, data: day(f.dt_geracao), periodo: `${day(f.dt_inicio) || '?'} → ${day(f.dt_fim) || '?'}`, cd_nf: f.cd_nf || null, nr_nf: f.nr_nf || null, valor: num(f.vl_fatura), itens: [] })),
    ].sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));

    return Response.json({
      ficha: { cd_controle: id, numero: fmtFicha(ficha.numero), cd_empresa: num(ficha.cd_empresa), cd_pessoa: String(ficha.cd_pessoa || ''), tp_ope_pedido: ficha.tp_ope_pedido, dt_pedido: day(ficha.dt_pedido), dt_aprovacao: day(ficha.dt_aprovacao), dt_enc_ficha: day(ficha.dt_enc_ficha), ...fichaStatus(ficha.tp_ope_pedido, ficha.dt_enc_ficha, expedidas.length) },
      saldo, saldo_total: saldo.reduce((s, i) => s + i.saldo, 0), timeline,
    });
  } catch (error) {
    return Response.json({ error: (error as Error)?.message || String(error) }, { status: 500 });
  }
}