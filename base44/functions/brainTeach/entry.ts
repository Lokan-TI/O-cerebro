import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { saveLesson } from '../../shared/brainMemory.ts';

// Ensina o Cérebro: o gestor corrige o entendimento e a orientação passa a valer nas próximas respostas.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Restrito a administradores.' }, { status: 403 });

    const body = await req.json();
    const question = String(body?.question || '').trim();
    const correction = String(body?.correction || '').trim();
    if (!correction) return Response.json({ error: 'Correção vazia.' }, { status: 400 });

    await saveLesson(base44, {
      question: question || correction.slice(0, 120),
      correction,
      sql: String(body?.sql || ''),
      kind: question ? 'correction' : 'rule',
      source_id: String(body?.source_id || ''),
      weight: 3,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as any)?.message || String(error) }, { status: 500 });
  }
});