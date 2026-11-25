// Exporta as listas de clientes ativos em CSV compatível com Excel (BOM + ponto e vírgula):
// todas as colunas da tabela + os contatos de cada cliente, buscados no Sisloc na hora da exportação.
import { base44 } from "@/api/base44Client";
import { tendenciaLabel, cicloLabel } from "@/components/erp/padrao/PadraoBadges";

const CHUNK = 500;
const text = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const brDate = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
const decimal = (v) => Number(v || 0).toFixed(2).replace(".", ",");
// Códigos e telefones vão como texto para o Excel não remover zeros nem converter em número.
const asText = (v) => (text(v) ? `="${text(v).replace(/"/g, '""')}"` : "");

// [título, valor(linha, padrão de locação do cliente, contatos do cliente)]
const COLS = [
  ["Código", (r) => asText(r.cd_pessoa)],
  ["Cliente", (r) => r.nm_pessoa],
  ["Empresa Sisloc", (r) => r.nm_empresa],
  ["Código Empresa", (r) => asText(r.cd_empresa)],
  ["Receita (R$)", (r) => decimal(r.receita)],
  ["% da receita", (r) => decimal(r.share)],
  ["NFs", (r) => r.nfs],
  ["Última NF", (r) => brDate(r.ultima_nf)],
  ["Contratos ativos", (r) => r.contratos_ativos],
  ["Contratos (histórico)", (r) => r.contratos_total],
  ["Fichas/mês (média)", (r, p) => p?.media_fichas_mes],
  ["Equip. no cliente", (r, p) => p?.equipamentos_no_cliente],
  ["Última ficha", (r, p) => brDate(p?.ultima_ficha)],
  ["Dias desde a última ficha", (r, p) => p?.dias_desde_ultima],
  ["Tendência", (r, p) => tendenciaLabel(p?.tendencia)],
  ["Ciclo", (r, p) => cicloLabel(p?.ciclo_status)],
  ["Fichas — Aberta", (r) => r.fichas_aberta],
  ["Fichas — Orçamento", (r) => r.fichas_orcamento],
  ["Fichas — Orç. Vencido", (r) => r.fichas_orc_vencido],
  ["Fichas — Lembrete", (r) => r.fichas_lembrete],
  ["Fichas — Suspensa", (r) => r.fichas_suspensa],
  ["Fichas — Encerrada", (r) => r.fichas_encerrada],
  ["E-mail", (r, p, c) => c?.email],
  ["Telefone", (r, p, c) => asText(c?.telefone)],
  ["Celular", (r, p, c) => asText(c?.celular)],
  ["Contato últ. orçamento", (r, p, c) => c?.orc_contato],
  ["Tel. últ. orçamento", (r, p, c) => asText(c?.orc_telefone)],
  ["Contato últ. locação", (r, p, c) => c?.loc_contato],
  ["Tel. últ. locação", (r, p, c) => asText(c?.loc_telefone)],
];

const esc = (v) => {
  if (typeof v === "number") return String(v).replace(".", ",");
  let s = text(v);
  // Texto livre do ERP iniciado por = + - @ seria lido pelo Excel como fórmula.
  if (/^[=+\-@]/.test(s) && !s.startsWith('="') && !/^-[\d,]+$/.test(s)) s = asText(s);
  return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Contatos do cadastro (e-mail, telefone, celular) e da última ficha de orçamento e de locação,
// em blocos de 500 clientes para não estourar o tempo do ERP.
async function fetchContatos(ids, sourceId, onProgress) {
  const hoje = new Date().toISOString().slice(0, 10);
  const contatos = {};
  for (let i = 0; i < ids.length; i += CHUNK) {
    onProgress?.(i, ids.length);
    const payload = { ids: ids.slice(i, i + CHUNK), orc_start: "2000-01-01", orc_end: hoje, loc_start: "2000-01-01", loc_end: hoje };
    if (sourceId) payload.source_id = sourceId;
    const res = await base44.functions.invoke("listRfmContatos", payload);
    if (res.data?.success === false) throw new Error(res.data.error);
    Object.assign(contatos, res.data?.contatos);
  }
  return contatos;
}

function buildCsv(clients, padrao, contatos) {
  const lines = clients.map((r) => {
    const k = String(r.cd_pessoa);
    return COLS.map(([, value]) => esc(value(r, padrao?.get(k), contatos[k]))).join(";");
  });
  return "\uFEFF" + [COLS.map(([label]) => label).join(";"), ...lines].join("\r\n");
}

export async function exportClientesAtivos(clients, padrao, sourceId, onProgress) {
  const ids = [...new Set(clients.map((r) => String(r.cd_pessoa)))];
  const contatos = await fetchContatos(ids, sourceId, onProgress);
  const blob = new Blob([buildCsv(clients, padrao, contatos)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clientes_ativos.csv";
  a.click();
  URL.revokeObjectURL(url);
}