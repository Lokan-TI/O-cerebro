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

export function exportFornecedoresCsv(suppliers) {
  const esc = (v) => {
    if (v === true) return "Sim";
    if (v === false) return "Não";
    if (typeof v === "number") return String(v).replace(".", ",");
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = COLS.map(([, label]) => label).join(";");
  const lines = suppliers.map((r) => COLS.map(([key]) => esc(r[key])).join(";"));
  const csv = "\uFEFF" + [header, ...lines].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fornecedores_historico_completo.csv`;
  a.click();
  URL.revokeObjectURL(url);
}