import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { canView } from '../../shared/access.ts';
import { empresaScope, sourceFor, personFor, historyScope } from '../../shared/customerScope.ts';
import { searchCustomers } from '../../shared/customerSearch.ts';
import { groupMembers, groupCompare } from '../../shared/customerGroup.ts';
import { customerErpSummary, customerErpTimeline } from '../../shared/customerErpHistory.ts';
import { customerRdSummary, customerRdTimeline } from '../../shared/customerRdHistory.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Autenticação necessária.' }, { status: 401 });
    if (!canView(user)) return Response.json({ success: false, error: 'Acesso restrito aos perfis autorizados aos painéis.' }, { status: 403 });
    const body = await req.json();
    if (!['search', 'profile', 'timeline', 'group', 'group_compare'].includes(body.action)) return Response.json({ success: false, error: 'Ação inválida.' }, { status: 400 });
    const empresa = empresaScope(user, body.cd_empresa);
    if (body.action === 'search') return Response.json(await searchCustomers(base44, body, empresa));
    const source = await sourceFor(base44, body.source_id);
    if (body.action === 'group') return Response.json({ success: true, ...(await groupMembers(source, body.name, empresa)) });
    if (body.action === 'group_compare') {
      const scope = historyScope(source, empresa);
      return Response.json({ success: true, as_of: scope.as_of, ...(await groupCompare(base44, user, source, body.name, empresa, scope.end_exclusive)) });
    }
    const person = await personFor(source, body.client_id, empresa);
    const scope = historyScope(source, empresa);
    if (body.action === 'profile') {
      const erp = await customerErpSummary(source, person, scope);
      let rd;
      try { rd = await customerRdSummary(base44, user, source, person, scope); }
      catch (error) { rd = { available: false, note: 'Não foi possível validar/consultar os dados RD: ' + String(error.message).slice(0, 200) }; }
      return Response.json({ success: true, person, scope, ...erp, rd });
    }
    if (!['erp', 'crm', 'conversas'].includes(body.category)) return Response.json({ success: false, error: 'Fonte de histórico inválida.' }, { status: 400 });
    return Response.json(body.category === 'erp'
      ? await customerErpTimeline(source, person, scope, body)
      : await customerRdTimeline(base44, user, source, person, scope, body));
  } catch (error) {
    return Response.json({ success: false, error: String(error.message || error).slice(0, 400) }, { status: 500 });
  }
}