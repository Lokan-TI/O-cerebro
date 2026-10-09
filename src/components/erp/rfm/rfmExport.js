import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { SEGMENTS } from "@/lib/rfm";

const fmtD = (d) => (d ? d.split("-").reverse().join("/") : "");
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const HEAD = ["Cliente", "CNPJ/CPF", "E-mail", "Telefone", "Celular", "Segmento", "R", "F", "M", "Última NF", "Dias", "NFs", "Receita",
  "Orçamentos", "Último orçamento", "Contato últ. orçamento", "Tel. últ. orçamento", "Locações", "Última locação", "Contato últ. locação", "Tel. últ. locação", "Títulos em aberto", "Valor em aberto"];

export async function buildRows(list, orcLoc, periods) {
  const payload = { ids: list.map((c) => c.id), orc_start: periods.orc.start, orc_end: periods.orc.end, loc_start: periods.loc.start, loc_end: periods.loc.end };
  if (periods.sourceId) payload.source_id = periods.sourceId;
  const r = await base44.functions.invoke("listRfmContatos", payload);
  if (r.data?.success === false) throw new Error(r.data.error);
  const ct = r.data?.contatos || {};
  return list.map((c) => {
    const o = orcLoc[c.id] || {}, k = ct[c.id] || {};
    return [c.nm || "", c.cnpj || "", k.email || "", k.telefone || "", k.celular || "", SEGMENTS[c.seg].label, c.R, c.F, c.M, fmtD(c.ultima), c.dias, c.nfs, c.receita,
      o.orc ?? 0, fmtD(o.ultimoOrc), k.orc_contato || "", k.orc_telefone || "", o.loc ?? 0, fmtD(o.ultimaLoc), k.loc_contato || "", k.loc_telefone || "", o.titulos ?? 0, o.aberto || 0];
  });
}

export function toExcel(rows, title) {
  const ws = XLSX.utils.aoa_to_sheet([HEAD, ...rows.map((r) => r.map((v, i) => (i === 1 || i === 3 || i === 4 || i === 16 || i === 20 ? { t: "s", v: String(v) } : v)))]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  XLSX.writeFile(wb, `rfm_${title}.xlsx`);
}

export function toPdf(rows, title) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const W = [36, 22, 34, 19, 19, 21, 5, 5, 5, 15, 8, 8, 20, 10, 15, 24, 19, 10, 15, 24, 19, 10, 20];
  let y = 14;
  doc.setFontSize(12); doc.text(`RFM · ${title} · ${rows.length} clientes`, 8, y); y += 7;
  const line = (cells, bold) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(6.5);
    let x = 8;
    cells.forEach((v, i) => { doc.text(doc.splitTextToSize(String(v ?? ""), W[i] - 1)[0] || "", x, y); x += W[i]; });
    y += 4.5;
  };
  line(HEAD, true);
  rows.forEach((r) => {
    if (y > 285) { doc.addPage(); y = 14; line(HEAD, true); }
    line(r.map((v, i) => (i === 12 || i === 22 ? brl(v) : v)));
  });
  doc.save(`rfm_${title}.pdf`);
}