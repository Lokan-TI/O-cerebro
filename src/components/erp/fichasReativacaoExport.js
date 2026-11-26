import * as XLSX from "xlsx";
import { compareEmpresa, getEmpresaLabel } from "@/lib/empresaLabels";
import { invokeFichasStatus } from "./fichasStatusApi";
import { toSheet } from "./patrimonioExport";

const txt = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const cmp = (a, b) => a.localeCompare(b, "pt-BR");
// A cidade é digitada na ficha ("BAURU", "Bauru", "Lençóis", "LENCOIS"): uma grafia só, para o filtro juntar as fichas dela.
const cidade = (v) => txt(v).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Lista de reativação para o coordenador de cada filial: todas as fichas de locação, de qualquer status,
// uma linha por ficha e uma aba por filial, só com o que ele precisa para ligar ao cliente e para
// priorizar, pelo filtro da cidade da obra, as obras mais próximas da unidade.
export async function exportFichasReativacao(sourceId, cdEmpresa, onProgress) {
  const porFilial = new Map();
  let total = 0;
  for (let after = 0, more = true; more;) {
    const payload = { after, limit: 2500, com_produtos: true };
    if (sourceId) payload.source_id = sourceId;
    if (cdEmpresa != null) payload.cd_empresa = cdEmpresa;
    const data = await invokeFichasStatus(payload);
    for (const f of data.rows) {
      const aba = porFilial.get(f.cd_empresa) || porFilial.set(f.cd_empresa, { filial: getEmpresaLabel(f.cd_empresa, f.nm_empresa), linhas: [] }).get(f.cd_empresa);
      aba.linhas.push({ "Filial": aba.filial, "Cidade da obra": cidade(f.cidade_obra), "Cliente": txt(f.nm_pessoa), "Contato": txt(f.contato), "Telefone da ficha": txt(f.telefone), "Produto": f.produtos.join("; ") });
    }
    total += data.rows.length;
    after = data.next_after; more = data.has_more;
    onProgress(total);
  }
  if (!total) return { fichas: 0, filiais: 0 };

  const wb = XLSX.utils.book_new();
  for (const cd of [...porFilial.keys()].sort(compareEmpresa)) {
    const { filial, linhas } = porFilial.get(cd);
    linhas.sort((a, b) => cmp(a.Cliente, b.Cliente) || cmp(a.Contato, b.Contato));
    const ws = toSheet(linhas);
    ws["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 50 }, { wch: 28 }, { wch: 20 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, ws, filial.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  }
  XLSX.writeFile(wb, `reativacao_fichas_por_filial_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return { fichas: total, filiais: porFilial.size };
}