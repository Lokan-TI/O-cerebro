import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Camada analítica no Google BigQuery (somente leitura).
// Ações: "projects" (lista projetos), "datasets", "tables", "query" (SQL).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'projects';
    const { projectId, datasetId, sql, maxResults } = body;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlebigquery');
    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const base = 'https://bigquery.googleapis.com/bigquery/v2';

    const call = async (url, init) => {
      const res = await fetch(url, init);
      const data = await res.json();
      if (!res.ok) {
        return Response.json({ error: data?.error?.message || 'Erro no BigQuery', details: data }, { status: res.status });
      }
      return data;
    };

    if (action === 'projects') {
      const data = await call(`${base}/projects?maxResults=100`, { headers: authHeaders });
      if (data instanceof Response) return data;
      return Response.json({
        projects: (data.projects || []).map((p) => ({ id: p.id, projectId: p.projectReference?.projectId, name: p.friendlyName })),
      });
    }

    if (!projectId) return Response.json({ error: 'projectId é obrigatório' }, { status: 400 });

    if (action === 'datasets') {
      const data = await call(`${base}/projects/${projectId}/datasets?maxResults=200`, { headers: authHeaders });
      if (data instanceof Response) return data;
      return Response.json({
        datasets: (data.datasets || []).map((d) => ({ datasetId: d.datasetReference?.datasetId, location: d.location })),
      });
    }

    if (action === 'tables') {
      if (!datasetId) return Response.json({ error: 'datasetId é obrigatório' }, { status: 400 });
      const data = await call(`${base}/projects/${projectId}/datasets/${datasetId}/tables?maxResults=500`, { headers: authHeaders });
      if (data instanceof Response) return data;
      return Response.json({
        tables: (data.tables || []).map((t) => ({ tableId: t.tableReference?.tableId, type: t.type })),
      });
    }

    if (action === 'query') {
      if (!sql) return Response.json({ error: 'sql é obrigatório' }, { status: 400 });
      const data = await call(`${base}/projects/${projectId}/queries`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: sql,
          useLegacySql: false,
          maxResults: maxResults || 1000,
          timeoutMs: 30000,
        }),
      });
      if (data instanceof Response) return data;

      const fields = (data.schema?.fields || []).map((f) => f.name);
      const rows = (data.rows || []).map((r) => {
        const obj = {};
        (r.f || []).forEach((cell, i) => { obj[fields[i]] = cell.v; });
        return obj;
      });
      return Response.json({
        fields,
        rows,
        totalRows: Number(data.totalRows || rows.length),
        bytesProcessed: Number(data.totalBytesProcessed || 0),
        jobComplete: data.jobComplete !== false,
      });
    }

    return Response.json({ error: `Ação desconhecida: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}