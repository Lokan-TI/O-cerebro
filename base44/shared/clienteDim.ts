// Camada analítica canônica do cliente (dim_cliente / vw_cliente_360).
// Consolida cadastro (pessoa), locações (fich_loc), faturamento (nf) e financeiro (car)
// em uma única linha por cliente, com ID global único "FONTE-cd_pessoa".

const MAX_CLIENTS = 3000;

function num(v: any) { return Number(v) || 0; }
function dateStr(v: any) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
function daysSince(d: any, ref: Date) {
  const s = dateStr(d);
  if (!s) return null;
  const t = new Date(s + 'T00:00:00Z').getTime();
  if (isNaN(t)) return null;
  return Math.floor((ref.getTime() - t) / 86400000);
}

function statusOf(recency: number | null, faturamento: number) {
  if (recency === null) return faturamento > 0 ? 'SEM DATA' : 'SEM MOVIMENTO';
  if (recency <= 90) return 'ATIVO';
  if (recency <= 180) return 'EM RISCO';
  if (recency <= 365) return 'INATIVO';
  return 'CHURN';
}

export function buildClienteDim(input: {
  pessoas: any[];
  fichas: any[];
  notas: any[];
  cars: any[];
  empresaNames: Record<string, string>;
  sourceSlug: string;
  periodStart: string;
  periodEnd: string;
}) {
  const { pessoas, fichas, notas, cars, empresaNames, sourceSlug } = input;
  const ref = new Date();

  const byId = new Map<number, any>();
  const ensure = (cd: any) => {
    const id = Number(cd);
    if (!id) return null;
    if (!byId.has(id)) {
      byId.set(id, {
        global_id: `${sourceSlug}-${id}`,
        cd_pessoa: id,
        nm_pessoa: '',
        tipo_pessoa: '',
        documento: '',
        cidade: '',
        uf: '',
        dt_cadastro: null,
        ativo_cadastro: null,
        cd_empresa: null,
        empresa_nome: '',
        qtd_fichas: 0,
        fichas_abertas: 0,
        primeira_ficha: null,
        ultima_ficha: null,
        qtd_nf: 0,
        faturamento: 0,
        primeira_nf: null,
        ultima_nf: null,
        car_total: 0,
        car_liquidado: 0,
        car_aberto: 0,
        car_a_vencer: 0,
        car_vencido: 0,
        car_provisorio: 0,
        car_juros_multa: 0,
        qtd_car: 0,
      });
    }
    return byId.get(id);
  };

  for (const p of pessoas) {
    const r = ensure(p.cd_pessoa);
    if (!r) continue;
    r.nm_pessoa = String(p.nome || p.nm_pessoa || '');
    r.tipo_pessoa = String(p.fl_tipo_pessoa || '');
    r.documento = String(p.nr_cnpj_pessoa || p.nr_cpf_pessoa || '').trim();
    r.cidade = String(p.cidade_pessoa || '');
    r.uf = String(p.uf_pessoa || '');
    r.dt_cadastro = dateStr(p.dt_cad_pessoa);
    r.ativo_cadastro = p.fl_ativo === null || p.fl_ativo === undefined ? null : String(p.fl_ativo);
  }

  for (const f of fichas) {
    const r = ensure(f.cd_pessoa);
    if (!r) continue;
    r.qtd_fichas += num(f.qtd);
    r.fichas_abertas += num(f.abertas);
    const pf = dateStr(f.primeira);
    const uf = dateStr(f.ultima);
    if (pf && (!r.primeira_ficha || pf < r.primeira_ficha)) r.primeira_ficha = pf;
    if (uf && (!r.ultima_ficha || uf > r.ultima_ficha)) r.ultima_ficha = uf;
    if (r.cd_empresa === null && f.cd_empresa != null) r.cd_empresa = Number(f.cd_empresa);
  }

  for (const n of notas) {
    const r = ensure(n.cd_pessoa);
    if (!r) continue;
    r.qtd_nf += num(n.qtd);
    r.faturamento += num(n.valor);
    const pn = dateStr(n.primeira);
    const un = dateStr(n.ultima);
    if (pn && (!r.primeira_nf || pn < r.primeira_nf)) r.primeira_nf = pn;
    if (un && (!r.ultima_nf || un > r.ultima_nf)) r.ultima_nf = un;
    if (n.cd_empresa != null) r.cd_empresa = Number(n.cd_empresa);
  }

  for (const c of cars) {
    const r = ensure(c.cd_pessoa);
    if (!r) continue;
    r.qtd_car += num(c.qtd);
    r.car_total += num(c.valor_total);
    r.car_liquidado += num(c.valor_liquidado);
    r.car_a_vencer += num(c.valor_a_vencer);
    r.car_vencido += num(c.valor_vencido);
    r.car_aberto += num(c.valor_a_vencer) + num(c.valor_vencido);
    r.car_provisorio += num(c.valor_provisorio);
    r.car_juros_multa += num(c.valor_juros_multa);
  }

  let clients = [...byId.values()].map((r) => {
    const lastAny = [r.ultima_nf, r.ultima_ficha].filter(Boolean).sort().pop() || null;
    const recencia = daysSince(lastAny, ref);
    const freq = r.qtd_nf + r.qtd_fichas;
    return {
      ...r,
      empresa_nome: empresaNames[String(r.cd_empresa)] || (r.cd_empresa != null ? `Empresa ${r.cd_empresa}` : ''),
      ultima_atividade: lastAny,
      recencia_dias: recencia,
      frequencia: freq,
      ticket_medio: r.qtd_nf > 0 ? r.faturamento / r.qtd_nf : 0,
      status: statusOf(recencia, r.faturamento),
    };
  });

  clients.sort((a, b) => b.faturamento - a.faturamento);
  const total = clients.length;
  const clients_truncated = total > MAX_CLIENTS;
  const allForKpis = clients;
  clients = clients.slice(0, MAX_CLIENTS);

  const faturamentoTotal = allForKpis.reduce((s, c) => s + c.faturamento, 0);
  const comFaturamento = allForKpis.filter((c) => c.faturamento > 0);
  const ativos = allForKpis.filter((c) => c.status === 'ATIVO');
  const top10 = allForKpis.slice(0, 10).reduce((s, c) => s + c.faturamento, 0);

  const statusMap = new Map<string, { status: string; clientes: number; faturamento: number }>();
  for (const c of allForKpis) {
    const e = statusMap.get(c.status) || { status: c.status, clientes: 0, faturamento: 0 };
    e.clientes++; e.faturamento += c.faturamento;
    statusMap.set(c.status, e);
  }

  const empMap = new Map<string, any>();
  for (const c of allForKpis) {
    const key = String(c.cd_empresa ?? '—');
    const e = empMap.get(key) || {
      cd_empresa: c.cd_empresa, empresa_nome: c.empresa_nome || key,
      clientes: 0, ativos: 0, faturamento: 0, car_aberto: 0, car_vencido: 0,
    };
    e.clientes++;
    if (c.status === 'ATIVO') e.ativos++;
    e.faturamento += c.faturamento;
    e.car_aberto += c.car_aberto;
    e.car_vencido += c.car_vencido;
    empMap.set(key, e);
  }

  return {
    kpis: {
      clientes_total: total,
      clientes_com_faturamento: comFaturamento.length,
      clientes_ativos: ativos.length,
      clientes_churn: allForKpis.filter((c) => c.status === 'CHURN').length,
      faturamento_total: faturamentoTotal,
      ticket_medio_cliente: comFaturamento.length ? faturamentoTotal / comFaturamento.length : 0,
      concentracao_top10: faturamentoTotal ? (top10 / faturamentoTotal) * 100 : 0,
      car_aberto_total: allForKpis.reduce((s, c) => s + c.car_aberto, 0),
      car_vencido_total: allForKpis.reduce((s, c) => s + c.car_vencido, 0),
      car_liquidado_total: allForKpis.reduce((s, c) => s + (c.car_liquidado || 0), 0),
      car_provisorio_total: allForKpis.reduce((s, c) => s + (c.car_provisorio || 0), 0),
      car_juros_multa_total: allForKpis.reduce((s, c) => s + (c.car_juros_multa || 0), 0),
      recencia_media: (() => {
        const vals = allForKpis.map((c) => c.recencia_dias).filter((v) => v !== null) as number[];
        return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      })(),
    },
    status_distribution: [...statusMap.values()].sort((a, b) => b.clientes - a.clientes),
    by_empresa: [...empMap.values()].sort((a, b) => b.faturamento - a.faturamento),
    clients,
    clients_truncated,
  };
}