// Exporta a lista de fornecedores em CSV compatível com Excel (BOM + ponto e vírgula),
// com todos os dados cadastrais para migração ao novo ERP.
const COLS = [
  ["cd_pessoa", "Código"],
  ["nm_pessoa", "Razão Social"],
  ["nm_fan_pessoa", "Nome Fantasia"],
  ["cnpj", "CNPJ"],
  ["cpf", "CPF"],
  ["inscricao_estadual", "Inscrição Estadual"],
  ["logradouro", "Logradouro"],
  ["numero", "Número"],
  ["complemento", "Complemento"],
  ["bairro", "Bairro"],
  ["cidade", "Cidade"],
  ["uf", "UF"],
  ["cep", "CEP"],
  ["telefone", "Telefone"],
  ["email", "E-mail"],
  ["ativo", "Ativo"],
  ["dt_cadastro", "Data de Cadastro"],
  ["cap_qtd", "Títulos CAP (total)"],
  ["cap_total", "CAP Total (R$)"],
  ["cap_aberto", "CAP em Aberto (R$)"],
  ["cap_baixado", "CAP Baixado (R$)"],
  ["cap_vencido", "CAP Vencido (R$)"],
  ["cap_primeiro", "Primeiro Lançamento"],
  ["cap_ultimo", "Último Lançamento"],
];

import { fmtDoc, fmtIe } from "@/lib/erpFormat";

import * as XLSX from "xlsx";

const DOC_COLS = new Set(["cnpj", "cpf"]);
const NUM_COLS = new Set(["cap_qtd", "cap_total", "cap_aberto", "cap_baixado", "cap_vencido"]);

// Planilha .xlsx em formato de tabela: 1 linha de cabeçalho + 1 linha por fornecedor, células próprias,
// com autofiltro. Textos (CNPJ, IE, número, CEP) gravados como texto para preservar zeros.
export function exportFornecedoresCsv(suppliers) {
  const cell = (r, key) => {
    const v = r[key];
    if (v === true) return "Sim";
    if (v === false) return "Não";
    if (NUM_COLS.has(key)) return Number(v) || 0;
    if (DOC_COLS.has(key)) return fmtDoc(v) || "";
    if (key === "inscricao_estadual") return fmtIe(v) || "";
    return String(v ?? "").trim();
  };
  const aoa = [COLS.map(([, l]) => l), ...suppliers.map((r) => COLS.map(([k]) => cell(r, k)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  Object.keys(ws).forEach((addr) => {
    if (addr[0] !== "!" && ws[addr].t === "s") ws[addr].z = "@";
  });
  ws["!cols"] = COLS.map(() => ({ wch: 20 }));
  ws["!autofilter"] = { ref: ws["!ref"] };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fornecedores");
  XLSX.writeFile(wb, `fornecedores_historico_completo_${new Date().toISOString().slice(0, 10)}.xlsx`);
}