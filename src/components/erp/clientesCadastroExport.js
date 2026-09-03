// Exporta TODA a base de clientes (tabela pessoa) em CSV compatível com Excel,
// com o relacionamento e todos os dados cadastrais, somando as métricas do
// snapshot (faturamento, locações, financeiro) quando o cliente tiver movimento.
import { base44 } from "@/api/base44Client";
import { fmtDoc } from "@/lib/erpFormat";

const CADASTRO_COLS = [
  ["cd_pessoa", "Código"],
  ["relacionamento", "Relacionamento"],
  ["nm_pessoa", "Razão Social / Nome"],
  ["nm_fan_pessoa", "Nome Fantasia"],
  ["fl_tipo_pessoa", "Tipo de Pessoa"],
  ["nr_cnpj_pessoa", "CNPJ"],
  ["nr_cpf_pessoa", "CPF"],
  ["nr_ident_pessoa", "RG / Identidade"],
  ["nr_ies_pessoa", "Inscrição Estadual"],
  ["uf_ies_pessoa", "UF da Inscrição"],
  ["dt_ani_pessoa", "Data de Nascimento / Fundação"],
  ["dt_cad_pessoa", "Data de Cadastro"],
  ["dt_ult_atividade", "Última Atividade (cadastro)"],
  ["fl_ativo", "Ativo"],
  ["log_pessoa", "Logradouro"],
  ["num_pessoa", "Número"],
  ["comple_pessoa", "Complemento"],
  ["bairro_pessoa", "Bairro"],
  ["cidade_pessoa", "Cidade"],
  ["uf_pessoa", "UF"],
  ["cep_pessoa", "CEP"],
  ["referen_pessoa", "Referência"],
  ["log_cob_pessoa", "Logradouro (cobrança)"],
  ["num_cob_pessoa", "Número (cobrança)"],
  ["comple_cob_pessoa", "Complemento (cobrança)"],
  ["bairro_cob_pessoa", "Bairro (cobrança)"],
  ["cidade_cob_pessoa", "Cidade (cobrança)"],
  ["uf_cob_pessoa", "UF (cobrança)"],
  ["cep_cob_pessoa", "CEP (cobrança)"],
  ["tel_pessoa", "Telefone"],
  ["tl_cel_pessoa", "Celular"],
  ["tl_res_pessoa", "Telefone Residencial"],
  ["fax_pessoa", "Fax"],
  ["en_mail_pessoa", "E-mail"],
  ["en_site_pessoa", "Site"],
  ["nm_pai", "Nome do Pai"],
  ["nm_mae", "Nome da Mãe"],
  ["nm_empresa", "Empresa onde trabalha"],
  ["nm_agrupamento", "Agrupamento"],
  ["cd_gruven", "Grupo de Vendas"],
  ["cd_atividade", "Atividade"],
  ["fl_optante_simples", "Optante Simples"],
  ["fl_contribuinte_icms", "Contribuinte ICMS"],
  ["vl_lim_venda", "Limite de Venda (R$)"],
  ["obs_pessoa", "Observações"],
];

const METRIC_COLS = [
  ["empresa_nome", "Empresa (movimento)"],
  ["status", "Status"],
  ["qtd_fichas", "Fichas de locação"],
  ["fichas_abertas", "Fichas abertas"],
  ["primeira_ficha", "Primeira locação"],
  ["ultima_ficha", "Última locação"],
  ["qtd_nf", "Notas fiscais"],
  ["faturamento", "Faturamento (R$)"],
  ["ticket_medio", "Ticket médio (R$)"],
  ["primeira_nf", "Primeira NF"],
  ["ultima_nf", "Última NF"],
  ["car_total", "CAR total (R$)"],
  ["car_aberto", "CAR em aberto (R$)"],
  ["car_vencido", "CAR vencido (R$)"],
  ["recencia_dias", "Recência (dias)"],
];

const TEXT_COLS = new Set(["cd_pessoa", "num_pessoa", "num_cob_pessoa", "cep_pessoa", "cep_cob_pessoa", "nr_ies_pessoa", "nr_ident_pessoa"]);
const DOC_COLS = new Set(["nr_cnpj_pessoa", "nr_cpf_pessoa"]);
const asExcelText = (v) => (v ? `="${v}"` : "");

const PAGE_SIZE = 250;

// Busca uma página; o wrapper DW_API às vezes derruba a consulta (500/timeout),
// então tentamos novamente algumas vezes antes de desistir da exportação.
async function fetchPage(sourceId, after, attempt = 1) {
  try {
    const res = await base44.functions.invoke("listClientesCadastro", {
      source_id: sourceId,
      after,
      limit: PAGE_SIZE,
    });
    const data = res?.data;
    if (!data?.success) throw new Error(data?.error || "Falha ao carregar o cadastro de clientes.");
    return data;
  } catch (e) {
    if (attempt >= 4) {
      throw new Error(
        "O banco do ERP não respondeu durante a exportação (a consulta foi tentada 4 vezes). Tente novamente em alguns minutos."
      );
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
    return fetchPage(sourceId, after, attempt + 1);
  }
}

// Percorre a base em páginas (keyset por cd_pessoa) até esgotar os registros.
export async function fetchAllClientesCadastro(sourceId, onProgress) {
  const all = [];
  let after = 0;
  for (let page = 0; page < 400; page++) {
    const data = await fetchPage(sourceId, after);
    all.push(...(data.rows || []));
    onProgress?.(all.length);
    if (!data.next_cursor) break;
    after = data.next_cursor;
  }
  return all;
}

export function exportClientesCadastroCsv(cadastro, metricsByCd = {}) {
  if (!cadastro?.length) return;

  const esc = (v) => {
    if (v === true) return "Sim";
    if (v === false) return "Não";
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(v).replace(".", ",");
    const s = String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const cell = (key, value) => {
    if (DOC_COLS.has(key)) return esc(asExcelText(fmtDoc(value)));
    if (TEXT_COLS.has(key)) return esc(asExcelText(String(value ?? "").trim()));
    return esc(value);
  };

  const header = [...CADASTRO_COLS, ...METRIC_COLS].map(([, label]) => label).join(";");
  const lines = cadastro.map((r) => {
    const m = metricsByCd[String(r.cd_pessoa)] || {};
    return [
      ...CADASTRO_COLS.map(([key]) => cell(key, r[key])),
      ...METRIC_COLS.map(([key]) => esc(m[key])),
    ].join(";");
  });

  const csv = "\uFEFF" + [header, ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clientes_base_completa.csv";
  a.click();
  URL.revokeObjectURL(url);
}