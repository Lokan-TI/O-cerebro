import * as XLSX from "xlsx";
import { fetchDetalhes } from "./useQuedaLocacoes";
import { STATUS, fmtD } from "./quedaCalc";

// Exporta exatamente o recorte filtrado: aba Clientes + aba Fichas (renovações e equipamentos por ficha).
export async function exportQueda(params, list, onProgress) {
  const det = { fichas: [], orcamentos: [] };
  for (let i = 0; i < list.length; i += 150) {
    onProgress?.(Math.min(i + 150, list.length), list.length);
    const d = await fetchDetalhes(params, list.slice(i, i + 150).map((c) => c.cd_pessoa));
    det.fichas.push(...d.fichas); det.orcamentos.push(...d.orcamentos);
  }
  const orc = new Map(det.orcamentos.map((o) => [o.cd_pessoa, o]));
  const nome = new Map(list.map((c) => [c.cd_pessoa, c.nome]));
  const per = `A: ${fmtD(params.p1.start)}–${fmtD(params.p1.end)} | B: ${fmtD(params.p2.start)}–${fmtD(params.p2.end)}`;
  const clientes = list.map((c) => {
    const o = orc.get(c.cd_pessoa);
    return {
      "Código": c.cd_pessoa, Cliente: c.nome, Documento: c.doc, "Períodos": per, Status: STATUS[c.status].label,
      "Fichas A": c.loc_a, "Fichas B": c.loc_b, "Diferença": c.diff, "Variação %": c.pct == null ? "" : Math.round(c.pct * 100),
      "Renovações A": c.ren_a, "Renovações B": c.ren_b, "Orçamentos A": c.orc_a, "Orçamentos B": c.orc_b,
      "Orçamentos não fechados (A+B)": c.orc_a + c.orc_b, "Última locação": fmtD(c.ult_loc), "Último orçamento": fmtD(c.ult_orc),
      "Equipamentos do último orçamento": o?.equipamentos || "",
    };
  });
  const fichas = det.fichas.map((f) => ({
    "Código": f.cd_pessoa, Cliente: nome.get(f.cd_pessoa) || "", Ficha: f.numero, "Período": f.periodo, "Início": fmtD(f.inicio),
    "Renovações": f.renovacoes, "Movimentações": f.movimentacoes.map((m) => m.split("→").map(fmtD).join(" a ")).join(" · "),
    "Encerrada em": fmtD(f.encerrada),
    Equipamentos: f.equipamentos.map((e) => `${e.nome} (${e.qt}${e.em_cliente ? `, ${e.em_cliente} no cliente` : ""})`).join("; ") || "sem remessa registrada",
  }));
  const wb = XLSX.utils.book_new();
  for (const [n, rows] of [["Clientes", clientes], ["Fichas", fichas]]) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Aviso: "Sem registros" }]);
    ws["!autofilter"] = { ref: ws["!ref"] };
    XLSX.utils.book_append_sheet(wb, ws, n);
  }
  XLSX.writeFile(wb, `queda_locacoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
}