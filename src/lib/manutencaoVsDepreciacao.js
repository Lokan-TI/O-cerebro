import { usefulLife } from "@/lib/capexOpex";

// Cruza manutenção paga nos últimos 12 meses com a depreciação real de cada item.
// Depreciação real = valor imobilizado / vida útil da família; o desgaste já
// consumido vem da idade real dos patrimônios do item.
export const VEREDITOS = {
  queima: {
    key: "queima",
    label: "Queima caixa",
    hint: "Manutenção anual maior que a depreciação — o item custa mais do que devolve em valor",
  },
  atencao: {
    key: "atencao",
    label: "Sob atenção",
    hint: "Manutenção entre 50% e 100% da depreciação anual",
  },
  saudavel: { key: "saudavel", label: "Saudável", hint: "Manutenção abaixo de 50% da depreciação anual" },
  parado: { key: "parado", label: "Sem manutenção", hint: "Nenhuma ordem de serviço no período" },
  sem_valor: {
    key: "sem_valor",
    label: "Sem valor no ERP",
    hint: "Item sem valor de aquisição cadastrado — a depreciação não pode ser calculada",
  },
};

export function analyzeItems(items = []) {
  return items
    .map((it) => {
      const vida = usefulLife(`${it.grupo} ${it.nm_equipto}`);
      const depreciacao_anual = vida ? it.vl_aquisicao / vida : 0;
      const idade = it.idade_media ?? 0;
      const consumido_pct = vida ? Math.min(100, (idade / vida) * 100) : 0;
      const valor_residual = Math.max(0, it.vl_aquisicao * (1 - Math.min(1, vida ? idade / vida : 1)));
      const razao = depreciacao_anual > 0 ? it.manutencao_12m / depreciacao_anual : it.manutencao_12m > 0 ? Infinity : 0;
      const custo_total = depreciacao_anual + it.manutencao_12m;

      const sem_valor = it.vl_aquisicao <= 0;

      let veredito = VEREDITOS.saudavel.key;
      if (it.manutencao_12m <= 0) veredito = VEREDITOS.parado.key;
      else if (sem_valor) veredito = VEREDITOS.sem_valor.key;
      else if (razao >= 1) veredito = VEREDITOS.queima.key;
      else if (razao >= 0.5) veredito = VEREDITOS.atencao.key;

      return {
        ...it,
        vida_util: vida,
        depreciacao_anual,
        valor_residual,
        consumido_pct,
        totalmente_depreciado: vida > 0 && idade >= vida,
        razao,
        sem_valor,
        excedente: sem_valor ? 0 : it.manutencao_12m - depreciacao_anual,
        custo_total,
        manut_por_unidade: it.qtd_patrimonios ? it.manutencao_12m / it.qtd_patrimonios : 0,
        veredito,
      };
    })
    .sort((a, b) => b.excedente - a.excedente);
}

export function summarizeItems(rows = []) {
  const com_manut = rows.filter((r) => r.manutencao_12m > 0);
  const queima = rows.filter((r) => r.veredito === VEREDITOS.queima.key);
  const zumbis = queima.filter((r) => r.totalmente_depreciado);
  return {
    itens: rows.length,
    itens_com_manutencao: com_manut.length,
    manutencao_total: rows.reduce((s, r) => s + r.manutencao_12m, 0),
    depreciacao_total: rows.reduce((s, r) => s + r.depreciacao_anual, 0),
    queima_qtd: queima.length,
    queima_manutencao: queima.reduce((s, r) => s + r.manutencao_12m, 0),
    queima_excedente: queima.reduce((s, r) => s + Math.max(0, r.excedente), 0),
    zumbis_qtd: zumbis.length,
    zumbis_manutencao: zumbis.reduce((s, r) => s + r.manutencao_12m, 0),
  };
}