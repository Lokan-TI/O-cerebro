// Exporta produtos/equipamentos e seus patrimônios em CSV compatível com Excel
const HEADERS = ["Código produto", "Descrição (nm_equipto)", "Qtd patrimônios", "Nº patrimônio", "Nº série"];

const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function exportEquipamentosCsv(rows) {
  const lines = [HEADERS.join(";")];
  for (const e of rows) {
    if (e.patrimonios.length === 0) {
      lines.push([e.cd_equipto, e.nm_equipto, 0, "", ""].map(esc).join(";"));
    } else {
      for (const p of e.patrimonios) {
        lines.push([e.cd_equipto, e.nm_equipto, e.qtd_patrimonios, p.nr_patrimonio, p.nr_serie].map(esc).join(";"));
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