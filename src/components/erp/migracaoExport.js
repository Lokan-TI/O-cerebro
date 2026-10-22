import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { merge } from "@/components/erp/fornecedores/useSupplierCache";
import { fetchContratos, contratoCols } from "./contratosAbertosExport";

const num = (v) => Number(v) || 0;
const s = (v) => String(v ?? "").trim();
const dt = (v) => (!v || String(v).startsWith("9999") ? "" : v);
const digits = (v) => s(v).replace(/\D/g, "");
const cell = (t) => (t.length > 32000 ? t.slice(0, 32000) + " …(cortado)" : t);

async function loadCadastro(sourceId) {
  const out = new Map();
  let cursor;
  do {
    const page = await base44.entities.ClienteCadastroCache.filter({ source_key: sourceId }, { limit: 1000, cursor });
    for (const r of page.items) out.set(String(r.cd_pessoa), merge(r));
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return out;
}

function clienteCols(p = {}, c) {
  const cnpj = digits(p.nr_cnpj_pessoa), cpf = digits(p.nr_cpf_pessoa);
  const v = (k, erp) => s(c?.[k]) || s(erp);
  return {
    "Tipo pessoa": cnpj.length === 14 ? "PJ" : cpf ? "PF" : "",
    "CNPJ": cnpj, "CPF": cpf,
    "Razão social / Nome": v("nm_pessoa", p.nm_pessoa),
    "Nome fantasia (cadastro)": v("nm_fan_pessoa", p.nm_fan_pessoa),
    "Inscrição estadual": v("inscricao_estadual", p.nr_ies_pessoa),
    "RG": s(p.nr_rg_pessoa),
    "E-mail": v("email", p.en_mail_pessoa),
    "Telefone": v("telefone", p.tel_pessoa),
    "Celular": s(p.tl_cel_pessoa),
    "Logradouro": v("logradouro", p.log_pessoa),
    "Número": v("numero", p.num_pessoa),
    "Complemento": v("complemento", p.comple_pessoa),
    "Bairro": v("bairro", p.bairro_pessoa),
    "Cidade": v("cidade", p.cidade_pessoa),
    "UF": v("uf", p.uf_pessoa),
    "CEP": digits(v("cep", p.cep_pessoa)),
    "Código IBGE": s(c?.codigo_ibge),
    "Cadastro corrigido (fonte pública)": c?._pubStatus === "ok" ? "Sim" : c?._pubStatus ? `Não (${c._pubStatus})` : "Não consultado",
    "Campos corrigidos manualmente": (c?._corrected || []).join(", "),
  };
}

export async function exportMigracao(sourceId, empresa, onMsg) {
  onMsg("Buscando fichas abertas...");
  const fichas = await fetchContratos(sourceId, empresa, (n) => onMsg(`${n} fichas...`), "fichas");
  onMsg("Buscando itens...");
  const itens = await fetchContratos(sourceId, empresa, (n) => onMsg(`${n} itens...`), "raw_itens");
  const remessas = await fetchContratos(sourceId, empresa, (n) => onMsg(`${n} remessas...`), "raw_remessas");
  const faturas = await fetchContratos(sourceId, empresa, (n) => onMsg(`${n} movimentações...`), "renovacoes");
  const pessoas = await fetchContratos(sourceId, empresa, (n) => onMsg(`${n} clientes...`), "raw_pessoas");
  onMsg("Lendo correção cadastral...");
  const cad = await loadCadastro(sourceId);

  const pes = new Map(pessoas.map((p) => [String(p.cd_pessoa), p]));
  const remCtrl = new Map(remessas.map((r) => [r.cd_flremessa, r]));
  const group = (list, keyFn) => list.reduce((m, x) => { const k = keyFn(x); if (k != null) (m.get(k) || m.set(k, []).get(k)).push(x); return m; }, new Map());
  const itensBy = group(itens, (e) => remCtrl.get(e.cd_flremessa)?.cd_controle);
  const fatBy = group(faturas, (f) => f.cd_controle);

  const linhas = fichas.map((f) => {
    const its = itensBy.get(f.cd_controle) || [];
    const fts = (fatBy.get(f.cd_controle) || []).sort((a, b) => s(a.dt_inicio).localeCompare(s(b.dt_inicio)));
    const normais = fts.filter((x) => s(x.fatura_complementar) !== "S");
    const compl = fts.filter((x) => s(x.fatura_complementar) === "S");
    const emPosse = its.filter((e) => num(e.qt_remessa) - num(e.qt_devolvida_calc) > 0);
    return {
      "Empresa (filial)": getEmpresaLabel(f.cd_empresa),
      ...clienteCols(pes.get(String(f.cd_pessoa)), cad.get(String(f.cd_pessoa))),
      ...contratoCols(f),
      "Data inicial contratada": dt(normais[0]?.dt_inicio) || dt(f.dt_fai_ficha),
      "Data final contratada (último período)": dt(normais.at(-1)?.dt_fim) || dt(f.dt_faf_ficha),
      "Qtd. períodos faturados": normais.length,
      "Qtd. renovações": Math.max(0, normais.length - 1),
      "Períodos / renovações (início→fim: valor)": cell(normais.map((x, i) => `${i === 0 ? "Inicial" : `Ren.${i}`} ${dt(x.dt_inicio)}→${dt(x.dt_fim)}: ${num(x.vl_fatura).toFixed(2)}`).join(" | ")),
      "Vl. períodos faturados": normais.reduce((t, x) => t + num(x.vl_fatura), 0),
      "Qtd. faturas complementares": compl.length,
      "Faturas complementares (data: valor)": cell(compl.map((x) => `${dt(x.dt_geracao)}: ${num(x.vl_fatura).toFixed(2)}`).join(" | ")),
      "Vl. faturas complementares": compl.reduce((t, x) => t + num(x.vl_fatura), 0),
      "Qtd. itens na ficha": its.length,
      "Qtd. itens em posse": emPosse.length,
      "Itens (equipamento · patrimônio · qtd enviada/devolvida · vl unit.)": cell(its.map((e) =>
        `${s(e.ds_equipto) || s(e.cd_equipto)} · Pat ${s(e.cd_patrimonio) || "-"} · ${num(e.qt_remessa)}/${num(e.qt_devolvida_calc)} · ${num(e.vl_uni_locacao).toFixed(2)}`).join(" | ")),
      "Patrimônios em posse": cell(emPosse.map((e) => s(e.cd_patrimonio)).filter(Boolean).join(", ")),
    };
  }).sort((a, b) => a["Empresa (filial)"].localeCompare(b["Empresa (filial)"]) || a["Razão social / Nome"].localeCompare(b["Razão social / Nome"]));

  if (!linhas.length) return 0;
  const wb = XLSX.utils.book_new();
  const add = (name, data) => {
    const ws = XLSX.utils.json_to_sheet(data);
    if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
    ws["!cols"] = Object.keys(data[0]).map((h) => ({ wch: Math.min(Math.max(h.length + 2, 14), 60) }));
    XLSX.utils.book_append_sheet(wb, ws, name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  };
  add("Todas as fichas", linhas);
  for (const [emp, rows] of group(linhas, (l) => l["Empresa (filial)"])) add(emp, rows);
  XLSX.writeFile(wb, `migracao_fichas_abertas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return linhas.length;
}