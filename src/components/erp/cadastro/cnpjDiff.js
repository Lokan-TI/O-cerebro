import * as XLSX from "xlsx";

export const FIELDS = [
  { key: "razao_social", label: "Razão social", group: "nome", erp: "nm_pessoa", pub: "razao_social" },
  { key: "nome_fantasia", label: "Nome fantasia", group: "nome", erp: "nm_fan_pessoa", pub: "nome_fantasia" },
  { key: "logradouro", label: "Logradouro", group: "endereco", erp: "log_pessoa", pub: "logradouro" },
  { key: "numero", label: "Número", group: "endereco", erp: "num_pessoa", pub: "numero" },
  { key: "complemento", label: "Complemento", group: "endereco", erp: "comple_pessoa", pub: "complemento" },
  { key: "bairro", label: "Bairro", group: "endereco", erp: "bairro_pessoa", pub: "bairro" },
  { key: "cidade", label: "Município", group: "endereco", erp: "cidade_pessoa", pub: "municipio" },
  { key: "uf", label: "UF", group: "endereco", erp: "uf_pessoa", pub: "uf" },
  { key: "cep", label: "CEP", group: "endereco", erp: "cep_pessoa", pub: "cep", digits: true },
  { key: "telefone", label: "Telefone", group: "contato", erp: "tel_pessoa", pub: "telefone1", digits: true },
  { key: "email", label: "E-mail", group: "contato", erp: "en_mail_pessoa", pub: "email" },
  { key: "situacao", label: "Situação cadastral", group: "situacao" },
];

export const GROUPS = { nome: "Nome empresarial", endereco: "Endereço", contato: "Contatos", situacao: "Situação" };

export const STATUS = {
  divergente: { label: "Com divergência", cls: "text-amber-400" },
  sem_divergencia: { label: "Sem divergência", cls: "text-emerald-400" },
  not_found: { label: "Não encontrado", cls: "text-gray-400" },
  error: { label: "Falha na consulta", cls: "text-red-400" },
  cnpj_invalido: { label: "CNPJ inválido", cls: "text-red-300" },
};

const digits = (s) => String(s || "").replace(/\D/g, "");
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9@.]/gi, "").toUpperCase();

export const tipoLabel = (p) => [p.fl_cliente_pessoa ? "Cliente" : "", p.fl_fornec_pessoa ? "Fornecedor" : ""].filter(Boolean).join("/");

// Só sugere quando a fonte pública traz valor e ele difere do ERP (campo vazio na fonte nunca apaga dado do ERP).
export function computeDiffs(p, pub) {
  const out = [];
  for (const f of FIELDS) {
    if (f.key === "situacao") {
      // fl_ativo do ERP não é confiável como situação fiscal; sinaliza só empresas não ativas na Receita.
      const s = String(pub.situacao || "").toUpperCase();
      if (s && s !== "ATIVA") out.push({ field: f.key, label: f.label, erp: "Cadastro em uso no ERP", suggested: `${s}${pub.data_situacao ? ` desde ${pub.data_situacao}` : ""}` });
      continue;
    }
    const sug = String(pub[f.pub] || "").trim();
    if (!sug) continue;
    if (pub.anonimizado && f.group !== "endereco" && f.key !== "uf") continue;
    const a = f.digits ? digits(p[f.erp]) : norm(p[f.erp]);
    const b = f.digits ? digits(sug) : norm(sug);
    if (a !== b) out.push({ field: f.key, label: f.label, erp: String(p[f.erp] || ""), suggested: sug });
  }
  return out;
}

export function exportChanges(items, groups) {
  const rows = [];
  for (const r of items) for (const d of r.diffs || []) {
    if (!groups.has(FIELDS.find((f) => f.key === d.field)?.group)) continue;
    rows.push({ "CNPJ": r.cnpj, "Código ERP (cd_pessoa)": r.cd_pessoa, "Tipo de pessoa": r.tipo, "Nome": r.nm_pessoa,
      "Campo": d.label, "Valor atual (ERP)": d.erp, "Valor sugerido": d.suggested, "Fonte": r.fonte, "Data da consulta": r.consulted_at });
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [16, 14, 18, 36, 18, 36, 36, 12, 22].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Alterações sugeridas");
  XLSX.writeFile(wb, `correcao_cadastral_cnpj_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return rows.length;
}