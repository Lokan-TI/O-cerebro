import { onlyDigits } from "@/lib/erpFormat";

// Campo do cadastro (Cérebro) ← campo da fonte pública (Receita via OpenCNPJ/BrasilAPI).
export const PUBLIC_MAP = [
  ["nm_pessoa", "razao_social"], ["nm_fan_pessoa", "nome_fantasia"], ["email", "email"],
  ["telefone", "telefone1"], ["logradouro", "logradouro"], ["numero", "numero"],
  ["complemento", "complemento"], ["bairro", "bairro"], ["cep", "cep"],
  ["cidade", "municipio"], ["uf", "uf"], ["codigo_ibge", "codigo_ibge"],
];

export const publicOf = (results, row) => {
  const d = results[onlyDigits(row.cnpj || "")];
  return d?.status === "ok" ? d : null;
};

// Prioridade: correção salva no Cérebro > fonte pública > ERP.
export function effective(row, pub, field) {
  if ((row._corrected || []).includes(field)) return row[field] ?? "";
  const src = PUBLIC_MAP.find(([k]) => k === field)?.[1];
  return (pub && src && pub[src]) || row._erp?.[field] || row[field] || "";
}

// Novas correções a partir da fonte pública, sem sobrescrever correções manuais já salvas.
export function publicCorrections(row, pub) {
  const out = { ...(row._corrected || []).reduce((m, k) => ({ ...m, [k]: row[k] }), {}) };
  PUBLIC_MAP.forEach(([k, src]) => {
    const v = String(pub[src] ?? "").trim();
    if (!v || k in out) return;
    if (v !== String(row._erp?.[k] ?? "").trim()) out[k] = v;
  });
  return out;
}