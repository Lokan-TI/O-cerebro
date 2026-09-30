import * as XLSX from "xlsx";
import { fetchContratos } from "./contratosAbertosExport";

// Mantém tudo como veio do ERP; códigos/documentos viram texto para preservar zeros
const cell = (k, v) => (v != null && typeof v === "number" && /^(cd_|nr_|cpf|cnpj|cp_|codigo|numero)/i.test(k) ? String(v) : v);
const prefix = (p, o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [`${p}.${k}`, cell(k, v)]));
const byKey = (rows, k) => new Map(rows.map((r) => [r[k], r]));

export async function exportContratosBruto(sourceId, empresa, onMsg) {
  const get = (mode, label) => fetchContratos(sourceId, empresa, (n) => onMsg(`${label}: ${n} linhas...`), mode);
  const fichas = await get("raw_fichas", "Fichas");
  const pessoas = await get("raw_pessoas", "Clientes");
  const remessas = await get("raw_remessas", "Remessas");
  const itens = await get("raw_itens", "Itens");
  const faturas = await get("raw_faturas", "Faturas");
  onMsg("Gerando Excel...");

  const F = byKey(fichas, "cd_controle"), P = byKey(pessoas, "cd_pessoa"), R = byKey(remessas, "cd_flremessa");
  const linhas = itens.map((e) => {
    const r = R.get(e.cd_flremessa) || {}, f = F.get(r.cd_controle) || {};
    return { ...prefix("fich_loc", f), ...prefix("pessoa", P.get(f.cd_pessoa)), ...prefix("fl_remessa", r), ...prefix("fl_rem_equ", e),
      "qt_em_posse": (Number(e.qt_remessa) || 0) - (Number(e.qt_devolvida_calc) || 0) };
  });
  const fat = faturas.map((ft) => ({ ...prefix("fl_fatura", ft), ...prefix("fich_loc", { numero: F.get(ft.cd_controle)?.numero, cd_pessoa: F.get(ft.cd_controle)?.cd_pessoa }) }));

  const wb = XLSX.utils.book_new();
  const sheets = [["Itens de contrato", linhas], ["Contratos (fich_loc)", fichas.map((f) => prefix("fich_loc", f))],
    ["Clientes (pessoa)", pessoas.map((p) => prefix("pessoa", p))], ["Remessas", remessas.map((r) => prefix("fl_remessa", r))],
    ["Períodos (fl_fatura)", fat]];
  for (const [name, data] of sheets) {
    const ws = XLSX.utils.json_to_sheet(data);
    if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, `contratos_sisloc_bruto_${empresa || "todas"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return { contratos: fichas.length, itens: itens.length };
}