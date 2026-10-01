import * as XLSX from "xlsx-js-style";
import { getEmpresaLabel } from "@/lib/empresaLabels";

const txt = (v) => ({ v: String(v ?? ""), t: "s" });
const num = (v) => ({ v: Number(v || 0), t: "n", z: "#,##0.00" });

function sheet(headers, rows) {
  const head = headers.map((h) => ({ v: h, t: "s", s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4C1D95" } } } }));
  const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  return ws;
}

export function exportProdutosXlsx(produtos) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(
    ["Código produto", "Código", "Produto", "Grupo", "Família", "Ativo", "Saldo estoque", "Custo médio", "Valor estoque", "Patrimônios", "Locados agora", "Receita estimada", "Custo manutenção", "Resultado"],
    produtos.map((p) => [txt(p.cd_equipto), txt(p.codigo), txt(p.nm_equipto), txt(p.grupo), txt(p.familia), txt(p.ativo ? "Sim" : "Não"),
      num(p.saldo), num(p.custo_medio), num(p.valor_estoque), num(p.qtd_patrimonios), num(p.qtd_locados), num(p.receita), num(p.manutencao), num(p.resultado)])
  ), "Produtos");

  const pats = produtos.flatMap((p) => p.patrimonios.map((a) => ({ p, a })));
  XLSX.utils.book_append_sheet(wb, sheet(
    ["Patrimônio", "Série", "Código produto", "Produto", "Grupo", "Empresa", "Aquisição", "Valor aquisição", "Vendido", "Em locação", "Cliente atual", "Contrato atual"],
    pats.map(({ p, a }) => [txt(a.nr_patrimonio), txt(a.nr_serie), txt(p.cd_equipto), txt(p.nm_equipto), txt(p.grupo), txt(a.cd_empresa ? getEmpresaLabel(a.cd_empresa) : ""),
      txt(a.dt_aquisicao), num(a.vl_aquisicao), txt(a.vendido ? "Sim" : "Não"), txt(a.em_locacao ? "Sim" : "Não"), txt(a.cliente_atual), txt(a.contrato_atual)])
  ), "Patrimônios");

  XLSX.utils.book_append_sheet(wb, sheet(
    ["Patrimônio", "Produto", "Locações", "Dias locados", "Última saída", "Receita estimada"],
    pats.map(({ p, a }) => [txt(a.nr_patrimonio), txt(p.nm_equipto), num(a.qtd_locacoes), num(a.dias_locados), txt(a.ultima_saida), num(a.receita)])
  ), "Receita por ativo");

  XLSX.utils.book_append_sheet(wb, sheet(
    ["Patrimônio", "Produto", "Qtd OS", "Material", "Serviço", "Terceiros", "Custo total", "Última OS", "Receita estimada", "Resultado"],
    pats.map(({ p, a }) => [txt(a.nr_patrimonio), txt(p.nm_equipto), num(a.qtd_os), num(a.manut_material), num(a.manut_servico), num(a.manut_terceiro), num(a.manutencao), txt(a.ultima_os), num(a.receita), num(a.resultado)])
  ), "Manutenção por ativo");

  XLSX.writeFile(wb, `produtos_estoque_${new Date().toISOString().slice(0, 10)}.xlsx`);
}