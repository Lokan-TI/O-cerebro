// Contrato temporal único do Cérebro/Sisloc.
// Datas informadas pelo usuário são inclusivas; SQL analítico sempre usa [start, endExclusive).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(value: string, field = 'date') {
  if (!DATE_RE.test(String(value || ''))) throw new Error(`${field} deve estar no formato YYYY-MM-DD.`);
  return value;
}

export function addIsoDays(value: string, days: number) {
  assertIsoDate(value);
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function toExclusiveEnd(endInclusive: string) {
  return addIsoDays(endInclusive, 1);
}

export function toInclusiveEnd(endExclusive: string) {
  return addIsoDays(endExclusive, -1);
}

export function resolvePeriod(input: {
  start?: string | null;
  endInclusive?: string | null;
  endExclusive?: string | null;
  defaultStart: string;
  defaultEndInclusive: string;
}) {
  const start = String(input.start || input.defaultStart);
  const endInclusive = input.endExclusive
    ? toInclusiveEnd(String(input.endExclusive))
    : String(input.endInclusive || input.defaultEndInclusive);
  const endExclusive = input.endExclusive
    ? String(input.endExclusive)
    : toExclusiveEnd(endInclusive);

  assertIsoDate(start, 'period_start');
  assertIsoDate(endInclusive, 'period_end_inclusive');
  assertIsoDate(endExclusive, 'period_end_exclusive');
  if (endExclusive <= start) throw new Error('Período inválido: o fim deve ser posterior ao início.');

  return { start, endInclusive, endExclusive };
}
