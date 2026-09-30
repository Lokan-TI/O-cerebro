import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { getEmpresaLabel } from "@/lib/empresaLabels";

const num = (v) => Number(v) || 0;
const txt = (v) => (v == null ? "" : String(v));
const dt = (v) => (!v || String(v).startsWith("9999") ? "" : v);
const saldo = (r) => num(r.qt_remessa) - num(r.qt_devolvida);

export async function fetchContratos(sourceId, cdEmpresa, onProgress) {
  const rows = [];
  let after = 0;
  for (;;) {
    const res = await base44.functions.invoke("listContratosAbertos", { source_id: sourceId, cd_empresa: cdEmpresa, after, limit: 1000 });
    if (res.data?.error) throw new Error(res.data.error);
    rows.push(...res.data.rows);
    onProgress?.(rows.length);
    if (!res.data.has_more) return rows;
    after = res.data.next_after;
  }
}

const contratoCols = (r) => ({
  "ID contrato (ficha)": txt(r.cd_controle),
  "Nº contrato": [r.numero_prefixo, r.numero, r.numero_sufixo].filter(Boolean).join(""),
  "Empresa": getEmpresaLabel(r.cd_empresa),
  "Cód. empresa": txt(r.cd_empresa),
  "Unidade fiscal": txt(r.cd_empresa_mov),
  "Cód. cliente": txt(r.cd_pessoa),
  "Cliente": r.nm_pessoa || "",
  "Nome fantasia": r.nm_fan_pessoa || "",
  "Abertura": dt(r.dt_pedido),
  "Aprovação": dt(r.dt_aprovacao),
  "Vigência - período atual início": dt(r.dt_fai_ficha),
  "Vigência - período atual fim": dt(r.dt_faf_ficha),
  "Devolução prevista": dt(r.dt_prevista_devolucao),
  "Devolução a partir de": dt(r.dt_min_devolucao),
  "Última geração fatura": dt(r.dt_fau_ficha),
  "Próxima geração fatura": dt(r.dt_fat_ficha),
  "Próximo reajuste": dt(r.dt_prox_reajuste),
  "Modalidade cobrança": r.ds_calcfat || txt(r.cd_calcfat),
  "Períodos a faturar": txt(r.nr_periodos),
  "Mercado (atividade)": r.ds_atividade || txt(r.cd_atividade),
  "Região": r.nm_regiao || txt(r.cd_regiao),
  "Tipo contrato": txt(r.cd_tpcontrato),
  "Cond. pagamento": txt(r.cd_condpagto),
  "Tipo cobrança": txt(r.cd_tipocob),
  "Tabela preço": txt(r.cd_tab_preco),
  "Projeto": txt(r.cd_projeto),
  "Centro resultado": txt(r.cd_cr),
  "Vl. mínimo faturamento": num(r.vl_minimo_locacao),
  "Vl. preço dia": num(r.vl_preco_dia),
  "Vl. projeto": num(r.vl_projeto),
  "Obra - nome": r.nm_entrega || "",
  "Obra - endereço": [r.en_entrega, r.num_entrega, r.comp_entrega].filter(Boolean).join(", "),
  "Obra - bairro": r.br_entrega || "",
  "Obra - cidade": r.ci_entrega || "",
  "Obra - UF": r.uf_entrega || "",
  "Obra - CEP": txt(r.cp_entrega),
  "Obra - CNPJ": txt(r.cnpj_entrega),
  "Contato": r.contato || "",
  "Telefone": txt(r.telefone),
  "Observação": (r.observacao || "").trim(),
});

export function exportContratosXlsx(rows) {
  const byContrato = new Map();
  for (const r of rows) {
    const c = byContrato.get(r.cd_controle) || { base: r, itens: 0, emPosse: 0, qtPosse: 0, vlLocPosse: 0, bens: new Set() };
    c.itens++;
    const s = saldo(r);
    if (s > 0) {
      c.emPosse++; c.qtPosse += s; c.vlLocPosse += s * num(r.vl_uni_locacao);
      c.bens.add(r.nm_equipto || r.ds_equipto || txt(r.cd_equipto));
    }
    byContrato.set(r.cd_controle, c);
  }
  const contratos = [...byContrato.values()].map((c) => ({
    ...contratoCols(c.base),
    "Itens enviados (linhas)": c.itens,
    "Itens em posse (linhas)": c.emPosse,
    "Qtd. bens em posse": c.qtPosse,
    "Vl. locação em posse (qtd × unit.)": c.vlLocPosse,
    "Bens em posse": [...c.bens].join(" | "),
  }));
  const itens = rows.map((r) => ({
    "ID contrato (ficha)": txt(r.cd_controle),
    "Nº contrato remessa": txt(r.nr_contrato),
    "Empresa": getEmpresaLabel(r.cd_empresa),
    "Cliente": r.nm_pessoa || "",
    "Mercado (atividade)": r.ds_atividade || "",
    "ID remessa": txt(r.cd_flremessa),
    "Expedição": dt(r.dt_saida),
    "Entrega": dt(r.dt_entrega),
    "Início cobrança": dt(r.dt_cobranca),
    "Início período remessa": dt(r.dt_ini_contrato),
    "Fim período remessa": dt(r.dt_fim_contrato),
    "Previsão retorno": dt(r.dt_prev_retorno),
    "ID item": txt(r.cd_flremequ),
    "ID equipamento": txt(r.cd_equipto),
    "Cód. equipamento": txt(r.cd_equipto_codigo),
    "Equipamento": r.nm_equipto || "",
    "Complemento": r.ds_equipto || "",
    "Patrimônio": txt(r.cd_patrimonio),
    "Grupo": txt(r.cd_grupo),
    "Qtd. enviada": num(r.qt_remessa),
    "Qtd. devolvida": num(r.qt_devolvida),
    "Qtd. em posse": saldo(r),
    "Vl. unit. locação": num(r.vl_uni_locacao),
    "Vl. unit. diária": num(r.vl_uni_diaria),
    "Vl. unit. tabela": num(r.vl_uni_tabela),
    "Vl. unit. indenização": num(r.vl_uni_indenizacao),
    "Vl. NF": num(r.vl_nf),
    "Latitude": txt(r.ds_latitude),
    "Longitude": txt(r.ds_longitude),
  }));
  const wb = XLSX.utils.book_new();
  for (const [name, data] of [["Contratos", contratos], ["Itens (bens)", itens]]) {
    const ws = XLSX.utils.json_to_sheet(data);
    if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
    ws["!cols"] = Object.keys(data[0] || {}).map((h) => ({ wch: Math.max(h.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, `contratos_abertos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return contratos.length;
}