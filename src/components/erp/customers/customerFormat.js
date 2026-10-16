export const customerDate = (value) => {
  if (!value) return 'Não registrada';
  const d = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : 'Data indisponível';
};
export const customerMoney = (value) => value == null ? 'Indisponível' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const daysSince = (value, asOf) => {
  if (!value) return null;
  const a = new Date(String(value).slice(0, 10) + 'T00:00:00Z'), b = new Date(asOf + 'T00:00:00Z');
  return Number.isFinite(a.getTime()) ? Math.floor((b - a) / 86400000) : null;
};