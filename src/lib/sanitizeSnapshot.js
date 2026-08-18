import { filterEmpresaRows } from "@/lib/empresaScope";

// Remove as empresas fora de escopo (LLK RENTAL / JCK) de qualquer lista com
// cd_empresa dentro do snapshot — inclusive de snapshots antigos, gerados antes
// da regra de exclusão. Não recalcula KPIs consolidados.
export function sanitizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;

  const clean = (obj) => {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value) && value.some((r) => r && typeof r === "object" && "cd_empresa" in r)) {
        out[key] = filterEmpresaRows(value);
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        out[key] = clean(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  };

  return clean(snapshot);
}