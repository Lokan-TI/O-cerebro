// Contexto comercial do Cérebro: RD Marketing + CRM + vínculo com o ERP, agregado no servidor.
export const COMMERCIAL_RE = /lead|campanha|canal|origem|funil|pipeline|negocia|deal|crm|marketing|rd station|vendedor|responsavel|comercial|conversao|convert|perda|perdid|ganh|oportunidade|estrategi|prospec|etapa/;

// Taxa de ganho = ganhas / (ganhas + perdidas) — negociações em aberto não entram no denominador.
function summarizeOwners(rows: any[]) {
  const by = new Map<string, any>();
  for (const r of rows || []) {
    const k = r.owner || '(sem responsável)';
    const o = by.get(k) || { responsavel: k, total: 0, ganhas: 0, perdidas: 0, abertas: 0, valor_ganho: 0 };
    o.total += r.count;
    if (r.deal_status === 'won') { o.ganhas += r.count; o.valor_ganho += r.sum_amount || 0; }
    else if (r.deal_status === 'lost') o.perdidas += r.count;
    else o.abertas += r.count;
    by.set(k, o);
  }
  return [...by.values()]
    .map((o) => ({ ...o, taxa_ganho_pct: o.ganhas + o.perdidas ? Math.round((o.ganhas / (o.ganhas + o.perdidas)) * 1000) / 10 : null }))
    .sort((a, b) => b.total - a.total).slice(0, 20);
}

// Cobertura de vínculo RD → cliente ERP por produto (vínculo NÃO é venda ganha).
function summarizeLinks(rows: any[]) {
  const name: Record<string, string> = { marketing: 'leads_marketing', crm_deal: 'negociacoes_crm', crm_contact: 'contatos_crm', conversas: 'conversas' };
  const by: Record<string, any> = {};
  for (const r of rows || []) {
    const k = name[r.product] || r.product;
    const o = by[k] ||= { registros: 0, vinculados_ao_erp: 0, ambiguos: 0, sem_cliente_erp: 0, sem_identidade: 0, pendentes: 0, receita_erp_pos_lead_dos_vinculados: 0 };
    o.registros += r.count;
    if (r.match_status === 'matched' || r.match_status === 'manual') { o.vinculados_ao_erp += r.count; o.receita_erp_pos_lead_dos_vinculados += r.sum_erp_receita_pos_lead || 0; }
    else if (r.match_status === 'ambiguous') o.ambiguos += r.count;
    else if (r.match_status === 'no_identity') o.sem_identidade += r.count;
    else if (r.match_status === 'pending') o.pendentes += r.count;
    else o.sem_cliente_erp += r.count;
  }
  for (const o of Object.values(by)) o.cobertura_vinculo_pct = Math.round((o.vinculados_ao_erp / (o.registros || 1)) * 1000) / 10;
  return by;
}

export async function loadCommercialContext(base44: any, start: string | null, endExcl: string | null) {
  const db = base44.asServiceRole.entities;
  const period: any = {};
  if (start) period.$gte = start;
  if (endExcl) period.$lt = endExcl;
  const q = (extra: any) => (Object.keys(period).length ? { ...extra, source_created_at: period } : extra);
  const top = (rows: any[], n = 12) => (rows || []).slice(0, n);

  const [byProduct, mkCampaign, mkOrigin, deals, owners, lossStage, runs] = await Promise.all([
    db.RdLead.aggregate({ query: q({}), groupBy: ['product', 'match_status'], sum: ['erp_receita_pos_lead'] }),
    db.RdLead.aggregate({ query: q({ product: 'marketing' }), groupBy: 'campaign', sum: 'erp_receita_pos_lead', sort: '-count', limit: 15 }),
    db.RdLead.aggregate({ query: q({ product: { $in: ['marketing', 'crm_deal'] } }), groupBy: ['product', 'origin'], sort: '-count', limit: 25 }),
    db.RdLead.aggregate({ query: q({ product: 'crm_deal' }), groupBy: ['deal_status', 'pipeline'], sum: ['amount', 'erp_receita_pos_lead'], sort: '-count', limit: 30 }),
    db.RdLead.aggregate({ query: q({ product: 'crm_deal' }), groupBy: ['owner', 'deal_status'], sum: 'amount', limit: 1000 }),
    db.RdLead.aggregate({ query: q({ product: 'crm_deal', deal_status: 'lost' }), groupBy: 'stage', sum: 'amount', sort: '-count', limit: 12 }),
    db.RdSyncRun.filter({ status: 'done' }, { sort: '-finished_at', limit: 6, fields: ['product', 'finished_at', 'records'] }),
  ]);

  const data = {
    periodo_criacao_lead: { inicio: start || '(base inteira)', fim_exclusivo: endExcl || '(hoje)' },
    ultima_sincronizacao: (runs.items || []).map((r: any) => ({ produto: r.product, em: r.finished_at, registros: r.records })),
    vinculo_erp_por_produto: summarizeLinks(byProduct.rows),
    campanhas_marketing: top(mkCampaign.rows, 15),
    origens: top(mkOrigin.rows, 25),
    negociacoes_por_status_e_funil: top(deals.rows, 30),
    responsaveis_taxa_ganho: summarizeOwners(owners.rows),
    perdas_por_etapa: top(lossStage.rows),
  };
  return JSON.stringify(data).slice(0, 14000);
}