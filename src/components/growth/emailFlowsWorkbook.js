import * as XLSX from "xlsx-js-style";

// Colunas do arquivo: chave, título, largura e formato numérico opcional.
export const COLS = [
  ["nome", "Nome", 34],
  ["nome_fantasia", "Nome fantasia", 28],
  ["email", "E-mail", 32],
  ["telefone", "Telefone", 16],
  ["celular", "Celular", 16],
  ["cpf", "CPF", 16],
  ["cnpj", "CNPJ", 20],
  ["cidade", "Cidade", 20],
  ["uf", "UF", 6],
  ["dt_cadastro", "Cadastro", 12],
  ["qtd_orcamentos", "Orçamentos", 12, "0"],
  ["dt_ultimo_orcamento", "Último orçamento", 16],
  ["orcamento_aprovado", "Orçamento aprovado", 18],
  ["qtd_locacoes", "Locações", 11, "0"],
  ["dt_ultima_locacao", "Última locação", 15],
  ["dt_ultima_devolucao", "Última devolução", 16],
  ["ultimo_equipamento", "Último equipamento", 30],
  ["valor_faturado", "Valor faturado", 16, '"R$" #,##0.00'],
  ["dt_ultima_interacao", "Última interação", 16],
  ["dias_sem_interacao", "Dias sem interação", 16, "0"],
];

const BORDER = { style: "thin", color: { rgb: "D9D9D9" } };

const HEADER_STYLE = {
  font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "5B21B6" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
};

const bodyStyle = (even, numeric) => ({
  font: { sz: 10, color: { rgb: "1F2937" } },
  fill: { fgColor: { rgb: even ? "F5F3FF" : "FFFFFF" } },
  alignment: { horizontal: numeric ? "right" : "left", vertical: "center" },
  border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
});

function buildSheet(rows) {
  const aoa = [COLS.map(([, label]) => label), ...rows.map((r) => COLS.map(([k]) => r[k] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = COLS.map(([, , w]) => ({ wch: w }));
  ws["!rows"] = [{ hpt: 26 }];
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2" };
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: COLS.length - 1 } }),
  };

  COLS.forEach(([, , , fmt], c) => {
    const header = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (header) header.s = HEADER_STYLE;
    for (let r = 1; r <= rows.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      cell.s = bodyStyle(r % 2 === 0, cell.t === "n");
      if (fmt && cell.t === "n") cell.z = fmt;
    }
  });

  return ws;
}

function buildSummarySheet(groups, meta) {
  const body = [
    ...Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([f, rows]) => [f, rows.length]),
    ["", ""],
    ["Total com e-mail", meta.total || 0],
    ["Sem e-mail (fora do arquivo)", meta.clientes_sem_email || 0],
    ["Com locação ativa (excluídos)", meta.excluidos_em_locacao_ativa || 0],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
  ];
  const ws = XLSX.utils.aoa_to_sheet([["Fluxo", "Clientes"], ...body]);
  ws["!cols"] = [{ wch: 36 }, { wch: 16 }];
  ws["!rows"] = [{ hpt: 26 }];
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2" };

  for (let c = 0; c <= 1; c++) {
    const header = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (header) header.s = HEADER_STYLE;
    for (let r = 1; r <= body.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.s = bodyStyle(r % 2 === 0, cell.t === "n");
    }
  }
  return ws;
}

export function downloadEmailFlowsWorkbook(data) {
  const groups = data.rows.reduce((acc, r) => {
    (acc[r.fluxo] = acc[r.fluxo] || []).push(r);
    return acc;
  }, {});

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(groups, { ...data, total: data.rows.length }), "Resumo");
  Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([fluxo, rows]) => {
      XLSX.utils.book_append_sheet(wb, buildSheet(rows), fluxo.slice(0, 31));
    });

  XLSX.writeFile(wb, `fluxos-email-clientes-${new Date().toISOString().slice(0, 10)}.xlsx`);
}