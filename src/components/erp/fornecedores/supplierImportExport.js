import * as XLSX from "xlsx";
import { onlyDigits } from "@/lib/erpFormat";
import { STATUS } from "./emailAudit";
import { effective, publicOf } from "./publicFields";

// Planilha para importação no novo ERP: colunas "final" priorizam correção do Cérebro > fonte pública > ERP.
// As colunas (ERP) ficam apenas como referência; o Sisloc nunca é alterado.
export function exportSupplierImport(rows, results) {
  const data = rows.map((r) => {
    const d = publicOf(results, r) || {};
    const f = (k) => effective(r, publicOf(results, r), k);
    const erp = (k) => r._erp?.[k] ?? r[k] ?? "";
    return {
      "Código ERP": r.cd_pessoa, "CNPJ": onlyDigits(r.cnpj || ""), "Status consulta": STATUS[r.status]?.label || "", "Erro": r.erro || "",
      "Fonte pública": d.fonte || "", "Campos corrigidos no Cérebro": (r._corrected || []).join(", "),
      "Razão social": f("nm_pessoa"), "Nome fantasia": f("nm_fan_pessoa"),
      "Inscrição estadual": r.inscricao_estadual || "",
      "E-mail": f("email"), "Telefone": f("telefone"), "Telefone 2": d.telefone2 || "",
      "Logradouro": f("logradouro"), "Número": f("numero"), "Complemento": f("complemento"),
      "Bairro": f("bairro"), "CEP": onlyDigits(f("cep")), "Cidade": f("cidade"), "UF": f("uf"),
      "Código IBGE": f("codigo_ibge"), "Código município (Receita)": d.codigo_municipio_receita || "",
      "Situação cadastral": d.situacao || "", "Data situação": d.data_situacao || "",
      "Matriz/Filial": d.matriz_filial || "", "Data abertura": d.data_abertura || "",
      "CNAE principal": d.cnae_principal || "", "Descrição CNAE": d.cnae_descricao || "",
      "Natureza jurídica": d.natureza_juridica || "", "Porte": d.porte || "",
      "Simples": d.simples || "", "MEI": d.mei || "", "Capital social": d.capital_social || "",
      "Razão social (ERP)": erp("nm_pessoa"), "E-mail (ERP)": erp("email"),
      "Cidade (ERP)": erp("cidade"), "UF (ERP)": erp("uf"), "CEP (ERP)": onlyDigits(erp("cep")),
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = Object.keys(data[0] || {}).map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fornecedores");
  XLSX.writeFile(wb, `fornecedores_importacao_${new Date().toISOString().slice(0, 10)}.xlsx`);
}