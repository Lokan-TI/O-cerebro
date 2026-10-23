// Ciclo de vida da ficha de locação (fich_loc) — regra PROVADA na Matriz (desde 2025) e confirmada na tela Sisloc.
//  - 'O' = Orçamento: dt_aprovacao sempre NULL, zero remessas expedidas. Aberto (dt_enc_ficha NULL) ou encerrado/baixado.
//  - 'L' = Locação: Aberta (dt_enc_ficha NULL = contrato ativo) ou Encerrada (dt_enc_ficha preenchida = devolvido).
//  - 'C'/'E' = minoritários, aprovados e expedidos: tratados como locação operacional, SEMANTIC_PENDING.
// Identidade da ficha: cd_controle (+ cd_empresa). fich_loc.numero é por empresa — só exibição.

export const LOCACAO_TIPOS = ['L', 'C', 'E'];
export const SEMANTIC_PENDING_TIPOS = ['C', 'E'];

/** Ficha é orçamento (cotação). */
export const isOrcamento = (a = 'f') => `${a}.tp_ope_pedido = 'O'`;
/** Ficha é locação real (contrato), aprovada. */
export const isLocacao = (a = 'f') => `${a}.tp_ope_pedido IN ('L','C','E') AND ${a}.dt_aprovacao IS NOT NULL`;
/** Contrato ativo = ficha "Aberta" no Sisloc. */
export const isAberta = (a = 'f') => `${a}.tp_ope_pedido IN ('L','C','E') AND ${a}.dt_enc_ficha IS NULL`;
/** Remessa efetivamente expedida (remessa de orçamento tem só quantidade cotada). */
export const isExpedida = (r = 'r') => `${r}.dt_saida IS NOT NULL AND ISNULL(${r}.fl_rem_cancelada,'N') = 'N'`;

/** Estado no vocabulário do Sisloc. */
export function fichaStatus(tp: string, dtEnc: unknown, expedidas = 1) {
  const t = String(tp || '').trim();
  const enc = !!dtEnc;
  if (t === 'O') return { ficha_status: 'Orçamento', ficha_status_detalhe: enc ? 'Orçamento encerrado' : 'Orçamento aberto', semantic_pending: false };
  const pend = SEMANTIC_PENDING_TIPOS.includes(t);
  if (enc) return { ficha_status: 'Encerrada', ficha_status_detalhe: 'Encerrada', semantic_pending: pend };
  return { ficha_status: 'Aberta', ficha_status_detalhe: expedidas > 0 ? 'Aberta' : 'Aberta - aguardando saída', semantic_pending: pend };
}

export const fmtFicha = (n: unknown) => (n == null || n === '' ? '' : String(n).trim().padStart(6, '0'));