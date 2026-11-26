import { execRead } from '../../shared/erpConnection.ts';

// Como o produto aparece na lista de reativação, pela classificação de famílias do Cérebro (GrupoFamilia):
//  - andaimes e escoramento: o grupo do Sisloc (a ficha traz dezenas de peças do mesmo kit);
//  - demais famílias: o modelo do equipamento;
//  - seguro, manual e chave só entram quando são os únicos itens da ficha.
const KIT = ['ANDAIMES', 'ESCORAMENTO'];
const ACESSORIAS = ['SERVIÇOS E RECEITAS ACESSÓRIAS'];

/** Produtos por ficha (cd_controle → nomes em ordem alfabética) das fichas que atendem `where` (alias f). */
export async function produtosPorFicha(base44: any, source: Record<string, unknown>, where: string) {
  const grupos = await base44.asServiceRole.entities.GrupoFamilia.filter({});
  const ids = (familias: string[]) => grupos.filter((g: any) => familias.includes(String(g.familia || '').trim()))
    .map((g: any) => Number(g.cd_grupo)).filter(Number.isInteger).join(',') || 'NULL';

  const sql = `SELECT DISTINCT f.cd_controle,
      CASE WHEN q.cd_grupo IN (${ids(KIT)}) THEN g.nm_grupo ELSE q.nm_equipto END AS produto,
      CASE WHEN q.cd_grupo IN (${ids(ACESSORIAS)}) OR q.nm_equipto LIKE 'CHAVE LIGA E DESLIGA%' OR q.nm_equipto LIKE 'MANUAL DE OPERA%' THEN 1 ELSE 0 END AS acessorio
    FROM fich_loc f WITH (NOLOCK)
    JOIN fl_remessa r WITH (NOLOCK) ON r.cd_controle = f.cd_controle
    JOIN fl_rem_equ e WITH (NOLOCK) ON e.cd_flremessa = r.cd_flremessa
    JOIN equipto q WITH (NOLOCK) ON q.cd_equipto = e.cd_equipto
    LEFT JOIN grupo g WITH (NOLOCK) ON g.cd_grupo = q.cd_grupo
    WHERE ${where} AND ISNULL(r.fl_rem_cancelada, 'N') = 'N'`;
  const res: any = await execRead(source, sql, 85000);

  const porFicha = new Map<number, { principais: Set<string>; acessorios: Set<string> }>();
  for (const r of res?.recordset || []) {
    const nome = String(r.produto ?? '').replace(/\s+/g, ' ').trim();
    if (!nome) continue;
    const id = Number(r.cd_controle);
    const p = porFicha.get(id) || porFicha.set(id, { principais: new Set(), acessorios: new Set() }).get(id)!;
    (Number(r.acessorio) ? p.acessorios : p.principais).add(nome);
  }
  const out = new Map<number, string[]>();
  for (const [id, p] of porFicha) {
    out.set(id, [...(p.principais.size ? p.principais : p.acessorios)].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  }
  return out;
}