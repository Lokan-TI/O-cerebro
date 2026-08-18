export const EMPRESA_LABELS = {
  4: "001 - PEMT",
  7: "002 - ESTR",
  8: "003 - FACIL",
  9: "004 - LOND",
  11: "005 - CURI",
  10: "006 - TRÊS",
  13: "008 - PIRA",
  12: "010 - MONT",
};

// Ordena pela numeração de exibição (001, 002, ... 010), não pelo código interno do ERP.
export function compareEmpresa(a, b) {
  return String(getEmpresaLabel(a)).localeCompare(String(getEmpresaLabel(b)), "pt-BR");
}

export function getEmpresaLabel(cdEmpresa, fallbackName) {
  return EMPRESA_LABELS[cdEmpresa] || fallbackName || `Empresa ${cdEmpresa}`;
}