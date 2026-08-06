// Camada analítica — Conversão de Novos Clientes (SISLOC)
// Recebe linhas brutas (pessoa / fich_loc / nf) e devolve o bloco analítico completo.
// Regras documentadas em src/lib/conversionDocs.js

const DAY = 86400000;

function onlyDigits(v: any) { return String(v ?? '').replace(/\D/g, ''); }

function validCpf(d: string) {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += Number(d[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== Number(d[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += Number(d[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  return r === Number(d[10]);
}

function validCnpj(d: string) {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    let pos = len - 7, sum = 0;
    for (let i = 0; i < len; i++) { sum += Number(d[i]) * pos--; if (pos < 2) pos = 9; }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

function median(arr: number[]) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function avg(arr: number[]) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pct(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : null;
}

function maskDoc(d: string) {
  if (!d) return null;
  if (d.length <= 5) return d;
  return d.slice(0, 3) + '*'.repeat(Math.max(0, d.length - 5)) + d.slice(-2);
}

const WINDOW_BUCKETS = [
  { key: 'mesmo_dia', label: 'Mesmo dia', max: 0 },
  { key: 'ate_7', label: 'Até 7 dias', max: 7 },
  { key: 'ate_15', label: 'Até 15 dias', max: 15 },
  { key: 'ate_30', label: 'Até 30 dias', max: 30 },
  { key: 'ate_60', label: 'Até 60 dias', max: 60 },
  { key: 'ate_90', label: 'Até 90 dias', max: 90 },
  { key: 'acima_90', label: 'Acima de 90 dias', max: Infinity },
];

function bucketOf(days: number | null) {
  if (days == null) return 'nao_convertido';
  for (const b of WINDOW_BUCKETS) if (days <= b.max) return b.key;
  return 'acima_90';
}

export function buildConversion({ pessoas, fichas, notas, notasCanceladas, vendorNames, empresaNames, sourceName, periodStart, periodEnd, clientLimit = 2000 }: any) {
  const fichaMap: Record<string, any> = {};
  for (const f of fichas) fichaMap[String(f.cd_pessoa)] = f;
  const nfMap: Record<string, any> = {};
  for (const n of notas) nfMap[String(n.cd_pessoa)] = n;
  const cancMap: Record<string, number> = {};
  for (const c of notasCanceladas) cancMap[String(c.cd_pessoa)] = Number(c.qtd) || 0;

  // Duplicidades por documento (CPF/CNPJ)
  const docCount: Record<string, number> = {};
  for (const p of pessoas) {
    const doc = onlyDigits(p.nr_cnpj_pessoa) || onlyDigits(p.nr_cpf_pessoa);
    if (doc && doc.length >= 11) docCount[doc] = (docCount[doc] || 0) + 1;
  }

  const now = Date.now();
  const rows: any[] = [];

  for (const p of pessoas) {
    const cd = String(p.cd_pessoa);
    const dtCad = p.dt_cad_pessoa ? new Date(p.dt_cad_pessoa) : null;
    const f = fichaMap[cd];
    const n = nfMap[cd];
    const dtFicha = f?.dt_pedido ? new Date(f.dt_pedido) : null;
    const dtNf = n?.dt_emi_nf ? new Date(n.dt_emi_nf) : null;
    const doc = onlyDigits(p.nr_cnpj_pessoa) || onlyDigits(p.nr_cpf_pessoa);
    const isPJ = !!onlyDigits(p.nr_cnpj_pessoa);
    const docValido = doc ? (isPJ ? validCnpj(doc) : validCpf(doc)) : false;
    const dup = doc && docCount[doc] > 1;

    // Inconsistências de datas
    const inconsist: string[] = [];
    if (!dtCad || isNaN(dtCad.getTime())) inconsist.push('Data de cadastro nula ou inválida');
    else if (dtCad.getTime() > now) inconsist.push('Data de cadastro futura');
    if (dtFicha && dtCad && dtFicha < dtCad) inconsist.push('Ficha anterior ao cadastro');
    if (dtFicha && dtFicha.getTime() > now) inconsist.push('Ficha com data futura');
    if (dtNf && dtCad && dtNf < dtCad) inconsist.push('Nota anterior ao cadastro');
    if (dtNf && dtFicha && dtNf < dtFicha) inconsist.push('Nota anterior à ficha');
    if (dtNf && dtNf.getTime() > now) inconsist.push('Nota com data futura');

    const diasFicha = dtCad && dtFicha ? Math.max(0, Math.round((dtFicha.getTime() - dtCad.getTime()) / DAY)) : null;
    const diasNf = dtCad && dtNf ? Math.max(0, Math.round((dtNf.getTime() - dtCad.getTime()) / DAY)) : null;
    const diasFichaNf = dtFicha && dtNf ? Math.max(0, Math.round((dtNf.getTime() - dtFicha.getTime()) / DAY)) : null;

    // Status da conversão (regras exclusivas, na ordem de prioridade)
    let status: string;
    if (inconsist.length) status = 'DADOS INCONSISTENTES';
    else if (p.fl_cliente_pessoa !== true && p.fl_cliente_pessoa !== 1) status = 'TIPO DE PESSOA NÃO CONFIRMADO';
    else if (n) status = 'CONVERTIDO COM NOTA FISCAL';
    else if (cancMap[cd] > 0) status = 'NOTA FISCAL CANCELADA';
    else if (f) status = 'COM FICHA SEM NOTA FISCAL';
    else if (dup) status = 'POSSÍVEL DUPLICIDADE';
    else status = 'CADASTRADO SEM FICHA';

    const empresa = f?.cd_empresa ?? n?.cd_empresa ?? null;
    const vendId = f?.cd_pessoa_fun ?? null;

    rows.push({
      gid: `${sourceName}-${cd}`,
      cd_pessoa: cd,
      nome: p.nm_pessoa || `Cliente ${cd}`,
      doc: maskDoc(doc),
      doc_tipo: isPJ ? 'PJ' : (doc ? 'PF' : 'SEM DOC'),
      doc_valido: doc ? docValido : null,
      dt_cad: dtCad ? dtCad.toISOString().slice(0, 10) : null,
      coorte: dtCad ? dtCad.toISOString().slice(0, 7) : null,
      cd_empresa: empresa,
      nm_empresa: empresa != null ? (empresaNames[empresa] || `Empresa ${empresa}`) : null,
      vendedor_ficha: vendId != null ? (vendorNames[vendId] || `Vendedor ${vendId}`) : null,
      vendedor_id: vendId,
      dt_ficha: dtFicha ? dtFicha.toISOString().slice(0, 10) : null,
      nr_ficha: f?.cd_controle ?? null,
      qtd_fichas: f?.qtd ?? 0,
      fichas_ativas: f?.ativas ?? 0,
      dias_ficha: diasFicha,
      dt_nf: dtNf ? dtNf.toISOString().slice(0, 10) : null,
      nr_nf: n?.nr_nf ?? null,
      vl_primeira_nf: n?.vl_primeira ?? 0,
      vl_total: n?.vl_total ?? 0,
      qtd_nfs: n?.qtd ?? 0,
      qtd_nfs_canceladas: cancMap[cd] || 0,
      dias_nf: diasNf,
      dias_ficha_nf: diasFichaNf,
      status,
      duplicidade: !!dup,
      inconsistencias: inconsist,
      cliente_confirmado: p.fl_cliente_pessoa === true || p.fl_cliente_pessoa === 1,
    });
  }

  const confirmados = rows.filter(r => r.cliente_confirmado);
  const total = confirmados.length;
  const comFicha = confirmados.filter(r => r.nr_ficha != null);
  const comNf = confirmados.filter(r => r.dt_nf != null);
  const faturamento = comNf.reduce((s, r) => s + (r.vl_total || 0), 0);
  const primeiraNfTotal = comNf.reduce((s, r) => s + (r.vl_primeira_nf || 0), 0);

  const diasFichaArr = comFicha.map(r => r.dias_ficha).filter((d): d is number => d != null);
  const diasNfArr = comNf.map(r => r.dias_nf).filter((d): d is number => d != null);
  const diasFnArr = comNf.map(r => r.dias_ficha_nf).filter((d): d is number => d != null);

  const kpis = {
    novos_cadastros: total,
    registros_pessoa: rows.length,
    nao_confirmados: rows.length - total,
    com_ficha: comFicha.length,
    com_nf: comNf.length,
    sem_ficha: total - comFicha.length,
    ficha_sem_nf: comFicha.length - comNf.length,
    taxa_cadastro_ficha: pct(comFicha.length, total),
    taxa_ficha_nf: pct(comNf.length, comFicha.length),
    taxa_cadastro_nf: pct(comNf.length, total),
    taxa_sem_ficha: pct(total - comFicha.length, total),
    taxa_ficha_sem_nf: pct(comFicha.length - comNf.length, comFicha.length),
    pf: confirmados.filter(r => r.doc_tipo === 'PF').length,
    pj: confirmados.filter(r => r.doc_tipo === 'PJ').length,
    sem_documento: confirmados.filter(r => r.doc_tipo === 'SEM DOC').length,
    documento_invalido: confirmados.filter(r => r.doc_valido === false).length,
    duplicidades: confirmados.filter(r => r.duplicidade).length,
    inconsistentes: rows.filter(r => r.inconsistencias.length > 0).length,
    sem_vendedor: comFicha.filter(r => r.vendedor_id == null).length,
    sem_empresa: confirmados.filter(r => r.cd_empresa == null).length,
    faturamento_novos: faturamento,
    faturamento_medio_convertido: comNf.length ? faturamento / comNf.length : 0,
    ticket_primeira_nf: comNf.length ? primeiraNfTotal / comNf.length : 0,
    nfs_por_cliente: comNf.length ? comNf.reduce((s, r) => s + r.qtd_nfs, 0) / comNf.length : 0,
    tempo_medio_ficha: avg(diasFichaArr),
    tempo_mediano_ficha: median(diasFichaArr),
    tempo_medio_nf: avg(diasNfArr),
    tempo_mediano_nf: median(diasNfArr),
    tempo_medio_ficha_nf: avg(diasFnArr),
    conv_7d: pct(comNf.filter(r => (r.dias_nf ?? 999) <= 7).length, total),
    conv_30d: pct(comNf.filter(r => (r.dias_nf ?? 999) <= 30).length, total),
    conv_90d: pct(comNf.filter(r => (r.dias_nf ?? 999) <= 90).length, total),
  };

  const funnel = [
    { etapa: 'Novos cadastros', qtd: total, pct_anterior: 100, pct_total: 100, perda: 0 },
    {
      etapa: 'Com ficha de locação', qtd: comFicha.length,
      pct_anterior: pct(comFicha.length, total), pct_total: pct(comFicha.length, total),
      perda: total - comFicha.length,
    },
    {
      etapa: 'Com nota fiscal', qtd: comNf.length,
      pct_anterior: pct(comNf.length, comFicha.length), pct_total: pct(comNf.length, total),
      perda: comFicha.length - comNf.length,
    },
  ];

  // Coortes por mês de cadastro
  const currentMonth = new Date().toISOString().slice(0, 7);
  const cohortMap: Record<string, any> = {};
  for (const r of confirmados) {
    const key = r.coorte || 'sem-data';
    if (!cohortMap[key]) cohortMap[key] = { mes: key, novos: 0, com_ficha: 0, com_nf: 0, faturamento: 0, dias_ficha: [], dias_nf: [] };
    const c = cohortMap[key];
    c.novos++;
    if (r.nr_ficha != null) { c.com_ficha++; if (r.dias_ficha != null) c.dias_ficha.push(r.dias_ficha); }
    if (r.dt_nf) { c.com_nf++; c.faturamento += r.vl_total || 0; if (r.dias_nf != null) c.dias_nf.push(r.dias_nf); }
  }
  const cohorts = Object.values(cohortMap).map((c: any) => ({
    mes: c.mes,
    em_andamento: c.mes === currentMonth,
    novos: c.novos,
    com_ficha: c.com_ficha,
    com_nf: c.com_nf,
    taxa_ficha: pct(c.com_ficha, c.novos),
    taxa_nf: pct(c.com_nf, c.novos),
    faturamento: c.faturamento,
    tempo_medio_ficha: avg(c.dias_ficha),
    tempo_medio_nf: avg(c.dias_nf),
  })).sort((a, b) => String(a.mes).localeCompare(String(b.mes)));

  // Janelas de conversão
  const windows = [...WINDOW_BUCKETS.map(b => ({ key: b.key, label: b.label })), { key: 'nao_convertido', label: 'Não convertido' }]
    .map(b => ({
      key: b.key,
      label: b.label,
      ficha: confirmados.filter(r => bucketOf(r.dias_ficha) === b.key).length,
      nf: confirmados.filter(r => bucketOf(r.dias_nf) === b.key).length,
    }));

  // Por vendedor (vendedor da primeira ficha)
  const vendMap: Record<string, any> = {};
  for (const r of confirmados) {
    const key = r.vendedor_ficha || 'Sem vendedor';
    if (!vendMap[key]) vendMap[key] = { vendedor: key, novos: 0, com_ficha: 0, com_nf: 0, faturamento: 0, dias_ficha: [], dias_nf: [] };
    const v = vendMap[key];
    v.novos++;
    if (r.nr_ficha != null) { v.com_ficha++; if (r.dias_ficha != null) v.dias_ficha.push(r.dias_ficha); }
    if (r.dt_nf) { v.com_nf++; v.faturamento += r.vl_total || 0; if (r.dias_nf != null) v.dias_nf.push(r.dias_nf); }
  }
  const by_vendor = Object.values(vendMap).map((v: any) => ({
    vendedor: v.vendedor,
    novos: v.novos,
    com_ficha: v.com_ficha,
    com_nf: v.com_nf,
    sem_ficha: v.novos - v.com_ficha,
    taxa_ficha: pct(v.com_ficha, v.novos),
    taxa_nf: pct(v.com_nf, v.novos),
    faturamento: v.faturamento,
    ticket_medio: v.com_nf ? v.faturamento / v.com_nf : 0,
    tempo_medio_ficha: avg(v.dias_ficha),
    tempo_medio_nf: avg(v.dias_nf),
  })).sort((a, b) => b.novos - a.novos);

  // Por empresa/filial
  const empMap: Record<string, any> = {};
  for (const r of confirmados) {
    const key = r.nm_empresa || 'Sem filial';
    if (!empMap[key]) empMap[key] = { empresa: key, cd_empresa: r.cd_empresa, novos: 0, com_ficha: 0, com_nf: 0, faturamento: 0 };
    const e = empMap[key];
    e.novos++;
    if (r.nr_ficha != null) e.com_ficha++;
    if (r.dt_nf) { e.com_nf++; e.faturamento += r.vl_total || 0; }
  }
  const by_empresa = Object.values(empMap).map((e: any) => ({
    ...e,
    taxa_ficha: pct(e.com_ficha, e.novos),
    taxa_nf: pct(e.com_nf, e.novos),
    ticket_medio: e.com_nf ? e.faturamento / e.com_nf : 0,
  })).sort((a, b) => b.novos - a.novos);

  // Distribuição de status
  const statusMap: Record<string, number> = {};
  for (const r of rows) statusMap[r.status] = (statusMap[r.status] || 0) + 1;
  const status_distribution = Object.entries(statusMap)
    .map(([status, qtd]) => ({ status, qtd, pct: pct(qtd, rows.length) }))
    .sort((a, b) => b.qtd - a.qtd);

  // Duplicidades — taxa bruta x saneada
  const docsUnicos = new Set<string>();
  const semDoc: any[] = [];
  for (const r of confirmados) {
    const d = r.doc ? r.gid + (r.doc_tipo === 'SEM DOC' ? '' : '') : '';
    if (r.doc_tipo === 'SEM DOC') semDoc.push(r);
  }
  const docGroups: Record<string, any[]> = {};
  for (const p of pessoas) {
    const doc = onlyDigits(p.nr_cnpj_pessoa) || onlyDigits(p.nr_cpf_pessoa);
    if (doc && doc.length >= 11) (docGroups[doc] = docGroups[doc] || []).push(String(p.cd_pessoa));
  }
  const dupGroups = Object.entries(docGroups).filter(([, ids]) => ids.length > 1);
  const idsByDoc = new Set(Object.values(docGroups).flat());
  const clientesUnicos = Object.keys(docGroups).length + confirmados.filter(r => !idsByDoc.has(r.cd_pessoa)).length;
  const rowById: Record<string, any> = {};
  for (const r of confirmados) rowById[r.cd_pessoa] = r;
  let unicosComNf = 0;
  for (const [, ids] of Object.entries(docGroups)) {
    if (ids.some(id => rowById[id]?.dt_nf)) unicosComNf++;
  }
  for (const r of confirmados) if (!idsByDoc.has(r.cd_pessoa) && r.dt_nf) unicosComNf++;

  const duplicates = {
    ids_cadastrados: total,
    clientes_unicos_estimados: clientesUnicos,
    grupos_duplicados: dupGroups.length,
    ids_duplicados: dupGroups.reduce((s, [, ids]) => s + ids.length, 0),
    taxa_bruta: pct(comNf.length, total),
    taxa_saneada: pct(unicosComNf, clientesUnicos),
    exemplos: dupGroups.slice(0, 30).map(([doc, ids]) => ({
      doc: maskDoc(doc),
      qtd: ids.length,
      nomes: ids.map(id => rowById[id]?.nome).filter(Boolean).slice(0, 4),
    })),
  };

  const validations = [
    { item: 'Registros na tabela pessoa no período', valor: rows.length, ok: rows.length > 0 },
    { item: 'Confirmados como cliente (fl_cliente_pessoa)', valor: total, ok: total > 0 },
    { item: 'Tipo de pessoa não confirmado', valor: rows.length - total, ok: true },
    { item: 'Clientes com ficha vinculada (fich_loc.cd_pessoa)', valor: comFicha.length, ok: comFicha.length > 0 },
    { item: 'Clientes com nota fiscal válida (nf)', valor: comNf.length, ok: true },
    { item: 'Clientes só com notas canceladas', valor: rows.filter(r => r.status === 'NOTA FISCAL CANCELADA').length, ok: true },
    { item: 'Possíveis duplicidades por documento', valor: duplicates.ids_duplicados, ok: true },
    { item: 'Datas inconsistentes', valor: kpis.inconsistentes, ok: true },
    { item: 'Clientes sem documento', valor: kpis.sem_documento, ok: true },
    { item: 'Documento inválido (CPF/CNPJ)', valor: kpis.documento_invalido, ok: true },
    { item: 'Fichas sem vendedor identificado', valor: kpis.sem_vendedor, ok: true },
    { item: 'Clientes sem filial identificada', valor: kpis.sem_empresa, ok: true },
  ];

  const sorted = rows.sort((a, b) => String(b.dt_cad || '').localeCompare(String(a.dt_cad || '')));

  return {
    kpis,
    funnel,
    cohorts,
    windows,
    by_vendor,
    by_empresa,
    status_distribution,
    duplicates,
    validations,
    clients: sorted.slice(0, clientLimit),
    clients_truncated: sorted.length > clientLimit,
    period_start: periodStart,
    period_end: periodEnd,
  };
}