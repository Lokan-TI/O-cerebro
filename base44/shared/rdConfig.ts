// Ajustes editáveis das conexões RD (nome, observações, credencial substituta, removida).
let OVERRIDES: Record<string, any> = {};

export async function loadRdOverrides(base44: any) {
  const rows = await base44.asServiceRole.entities.RdApiConnection.list('-updated_date', 20).catch(() => []);
  OVERRIDES = {};
  for (const r of rows || []) if (!OVERRIDES[r.product]) OVERRIDES[r.product] = r;
  return OVERRIDES;
}

export const rdOverride = (product: string) => OVERRIDES[product] || null;

// Credencial: a substituta salva na conexão vence o segredo de ambiente.
export function rdToken(product: string, envName: string): string | undefined {
  const t = OVERRIDES[product]?.token;
  return (t || Deno.env.get(envName) || '').trim() || undefined;
}

export function assertActive(product: string) {
  if (OVERRIDES[product]?.removed) throw new Error('Conexão removida. Restaure-a para voltar a usar.');
}