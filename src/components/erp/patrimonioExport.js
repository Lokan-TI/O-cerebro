import * as XLSX from "xlsx";
import { contratoCols, fetchContratos } from "./contratosAbertosExport";

// Busca fichas abertas + itens e gera a planilha por patrimônio.
export async function runExportPorPatrimonio(sourceId, empresa, setMsg) {
  setMsg("Buscando fichas...");
  const fichas = await fetchContratos(sourceId, empresa, (n) => setMsg(`${n} fichas carregadas...`), "fichas");
  const ctrls = fichas.map((f) => f.cd_controle);
  const rows = [];
  for (let i = 0; i < ctrls.length; i += 100) {
    rows.push(...await fetchContratos(sourceId, empresa, undefined, undefined, ctrls.slice(i, i + 100)));
    setMsg(`Itens: ${Math.min(i + 100, ctrls.length)}/${ctrls.length} fichas analisadas...`);
  }
  return exportPorPatrimonio(fichas, rows);
}

const num = (v) => Number(v) || 0;
const txt = (v) => (v == null ? "" : String(v).trim());
const dt = (v) => (!v || String(v).startsWith("9999") ? "" : String(v).slice(0, 10).split("-").reverse().join("/"));
const DATE_KEYS = ["Abertura", "Aprovação", "Vigência - período atual início", "Vigência - período atual fim", "Devolução prevista", "Devolução a partir de", "Última geração fatura", "Próxima geração fatura", "Próximo reajuste"];

// Uma linha por produto/patrimônio em posse, com todos os dados da ficha e do cliente (layout para importação no TOTVS).
export function exportPorPatrimonio(fichas, rows) {
  const byId = new Map(fichas.map((f) => [f.cd_controle, f]));
  const totRem = new Map();
  for (const r of rows) totRem.set(r.cd_flremessa, (totRem.get(r.cd_flremessa) || 0) + num(r.vl_nf));
  const out = [];
  const contratos = new Set();
  for (const r of rows) {
    const s = num(r.qt_remessa) - num(r.qt_devolvida);
    const f = byId.get(r.cd_controle);
    if (s <= 0 || !r.dt_saida || !f) continue;
    contratos.add(r.cd_controle);
    const base = contratoCols(f);
    for (const k of DATE_KEYS) base[k] = dt(base[k]);
    base["Nº contrato"] = String(base["Nº contrato"]).replace(/\d+/, (m) => m.padStart(6, "0"));
    out.push({
      ...base,
      "ID remessa": txt(r.cd_flremessa),
      "Nº contrato remessa": txt(r.nr_contrato),
      "Expedição": dt(r.dt_saida),
      "Entrega": dt(r.dt_entrega),
      "Início cobrança": dt(r.dt_cobranca),
      "Previsão retorno": dt(r.dt_prev_retorno),
      "ID equipamento": txt(r.cd_equipto),
      "Cód. produto": txt(r.cd_equipto_codigo),
      "Produto": txt(r.nm_equipto),
      "Complemento produto": txt(r.ds_equipto),
      "Grupo": txt(r.cd_grupo),
      "Patrimônio": txt(r.nr_patrimonio || r.cd_patrimonio),
      "Qtd. em posse": s,
      "Vl. unit. locação": num(r.vl_uni_locacao),
      "Vl. unit. diária": num(r.vl_uni_diaria),
      "Vl. unit. indenização": num(r.vl_uni_indenizacao),
      "VL total remessa": totRem.get(r.cd_flremessa) || 0,
      "VL rateado (item)": Math.round((num(r.vl_nf) * s) / (num(r.qt_remessa) || 1) * 100) / 100,
    });
  }
  const ws = XLSX.utils.json_to_sheet(out);
  const hdr = Object.keys(out[0] || {});
  hdr.forEach((h, i) => {
    if (!/^(Vl\.|VL)/.test(h)) return;
    const c = XLSX.utils.encode_col(i);
    for (let j = 2; j <= out.length + 1; j++) if (ws[c + j]) ws[c + j].z = '"R$" #,##0.00';
  });
  if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
  ws["!cols"] = hdr.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fichas x Patrimônio");
  XLSX.writeFile(wb, `fichas_abertas_por_patrimonio_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return { linhas: out.length, contratos: contratos.size };
}