import * as XLSX from "xlsx-js-style";
import { base44 } from "@/api/base44Client";
import { getEmpresaLabel } from "@/lib/empresaLabels";
import { merge } from "@/components/erp/fornecedores/useSupplierCache";
import { fetchContratos, fetchByFichas, contratoCols } from "./contratosAbertosExport";
import { aplicarFiltro } from "./fichaFiltros";

const num = (v) => Number(v) || 0;
const s = (v) => String(v ?? "").trim();
const dt = (v) => (!v || String(v).startsWith("9999") ? "" : v);
const digits = (v) => s(v).replace(/\D/g, "");
const brl = (v) => "R$ " + num(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MOEDA_FMT = '"R$" #,##0.00';
const isMoeda = (h) => h === "Valor da remessa" || /^Vl\./.test(h);
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

const pat = (e) => (num(e.cd_patrimonio) > 0 ? s(e.nr_patrimonio_calc).trim() || s(e.cd_patrimonio) : "");
const prod = (e) => s(e.nm_equipto_calc) || s(e.ds_equipto) || s(e.cd_equipto);
const VALOR = "Valor da remessa";
const EMP = "Empresa (filial)", CLI = "Razão social / Nome";

// Uma linha por remessa: entregas agrupadas por remessa, retiradas agrupadas por data de devolução.
function remessaRows(its, remCtrl, historico) {
  const ev = new Map();
  const add = (key, base, e, qtd) => {
    const r = ev.get(key) || ev.set(key, { ...base, itens: [] }).get(key);
    r.itens.push({ e, qtd });
  };
  for (const e of its) {
    const rm = remCtrl.get(e.cd_flremessa) || {};
    // Somente equipamentos em posse: quantidade remetida ainda sem devolução
    add(`E${e.cd_flremessa}`, { tipo: "Entrega", nr: s(rm.nr_contrato) || s(e.cd_flremessa), data: dt(rm.dt_entrega) || dt(rm.dt_saida) }, e, num(e.qt_remessa) - num(e.qt_devolvida_calc));
    // Histórico: devoluções agrupadas pela data de retirada
    if (historico && num(e.qt_devolvida_calc) > 0)
      add(`D${s(e.dt_retirada_calc).slice(0, 10)}`, { tipo: "Devolução", nr: "", data: dt(e.dt_retirada_calc) }, e, num(e.qt_devolvida_calc));
  }
  return [...ev.values()].sort((a, b) => s(a.data).localeCompare(s(b.data)) || a.tipo.localeCompare(b.tipo)).map((r, i) => ({
    "Seq. remessa": i + 1,
    "Tipo de remessa": r.tipo,
    "Nº remessa": r.nr,
    "Data da remessa": s(r.data).slice(0, 10),
    "Qtd. itens na remessa": r.itens.length,
    "Qtd. total": r.itens.reduce((t, x) => t + x.qtd, 0),
    "Equipamentos (produto · patrimônio · qtd · vl. unit.)": cell(r.itens.map(({ e, qtd }) =>
      `${prod(e)} · ${pat(e) || "sem patrimônio"} · ${qtd} · ${brl(e.vl_uni_locacao)}`).join(" | ")),
    "Patrimônios": cell(r.itens.map(({ e }) => pat(e)).filter(Boolean).join(", ")),
    [VALOR]: r.itens.reduce((t, { e, qtd }) => t + qtd * num(e.vl_uni_locacao), 0),
  }));
}

export async function exportMigracao(sourceId, empresa, onMsg, filtro = "posse") {
  onMsg("Buscando fichas abertas...");
  const todas = await fetchContratos(sourceId, empresa, (n) => onMsg(`${n} fichas...`), "fichas");
  onMsg("Buscando itens...");
  const allIds = todas.map((f) => Number(f.cd_controle)).filter(Number.isInteger);
  const itens = await fetchByFichas(sourceId, empresa, allIds, (n) => onMsg(`${n} itens...`), "raw_itens");
  const remessas = await fetchByFichas(sourceId, empresa, allIds, (n) => onMsg(`${n} remessas...`), "raw_remessas");
  // Classificação pelas movimentações: só conta remessa efetivada (com saída); posse = remetido − devolvido.
  const remById = new Map(remessas.map((r) => [r.cd_flremessa, r]));
  const mov = itens.filter((e) => dt(remById.get(e.cd_flremessa)?.dt_saida))
    .map((e) => ({ cd_controle: remById.get(e.cd_flremessa).cd_controle, qt_remessa: e.qt_remessa, qt_devolvida: e.qt_devolvida_calc }));
  const fichas = aplicarFiltro(filtro, todas, mov).fichas;
  const ids = fichas.map((f) => Number(f.cd_controle));
  const historico = filtro !== "posse";
  if (!ids.length) return { fichas: 0, linhas: 0, total: todas.length };
  const faturas = await fetchByFichas(sourceId, empresa, ids, (n) => onMsg(`${n} movimentações...`), "renovacoes");
  const pessoas = await fetchByFichas(sourceId, empresa, ids, (n) => onMsg(`${n} clientes...`), "raw_pessoas");
  onMsg("Lendo correção cadastral...");
  const cad = await loadCadastro(sourceId);

  const pes = new Map(pessoas.map((p) => [String(p.cd_pessoa), p]));
  const remCtrl = new Map(remessas.map((r) => [r.cd_flremessa, r]));
  const group = (list, keyFn) => list.reduce((m, x) => { const k = keyFn(x); if (k != null) (m.get(k) || m.set(k, []).get(k)).push(x); return m; }, new Map());
  const itensBy = group(itens, (e) => remCtrl.get(e.cd_flremessa)?.cd_controle);
  const fatBy = group(faturas, (f) => f.cd_controle);

  const linhas = fichas.flatMap((f) => {
    const its = itensBy.get(f.cd_controle) || [];
    const fts = (fatBy.get(f.cd_controle) || []).sort((a, b) => s(a.dt_inicio).localeCompare(s(b.dt_inicio)));
    const normais = fts.filter((x) => s(x.fatura_complementar) !== "S");
    const compl = fts.filter((x) => s(x.fatura_complementar) === "S");
    // Mapa por patrimônio dentro da ficha: remessas efetivadas (com saída) − devoluções registradas
    const saldoPat = new Map();
    for (const e of its) {
      const p = pat(e);
      if (!p || !dt(remCtrl.get(e.cd_flremessa)?.dt_saida)) continue;
      saldoPat.set(p, (saldoPat.get(p) || 0) + num(e.qt_remessa) - num(e.qt_devolvida_calc));
    }
    const patPosse = [...saldoPat].filter(([, q]) => q > 0).map(([p]) => p);
    const semPat = its.filter((e) => !pat(e) && dt(remCtrl.get(e.cd_flremessa)?.dt_saida) && num(e.qt_remessa) - num(e.qt_devolvida_calc) > 0);
    const emPosse = { length: patPosse.length + semPat.length };
    const base = {
      [EMP]: getEmpresaLabel(f.cd_empresa),
      ...clienteCols(pes.get(String(f.cd_pessoa)), cad.get(String(f.cd_pessoa))),
      ...contratoCols(f),
      "Data inicial contratada": dt(normais[0]?.dt_inicio) || dt(f.dt_fai_ficha),
      "Data final contratada (último período)": dt(normais.at(-1)?.dt_fim) || dt(f.dt_faf_ficha),
      "Qtd. períodos faturados": normais.length,
      "Qtd. renovações": Math.max(0, normais.length - 1),
      "Períodos / renovações (início→fim: valor)": cell(normais.map((x, i) => `${i === 0 ? "Inicial" : `Ren.${i}`} ${dt(x.dt_inicio)}→${dt(x.dt_fim)}: ${brl(x.vl_fatura)}`).join(" | ")),
      "Vl. períodos faturados": normais.reduce((t, x) => t + num(x.vl_fatura), 0),
      "Qtd. faturas complementares": compl.length,
      "Faturas complementares (data: valor)": cell(compl.map((x) => `${dt(x.dt_geracao)}: ${brl(x.vl_fatura)}`).join(" | ")),
      "Vl. faturas complementares": compl.reduce((t, x) => t + num(x.vl_fatura), 0),
      "Qtd. itens na ficha": its.length,
      "Qtd. itens em posse": emPosse.length,
      "Patrimônios em posse": cell(patPosse.join(", ")),
    };
    const posseSet = new Set(patPosse);
    const itensPosse = its.filter((e) => dt(remCtrl.get(e.cd_flremessa)?.dt_saida)
      && (historico || (num(e.qt_remessa) - num(e.qt_devolvida_calc) > 0 && (!pat(e) || posseSet.has(pat(e))))));
    const rems = remessaRows(itensPosse, remCtrl, historico);
    return rems.length ? rems.map((r) => ({ ...base, ...r })) : [base];
  }).sort((a, b) => a[EMP].localeCompare(b[EMP]) || a[CLI].localeCompare(b[CLI])
    || s(a["Nº ficha"]).localeCompare(s(b["Nº ficha"])) || num(a["Seq. remessa"]) - num(b["Seq. remessa"]));

  if (!linhas.length) return { fichas: 0, linhas: 0, total: todas.length };
  // Datas no padrão BR (DD/MM/AAAA), inclusive dentro de textos compostos
  const br = (v) => typeof v === "string"
    ? v.replace(/(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g, "$3/$2/$1") : v;
  for (const l of linhas) for (const k in l) l[k] = br(l[k]);
  const wb = XLSX.utils.book_new();
  const add = (name, data) => {
    const header = [...new Set(data.flatMap((r) => Object.keys(r)))];
    const ws = XLSX.utils.json_to_sheet(data, { header });
    // Destaque: nome da empresa/cliente e valor da remessa
    const hl = [EMP, CLI, VALOR].map((h) => header.indexOf(h)).filter((i) => i >= 0);
    for (let r = 0; r <= data.length; r++) for (const c of hl) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) continue;
      ws[ref].s = { font: { bold: true, color: { rgb: "4C1D95" } }, fill: { fgColor: { rgb: r ? "EDE9FE" : "C4B5FD" } } };
    }
    header.forEach((h, c) => {
      if (!isMoeda(h)) return;
      for (let r = 1; r <= data.length; r++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (ws[ref] && ws[ref].t === "n") ws[ref].z = MOEDA_FMT;
      }
    });
    if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
    ws["!cols"] = header.map((h) => ({ wch: Math.min(Math.max(h.length + 2, 14), 60) }));
    XLSX.utils.book_append_sheet(wb, ws, name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  };
  add("Todas as fichas", linhas);
  for (const [emp, rows] of group(linhas, (l) => l[EMP])) add(emp, rows);
  XLSX.writeFile(wb, `migracao_fichas_abertas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return { fichas: fichas.length, linhas: linhas.length, total: todas.length };
}