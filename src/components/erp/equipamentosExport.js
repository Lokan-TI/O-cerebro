// Exporta produtos/equipamentos (cadastro completo) e seus patrimônios em CSV compatível com Excel
const HEADERS = [
  "Código", "Código referencial", "Descrição", "Ativo", "Grupo", "Marca", "Modelo",
  "Unidade", "NCM", "Última compra", "Valor de compra/Produção", "Valor fabricante",
  "Dt. valor fabricante", "Valor indenização", "Valor venda usado", "Valor teto compra",
  "Valor base locação", "Peso líquido", "Peso bruto", "Observações",
  "Qtd patrimônios", "Nº patrimônio", "Nº série",
];

const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const money = (v) => (v === null || v === undefined ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const dateBr = (v) => (v ? v.split("-").reverse().join("/") : "");

function baseCols(e) {
  return [
    e.cd_equipto, e.codigo, e.nm_equipto, e.ativo, e.grupo, e.marca, e.modelo,
    e.unidade, e.ncm, dateBr(e.dt_ult_compra), money(e.vl_compra), money(e.vl_fabricante),
    dateBr(e.dt_vl_fabricante), money(e.vl_indenizacao), money(e.vl_venda_usado), money(e.vl_teto_compra),
    money(e.vl_base_locacao), money(e.peso_liquido), money(e.peso_bruto),
    String(e.observacao || "").replace(/\r?\n/g, " | "),
    e.qtd_patrimonios,
  ];
}

export function exportEquipamentosCsv(rows) {
  const lines = [HEADERS.join(";")];
  for (const e of rows) {
    const base = baseCols(e);
    if (e.patrimonios.length === 0) {
      lines.push([...base, "", ""].map(esc).join(";"));
    } else {
      for (const p of e.patrimonios) {
        lines.push([...base, p.nr_patrimonio, p.nr_serie].map(esc).join(";"));
      }
    }
  }
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `equipamentos_patrimonios_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}