import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { execRead } from '../../shared/erpConnection.ts';
import { invoiceUniverse } from '../../shared/invoiceUniverse.ts';
import { normDoc, normEmail, normPhone } from '../../shared/rdSync.ts';

// Resolução de identidade RD → ERP (pessoa) e receita faturada (nf, universo fiscal padrão do app).
// Prioridade: documento > e-mail > telefone. Mais de um candidato = ambíguo (nunca associa sozinho).
// Ações: step (processa pendentes) · rematch (reabre automáticos) · search (busca pessoa) · manual (decisão humana).
const DIG = (c: string) => `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(CAST(${c} AS varchar(255)),''),'.',''),'-',''),'/',''),'(',''),')',''),' ','')`;
const q = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
const rs = (r: any) => (Array.isArray(r?.recordset) ? r.recordset : []);

// Índice de identidade de todas as pessoas com algum contato (leitura única, normalizado em JS).
async function loadIndex(source: Record<string, unknown>) {
  const idx = new Map<string, Map<string, string>>();
  const add = (k: string, cd: string, nm: string) => { if (!idx.has(k)) idx.set(k, new Map()); idx.get(k)!.set(cd, nm); };
  const sql = `SELECT cd_pessoa, LTRIM(RTRIM(nm_pessoa)) AS nm, CAST(en_mail_pessoa AS varchar(255)) AS em, nr_cnpj_pessoa AS cnpj, nr_cpf_pessoa AS cpf,
    CAST(tel_pessoa AS varchar(60)) AS t1, CAST(tl_cel_pessoa AS varchar(60)) AS t2 FROM pessoa WITH (NOLOCK)`;
  for (const p of rs(await execRead(source, sql, 150000))) {
    const cd = String(p.cd_pessoa); const nm = p.nm || '';
    String(p.em || '').split(/[;,\s]+/).map(normEmail).filter(Boolean).forEach((e) => add('email:' + e, cd, nm));
    [normDoc(p.cnpj), normDoc(p.cpf)].filter(Boolean).forEach((d) => add('doc:' + d, cd, nm));
    [normPhone(p.t1), normPhone(p.t2)].filter(Boolean).forEach((t) => add('tel:' + t, cd, nm));
  }
  return idx;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Restrito a administradores.' }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const db = base44.asServiceRole.entities;
    let source: Record<string, unknown> = { credential_reference: 'env' };
    if (b.source_id) source = await db.ErpDataSource.get(b.source_id);

    if (b.action === 'search') {
      const term = String(b.term || '').trim().slice(0, 60);
      if (term.length < 3) return Response.json({ rows: [] });
      const d = term.replace(/\D/g, '');
      const where = d.length >= 6 ? `${DIG('nr_cnpj_pessoa')} = ${q(d)} OR ${DIG('nr_cpf_pessoa')} = ${q(d)} OR CAST(cd_pessoa AS varchar(20)) = ${q(d)}`
        : `nm_pessoa LIKE ${q('%' + term.replace(/[%_\[]/g, '') + '%')} OR nm_fan_pessoa LIKE ${q('%' + term.replace(/[%_\[]/g, '') + '%')}`;
      const rows = rs(await execRead(source, `SELECT TOP 20 cd_pessoa, LTRIM(RTRIM(nm_pessoa)) AS nm_pessoa, LTRIM(RTRIM(CAST(ISNULL(nr_cnpj_pessoa, nr_cpf_pessoa) AS varchar(30)))) AS doc FROM pessoa WITH (NOLOCK) WHERE ${where}`, 60000));
      return Response.json({ rows });
    }

    if (b.action === 'manual') {
      const key = String(b.identity_key || '');
      if (!/^(doc|email|tel):.+/.test(key)) return Response.json({ error: 'Identidade inválida.' }, { status: 400 });
      const decision = b.decision === 'no_match' ? 'no_match' : 'link';
      const prev = await db.RdManualMatch.filter({ identity_key: key });
      const data = { identity_key: key, decision, erp_cd_pessoa: decision === 'link' ? String(b.erp_cd_pessoa || '') : '',
        erp_nm_pessoa: b.erp_nm_pessoa || '', note: b.note || '', decided_by: user.email };
      if (prev[0]) await db.RdManualMatch.update(prev[0].id, data); else await db.RdManualMatch.create(data);
      const [kind, val] = [key.split(':')[0], key.slice(key.indexOf(':') + 1)];
      const field = kind === 'doc' ? 'identity_doc' : kind === 'email' ? 'identity_email' : 'identity_phone';
      await db.RdLead.updateMany({ [field]: val, match_status: { $ne: 'pending' } }, { $set: { match_status: 'pending' } });
    }

    if (b.action === 'rematch') {
      for (let i = 0; i < 200; i++) {
        const r = await db.RdLead.updateMany({ match_status: { $in: ['matched', 'ambiguous', 'unmatched', 'no_identity', 'manual', 'rejected'] } }, { $set: { match_status: 'pending' } });
        if (!r?.has_more) break;
      }
    }

    const manual = await db.RdManualMatch.list('-created_date', 5000);
    const manualMap = new Map(manual.map((m: any) => [m.identity_key, m]));
    const started = Date.now();
    let processed = 0;
    let done = false;
    let idx: Map<string, Map<string, string>> | null = null;
    while (Date.now() - started < 40000) {
      const page = await db.RdLead.filter({ match_status: 'pending' }, { limit: 300, fields: ['identity_email', 'identity_phone', 'identity_doc', 'source_created_at', 'email', 'phone', 'document'] });
      const leads = page.items || [];
      if (!leads.length) { done = true; break; }
      leads.forEach((l: any) => {
        l.identity_email ||= normEmail(l.email); l.identity_phone ||= normPhone(l.phone); l.identity_doc ||= normDoc(l.document);
      });
      if (!idx) idx = await loadIndex(source);
      const updates = leads.map((l: any) => {
        const keys = [l.identity_doc && 'doc:' + l.identity_doc, l.identity_email && 'email:' + l.identity_email, l.identity_phone && 'tel:' + l.identity_phone].filter(Boolean) as string[];
        const base = { id: l.id, identity_email: l.identity_email, identity_phone: l.identity_phone, identity_doc: l.identity_doc, matched_at: new Date().toISOString(),
          erp_cd_pessoa: '', erp_nm_pessoa: '', erp_cd_empresa: '', erp_receita_total: 0, erp_receita_pos_lead: 0, erp_primeira_nf: '', erp_candidates: '' };
        if (!keys.length) return { ...base, match_status: 'no_identity', match_method: '' };
        const m = keys.map((k) => manualMap.get(k)).find(Boolean) as any;
        if (m) return m.decision === 'no_match' ? { ...base, match_status: 'rejected', match_method: 'manual' }
          : { ...base, match_status: 'manual', match_method: 'manual', erp_cd_pessoa: m.erp_cd_pessoa, erp_nm_pessoa: m.erp_nm_pessoa };
        for (const k of keys) {
          const c = idx!.get(k);
          if (!c?.size) continue;
          if (c.size === 1) { const [cd, nm] = [...c.entries()][0]; return { ...base, match_status: 'matched', match_method: k.split(':')[0], erp_cd_pessoa: cd, erp_nm_pessoa: nm }; }
          return { ...base, match_status: 'ambiguous', match_method: k.split(':')[0], erp_candidates: [...c.entries()].slice(0, 10).map(([cd, nm]) => `${cd} - ${nm}`).join(' | ') };
        }
        return { ...base, match_status: 'unmatched', match_method: '' };
      });
      const cds = [...new Set(updates.map((u: any) => u.erp_cd_pessoa).filter((x: string) => /^\d+$/.test(x)))];
      if (cds.length) {
        const rev = rs(await execRead(source, `SELECT n.cd_pessoa, n.cd_empresa, CONVERT(char(7), n.dt_emi_nf, 120) AS ym, SUM(n.vl_faturamento) AS v, MIN(n.dt_emi_nf) AS first_nf
          FROM nf n WITH (NOLOCK) WHERE n.cd_pessoa IN (${cds.join(',')}) AND ${invoiceUniverse('n')} GROUP BY n.cd_pessoa, n.cd_empresa, CONVERT(char(7), n.dt_emi_nf, 120)`, 120000));
        const by = new Map<string, any[]>();
        rev.forEach((r: any) => { const k = String(r.cd_pessoa); if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); });
        const created = new Map(leads.map((l: any) => [l.id, String(l.source_created_at || '').slice(0, 7)]));
        updates.forEach((u: any) => {
          const rows = by.get(u.erp_cd_pessoa) || [];
          if (!rows.length) return;
          const ym = created.get(u.id) || '';
          const perEmp: Record<string, number> = {};
          let first = '';
          rows.forEach((r: any) => {
            const v = Number(r.v) || 0;
            u.erp_receita_total += v;
            if (!ym || r.ym >= ym) u.erp_receita_pos_lead += v;
            perEmp[r.cd_empresa] = (perEmp[r.cd_empresa] || 0) + v;
            const f = new Date(r.first_nf).toISOString().slice(0, 10);
            if (!first || f < first) first = f;
          });
          u.erp_primeira_nf = first;
          u.erp_cd_empresa = String(Object.entries(perEmp).sort((a, b) => b[1] - a[1])[0][0]);
        });
      }
      for (let i = 0; i < updates.length; i += 300) await db.RdLead.bulkUpdate(updates.slice(i, i + 300));
      processed += updates.length;
    }
    const pending = await db.RdLead.count({ match_status: 'pending' });
    return Response.json({ processed, pending, done: done || pending === 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}