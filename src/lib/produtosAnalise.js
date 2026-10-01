import { base44 } from "@/api/base44Client";

const PARTS = [
  ["catalogo", "Carregando catálogo de produtos..."],
  ["saldos", "Calculando saldos de estoque..."],
  ["ativos", "Analisando patrimônios, locações e receita..."],
  ["manutencao", "Somando custos de manutenção..."],
];

export async function loadProdutos(sourceId, onProgress) {
  const out = {};
  const queries = [];
  for (const [part, msg] of PARTS) {
    onProgress?.(msg);
    const payload = { part };
    if (sourceId) payload.source_id = sourceId;
    const res = await base44.functions.invoke("analyzeProdutos", payload);
    out[part] = res.data.rows;
    queries.push(res.data.query);
  }
  const familias = await base44.entities.GrupoFamilia.list("-created_date", 1000);
  return { ...merge(out, familias), queries };
}

function merge({ catalogo, saldos, ativos, manutencao }, familias) {
  const famByGrupo = new Map(familias.map((f) => [Number(f.cd_grupo), f.familia]));
  const saldoBy = new Map(saldos.map((s) => [s.cd_equipto, s]));
  const manutBy = new Map(manutencao.map((m) => [m.cd_patrimonio, m]));
  const patsBy = new Map();
  for (const a of ativos) {
    const m = manutBy.get(a.cd_patrimonio);
    const pat = {
      ...a,
      qtd_os: m?.qtd_os || 0, manut_material: m?.material || 0, manut_servico: m?.servico || 0,
      manut_terceiro: m?.terceiro || 0, manutencao: m?.custo || 0, ultima_os: m?.ultima_os || null,
    };
    pat.resultado = pat.receita - pat.manutencao;
    if (!patsBy.has(a.cd_equipto)) patsBy.set(a.cd_equipto, []);
    patsBy.get(a.cd_equipto).push(pat);
  }
  const produtos = catalogo.map((p) => {
    const s = saldoBy.get(p.cd_equipto);
    const pats = (patsBy.get(p.cd_equipto) || []).sort((a, b) => b.receita - a.receita);
    const saldo = s?.saldo || 0;
    const sum = (k) => pats.reduce((t, x) => t + x[k], 0);
    return {
      ...p,
      familia: famByGrupo.get(p.cd_grupo) || "NÃO CLASSIFICADO",
      saldo,
      custo_medio: s?.custo_medio || 0,
      valor_estoque: Math.max(saldo, 0) * (s?.custo_medio || p.vl_compra || 0),
      patrimonios: pats,
      qtd_patrimonios: pats.length,
      qtd_locados: pats.filter((x) => x.em_locacao).length,
      receita: sum("receita"),
      manutencao: sum("manutencao"),
    };
  });
  for (const p of produtos) p.resultado = p.receita - p.manutencao;
  return { produtos };
}