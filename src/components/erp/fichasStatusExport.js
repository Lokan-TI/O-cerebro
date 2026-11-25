// Exporta as fichas de locação (uma linha por ficha) em CSV compatível com Excel, com os contatos.
import { esc, asText, brDate, downloadCsv } from "@/components/erp/clientesAtivosExport";
import { FICHA_STATUS } from "@/components/erp/FichaStatusFilter";
import { fmtFicha } from "@/components/erp/padrao/padraoApi";

export const fichaStatusLabel = (status) => FICHA_STATUS.find((s) => s.id === `fichas_${status}`)?.label || status;

const COLS = [
  ["Ficha", (f) => asText(fmtFicha(f.numero))],
  ["Status", (f) => fichaStatusLabel(f.status)],
  ["Data do pedido", (f) => brDate(f.dt_pedido)],
  ["Validade", (f) => brDate(f.dt_validade)],
  ["Encerramento", (f) => brDate(f.dt_enc_ficha)],
  ["Código", (f) => asText(f.cd_pessoa)],
  ["Cliente", (f) => f.nm_pessoa],
  ["Empresa Sisloc", (f) => f.nm_empresa],
  ["Código Empresa", (f) => asText(f.cd_empresa)],
  ["Contato da ficha", (f) => f.contato],
  ["Telefone da ficha", (f) => asText(f.telefone)],
  ["E-mail da ficha", (f) => f.email_contato],
  ["E-mail (cadastro)", (f) => f.email],
  ["Telefone (cadastro)", (f) => asText(f.tel_cadastro)],
  ["Celular (cadastro)", (f) => asText(f.cel_cadastro)],
];

export function exportFichasStatus(fichas) {
  const lines = fichas.map((f) => COLS.map(([, value]) => esc(value(f))).join(";"));
  downloadCsv([COLS.map(([label]) => label).join(";"), ...lines].join("\r\n"), "fichas_locacao.csv");
}