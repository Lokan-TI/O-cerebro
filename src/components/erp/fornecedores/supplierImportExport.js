import * as XLSX from "xlsx";
import { onlyDigits } from "@/lib/erpFormat";
import { STATUS } from "./emailAudit";

// Planilha para importação no novo ERP: dados atuais (ERP) e da Receita (OpenCNPJ) em colunas separadas.
export function exportSupplierImport(rows, results) {
  const data = rows.map((r) => {
    const d = results[onlyDigits(r.cnpj || "")]?.status === "ok" ? results[onlyDigits(r.cnpj || "")] : {};
    return {
      "Código ERP": r.cd_pessoa, "CNPJ": onlyDigits(r.cnpj || ""), "Status consulta": STATUS[r.status]?.label || "", "Erro": r.erro || "", "Campos corrigidos no Cérebro": (r._corrected || []).join(", "),
      "Razão social (ERP)": r.nm_pessoa, "Razão social (Receita)": d.razao_social || "",
      "Nome fantasia (ERP)": r.nm_fan_pessoa || "", "Nome fantasia (Receita)": d.nome_fantasia || "",
      "Inscrição estadual (ERP)": r.inscricao_estadual || "",
      "E-mail (ERP)": r.email || "", "E-mail (Receita)": d.email || "",
      "Telefone (ERP)": r.telefone || "", "Telefone 1 (Receita)": d.telefone1 || "", "Telefone 2 (Receita)": d.telefone2 || "",
      "Logradouro (ERP)": r.logradouro || "", "Logradouro (Receita)": d.logradouro || "",
      "Número (ERP)": r.numero || "", "Número (Receita)": d.numero || "",
      "Complemento (ERP)": r.complemento || "", "Complemento (Receita)": d.complemento || "",
      "Bairro (ERP)": r.bairro || "", "Bairro (Receita)": d.bairro || "",
      "CEP (ERP)": onlyDigits(r.cep || ""), "CEP (Receita)": d.cep || "",
      "Cidade (ERP)": r.cidade || "", "Cidade (Receita)": d.municipio || "",
      "UF (ERP)": r.uf || "", "UF (Receita)": d.uf || "",
      "Código IBGE": d.codigo_ibge || "", "Código município (Receita)": d.codigo_municipio_receita || "",
      "Situação cadastral": d.situacao || "", "Data situação": d.data_situacao || "",
      "Matriz/Filial": d.matriz_filial || "", "Data abertura": d.data_abertura || "",
      "CNAE principal": d.cnae_principal || "", "Descrição CNAE": d.cnae_descricao || "",
      "Natureza jurídica": d.natureza_juridica || "", "Porte": d.porte || "",
      "Simples": d.simples || "", "MEI": d.mei || "", "Capital social": d.capital_social || "",
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = Object.keys(data[0] || {}).map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fornecedores");
  XLSX.writeFile(wb, `fornecedores_importacao_${new Date().toISOString().slice(0, 10)}.xlsx`);
}