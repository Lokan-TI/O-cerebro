import * as XLSX from "xlsx";
import { compareEmpresa, getEmpresaLabel } from "@/lib/empresaLabels";
import { fetchContratos } from "./contratosAbertosExport";
import { fichaCols, toSheet } from "./patrimonioExport";

// Todas as fichas "Aberta" do Sisloc, uma linha por ficha e sem equipamentos — para contar os contratos ativos.
export async function exportFichasSemEquipamentos(sourceId, empresa, setMsg) {
  setMsg("Buscando fichas abertas...");
  const fichas = await fetchContratos(sourceId, empresa, (n) => setMsg(`${n} fichas carregadas...`), "fichas");
  const clientes = new Set(fichas.map((f) => f.cd_pessoa)).size;
  if (!fichas.length) return { fichas: 0, clientes };
  fichas.sort((a, b) => compareEmpresa(a.cd_empresa, b.cd_empresa)
    || String(a.nm_pessoa || "").localeCompare(String(b.nm_pessoa || ""), "pt-BR") || a.cd_controle - b.cd_controle);

  const porEmpresa = new Map();
  for (const f of fichas) {
    const e = porEmpresa.get(f.cd_empresa) || porEmpresa.set(f.cd_empresa, { fichas: 0, clientes: new Set() }).get(f.cd_empresa);
    e.fichas++; e.clientes.add(f.cd_pessoa);
  }
  const resumo = [...porEmpresa].map(([cd, e]) => ({ "Empresa": getEmpresaLabel(cd), "Fichas abertas": e.fichas, "Clientes distintos": e.clientes.size }));
  if (resumo.length > 1) resumo.push({ "Empresa": "TOTAL", "Fichas abertas": fichas.length, "Clientes distintos": clientes });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, toSheet(resumo), "Resumo");
  XLSX.utils.book_append_sheet(wb, toSheet(fichas.map((f) => fichaCols(f))), "Fichas abertas");
  XLSX.writeFile(wb, `fichas_abertas_sem_equipamentos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return { fichas: fichas.length, clientes };
}