// Amostra dirigida de 30 clientes (F6) para validação humana no Sisloc:
// 10 churn V4 com v3/rolling ativo, 10 retidos, 10 novos ou reativados.
const iso = (v: any) => { if (!v) return null; try { return new Date(v).toISOString().slice(0, 10); } catch { return null; } };
const minD = (a: any[]) => a.filter(Boolean).sort()[0] || null;
const maxD = (a: any[]) => a.filter(Boolean).sort().slice(-1)[0] || null;

export function buildDirected30(normalized: any[], episodeRows: any[], fichas: any[], periodStart: string, months: number) {
  const eps = new Map<string, any[]>();
  for (const e of episodeRows) { const k = String(e.cd_pessoa); (eps.get(k) || eps.set(k, []).get(k)!).push(e); }
  const reactivated = new Set(episodeRows.filter((e) => Number(e.is_churn_event) === 1 && e.next_episode_start).map((e) => String(e.cd_pessoa)));
  const used = new Set<string>();
  const pick = (cat: string, pred: (r: any) => boolean, fallback?: (r: any) => boolean) => {
    const out: any[] = [];
    for (const p of [pred, fallback].filter(Boolean) as any[]) {
      for (const r of normalized) {
        if (out.length >= 10) break;
        if (used.has(r.cd_pessoa) || !p(r)) continue;
        used.add(r.cd_pessoa); out.push({ cat, r });
      }
    }
    return out;
  };
  const picked = [
    ...pick('DIRECTED30_CHURNED_V4_ATIVO_V3', (r) => r.v4_status === 'CHURN_CONFIRMADO' && r.v3_family !== 'churn', (r) => r.v4_status === 'CHURN_CONFIRMADO'),
    ...pick('DIRECTED30_RETAINED', (r) => r.v4_family === 'active' || r.v4_family === 'retained'),
    ...pick('DIRECTED30_NOVO_OU_REATIVADO', (r) => (r.first_activation_date && r.first_activation_date >= periodStart) || reactivated.has(r.cd_pessoa)),
  ];
  return picked.map(({ cat, r }) => {
    const fs = fichas.filter((f) => String(f.cd_pessoa) === r.cd_pessoa);
    const ep = (eps.get(r.cd_pessoa) || []).map((e) => ({
      episode_id: Number(e.episode_id) || 0, inicio: iso(e.episode_start), fim: iso(e.episode_end),
      churn_date: Number(e.is_churn_event) === 1 ? iso(e.candidate_churn_date) : null, proximo_episodio: iso(e.next_episode_start),
    }));
    const lastChurn = ep.filter((e) => e.churn_date).slice(-1)[0];
    const motivo = r.v4_status === 'CHURN_CONFIRMADO' || lastChurn
      ? `Gap > ${months} meses após fim do episódio ${lastChurn?.fim || r.relationship_end_date || '?'} (churn em ${lastChurn?.churn_date || r.churn_date || '?'})${lastChurn?.proximo_episodio ? `; reativado em ${lastChurn.proximo_episodio}` : ''}`
      : `Sem churn: ${r.v4_status}`;
    const dates = {
      primeira_remessa: minD(fs.map((f) => iso(f.first_remessa))), ultima_remessa: maxD(fs.map((f) => iso(f.last_remessa))),
      primeiro_faturamento: minD(fs.map((f) => iso(f.first_valid_nf))), ultimo_faturamento: maxD(fs.map((f) => iso(f.last_valid_nf))),
    };
    return { cat, r, ep, motivo, dates, fichas_count: fs.length };
  });
}