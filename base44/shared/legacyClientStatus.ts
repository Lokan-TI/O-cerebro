// Motor legado de status de cliente (9 estados por remessa realizada) — extraído para
// uso compartilhado entre classifyClientStatus (telas atuais) e reconcileLifecycle
// (reconciliação por cliente do doc 10, passo 2). Nenhuma regra foi alterada.
import { approvedRemessaFrom } from './churnUniverse.ts';
import { empFilter } from './empresaScope.ts';

export const CLIENT_STATUSES = [
  'Novo ativo', 'Recorrente', 'Reativado', 'Em risco', 'Em churn',
  'Dormente', 'Churn confirmado', 'Prospector', 'Novo cadastro',
];

export function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

// Cortes derivados das janelas de análise (A) e referência (R).
export function deriveLegacyContext(aStart: string, aEnd: string, rStart: string) {
  const shiftM = (base: string, m: number) => { const d = new Date(base); d.setMonth(d.getMonth() + m); return isoDate(d); };
  const shiftY = (base: string, y: number) => { const d = new Date(base); d.setFullYear(d.getFullYear() + y); return isoDate(d); };
  return {
    aStart, aEnd, rStart,
    riskCutoff: shiftM(aStart, -3),
    dormantStart: shiftM(aEnd, -24),
    novoCadastroCutoff: shiftM(aEnd, -3),
    fichaLower: shiftY(aEnd, -3),
    remessaLower: shiftY(aEnd, -5),
  };
}

export function buildLegacyRemessaSql(ctx: ReturnType<typeof deriveLegacyContext>) {
  return `SELECT f.cd_pessoa,
    MIN(r.dt_saida) AS first_remessa,
    MAX(r.dt_saida) AS last_remessa,
    SUM(CASE WHEN r.dt_saida >= '${ctx.aStart}' AND r.dt_saida < '${ctx.aEnd}' THEN 1 ELSE 0 END) AS cnt_a,
    SUM(CASE WHEN r.dt_saida >= '${ctx.rStart}' AND r.dt_saida < '${ctx.aStart}' THEN 1 ELSE 0 END) AS cnt_r
    ${approvedRemessaFrom}
      AND r.dt_saida >= '${ctx.remessaLower}'
    GROUP BY f.cd_pessoa`;
}

export function buildLegacyFichaSql(ctx: ReturnType<typeof deriveLegacyContext>) {
  return `SELECT cd_pessoa, MIN(dt_pedido) AS min_ficha
    FROM fich_loc WITH (NOLOCK)
    WHERE cd_pessoa IS NOT NULL AND cd_pessoa <> ''
      AND dt_pedido >= '${ctx.fichaLower}'
      ${empFilter()}
    GROUP BY cd_pessoa`;
}

export function classifyLegacy(c: any, ctx: any) {
  const cntA = c.cnt_a || 0;
  const cntR = c.cnt_r || 0;
  const first = c.first_remessa ? new Date(c.first_remessa) : null;
  const last = c.last_remessa ? new Date(c.last_remessa) : null;

  if (c.has_remessa) {
    if (cntA > 0 && first && isoDate(first) >= ctx.aStart) return 'Novo ativo';
    if (cntA > 0 && cntR > 0) return 'Recorrente';
    if (cntA > 0 && cntR === 0) return 'Reativado';
    if (cntA === 0 && cntR > 0 && last && isoDate(last) >= ctx.riskCutoff) return 'Em risco';
    if (cntA === 0 && cntR > 0) return 'Em churn';
    if (cntA === 0 && cntR === 0 && last && isoDate(last) >= ctx.dormantStart) return 'Dormente';
    return 'Churn confirmado';
  }
  if (c.min_ficha && isoDate(new Date(c.min_ficha)) >= ctx.novoCadastroCutoff) return 'Novo cadastro';
  return 'Prospector';
}