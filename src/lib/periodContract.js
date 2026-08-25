// Contrato único de período do Cérebro.
// UX: datas informadas/exibidas são inclusivas (ex.: 01/01/2026 até 25/08/2026).
// SQL/API analítica: sempre intervalo meio-aberto [start, endExclusive),
// portanto o mesmo exemplo vira >= 2026-01-01 AND < 2026-08-26.

export const PERIOD_CONTRACT_VERSION = 2;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function addIsoDays(value, days) {
  if (!DATE_RE.test(String(value || ""))) return value || "";
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

export function toExclusiveEnd(endInclusive) {
  return addIsoDays(endInclusive, 1);
}

export function toInclusiveEnd(endExclusive) {
  return addIsoDays(endExclusive, -1);
}

export function buildCanonicalPeriod(start, endInclusive, preset) {
  return {
    start,
    end: endInclusive,
    endInclusive,
    endExclusive: toExclusiveEnd(endInclusive),
    ...(preset ? { preset } : {}),
  };
}
