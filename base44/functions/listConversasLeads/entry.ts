import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Leitura do RD Station Conversas (Tallos) — relatório de atendimentos agregado por contato,
// com classificação de estágio do lead. Somente leitura.
//
// Sinais disponíveis na API (v4/reports):
//   - customer (nome, telefone, canal, tags)
//   - to_tabulation: orcamentos | contrato_fechado | desmobilizacao | novos_produtos | spam | curriculo | financeiro
//   - initiation_info.initiated_by: customer | system
//   - total_send_messages / total_receive_messages, employee, datas
// O conteúdo das mensagens (v2/messages/history) exige chave de criptografia (plano Advanced)
// e não está disponível — por isso a classificação usa tabulação + comportamento.

const BASE = 'https://api.tallos.com.br';
const PAGE_LIMIT = 50;
const WINDOW_DAYS = 90; // limite da API

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function windows(months: number) {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - months);
  const out: { start: string; end: string }[] = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const stop = new Date(cursor);
    stop.setDate(stop.getDate() + WINDOW_DAYS - 1);
    out.push({ start: iso(cursor), end: iso(stop > end ? end : stop) });
    cursor = new Date(stop);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function classify(l: any, now: number) {
  const days = l.last_contact_at ? Math.floor((now - new Date(l.last_contact_at).getTime()) / 86400000) : null;
  if (l.tabulations.includes('desmobilizacao')) {
    return { stage: 'POS_LOCACAO', label: 'Pós-locação | Já alugou e devolveu equipamento' };
  }
  if (l.tabulations.includes('orcamentos') && !l.tabulations.includes('contrato_fechado')) {
    if (days == null || days > 15) {
      return { stage: 'RECUPERACAO', label: 'Recuperação | Pediu orçamento e sumiu' };
    }
    return { stage: 'ORCAMENTO_ATIVO', label: 'Orçamento em andamento' };
  }
  if (l.tabulations.includes('contrato_fechado')) {
    return { stage: 'CLIENTE_ATIVO', label: 'Contrato fechado' };
  }
  if (l.tabulations.includes('spam') || l.tabulations.includes('curriculo')) {
    return { stage: 'DESCARTADO', label: 'Fora do funil (spam/currículo)' };
  }
  // Interagiu com atendente ou trocou mensagens → demonstrou interesse
  if (l.attended || l.total_receive_messages >= 2 || l.tabulations.includes('novos_produtos')) {
    return { stage: 'INTERESSE', label: 'Visitou produtos ou clicou no CTA / Entrou em contato' };
  }
  return { stage: 'BOAS_VINDAS', label: 'Recebeu boas-vindas, não pediu orçamento' };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Consulta a integrações restrita a administradores.' }, { status: 403 });
    }

    const token = Deno.env.get('RDSTATION_CONVERSAS_TOKEN');
    if (!token) return Response.json({ error: 'Credencial RDSTATION_CONVERSAS_TOKEN não configurada.' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const months = Math.min(Math.max(Number(body?.months) || 12, 1), 24);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const leads: Record<string, any> = {};
    let attendances = 0;
    const started = Date.now();
    const wins = windows(months);

    for (const w of wins) {
      let page = 1;
      let pages = 1;
      do {
        const url = `${BASE}/v4/reports?start_date=${w.start}&end_date=${w.end}&limit=${PAGE_LIMIT}&page=${page}`;
        const res = await fetch(url, { headers });
        if (!res.ok) {
          if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500)); continue; }
          const txt = await res.text();
          return Response.json({ error: `Falha no RD Conversas (${res.status}): ${txt.slice(0, 300)}` }, { status: 502 });
        }
        const j = await res.json();
        pages = Number(j?.pages) || 1;
        const docs = j?.docs || [];
        for (const d of docs) {
          attendances++;
          const c = d.customer || {};
          const key = c.id || c.cel_phone || `sem-id-${attendances}`;
          if (!leads[key]) {
            leads[key] = {
              contact_id: c.id || '',
              nome: c.full_name || '',
              telefone: c.cel_phone || '',
              canal: c.channel || d.channel || '',
              tags: (c.tags || []).map((t: any) => (typeof t === 'string' ? t : t?.name)).filter(Boolean),
              atendimentos: 0,
              total_send_messages: 0,
              total_receive_messages: 0,
              tabulations: [] as string[],
              departamentos: [] as string[],
              atendentes: [] as string[],
              attended: false,
              iniciado_pelo_lead: false,
              first_contact_at: d.started_at || d.created_at || '',
              last_contact_at: d.started_at || d.created_at || '',
            };
          }
          const l = leads[key];
          l.atendimentos++;
          l.total_send_messages += Number(d.total_send_messages) || 0;
          l.total_receive_messages += Number(d.total_receive_messages) || 0;
          if (d.to_tabulation && !l.tabulations.includes(d.to_tabulation)) l.tabulations.push(d.to_tabulation);
          if (d.to_department && !l.departamentos.includes(d.to_department)) l.departamentos.push(d.to_department);
          if (d.employee?.name) {
            l.attended = true;
            if (!l.atendentes.includes(d.employee.name)) l.atendentes.push(d.employee.name);
          }
          if (d.initiation_info?.initiated_by === 'customer') l.iniciado_pelo_lead = true;
          const ts = d.started_at || d.created_at || '';
          if (ts) {
            if (!l.first_contact_at || ts < l.first_contact_at) l.first_contact_at = ts;
            if (!l.last_contact_at || ts > l.last_contact_at) l.last_contact_at = ts;
          }
        }
        page++;
      } while (page <= pages);
    }

    const now = Date.now();
    const rows = Object.values(leads).map((l: any) => {
      const { stage, label } = classify(l, now);
      const dias = l.last_contact_at
        ? Math.floor((now - new Date(l.last_contact_at).getTime()) / 86400000)
        : null;
      return { ...l, stage, stage_label: label, dias_sem_contato: dias };
    });

    const byStage: Record<string, number> = {};
    for (const r of rows) byStage[r.stage] = (byStage[r.stage] || 0) + 1;

    return Response.json({
      months,
      windows: wins,
      attendances,
      leads: rows.sort((a, b) => String(b.last_contact_at).localeCompare(String(a.last_contact_at))),
      by_stage: byStage,
      duration_ms: Date.now() - started,
      note: 'Classificação baseada em tabulação do atendimento e comportamento. O conteúdo das mensagens não é acessível pela API (exige chave de criptografia do plano Advanced).',
    });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}