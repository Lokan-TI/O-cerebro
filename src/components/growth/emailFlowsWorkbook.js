import * as XLSX from "xlsx";

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

function buildSheet(rows) {
  const aoa = [COLS.map(([, label]) => label), ...rows.map((r) => COLS.map(([k]) => r[k] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Larguras das colunas
  ws["!cols"] = COLS.map(([, , w]) => ({ wch: w }));
  // Altura do cabeçalho
  ws["!rows"] = [{ hpt: 22 }];
  // Cabeçalho congelado + filtro automático
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2" };
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: COLS.length - 1 } }),
  };

  // Formatos numéricos por coluna (moeda e inteiros)
  COLS.forEach(([, , , fmt], c) => {
    if (!fmt) return;
    for (let r = 1; r <= rows.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === "n") cell.z = fmt;
    }
  });

  return ws;
}

function buildSummarySheet(groups, meta) {
  const aoa = [
    ["Fluxo", "Clientes"],
    ...Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([f, rows]) => [f, rows.length]),
    [],
    ["Total com e-mail", meta.total || 0],
    ["Sem e-mail (fora do arquivo)", meta.clientes_sem_email || 0],
    ["Com locação ativa (excluídos)", meta.excluidos_em_locacao_ativa || 0],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 36 }, { wch: 14 }];
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2" };
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