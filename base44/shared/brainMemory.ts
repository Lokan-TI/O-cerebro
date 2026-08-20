// Memória de aprendizado contínuo do Cérebro: consultas validadas e correções ensinadas pelo usuário.

export async function loadLessons(base44: any): Promise<string> {
  try {
    const rows = await base44.asServiceRole.entities.BrainLesson.filter(
      { is_active: true },
      '-created_date',
      60,
    );
    if (!rows || rows.length === 0) return '';
    const corrections = rows.filter((r: any) => r.kind !== 'success').slice(0, 25);
    const successes = rows.filter((r: any) => r.kind === 'success').slice(0, 20);
    let out = '';
    if (corrections.length) {
      out += 'REGRAS E CORREÇÕES ENSINADAS PELO GESTOR (têm prioridade máxima):\n';
      for (const c of corrections) {
        out += `- Sobre "${String(c.question).slice(0, 140)}": ${String(c.correction || '').slice(0, 400)}\n`;
      }
    }
    if (successes.length) {
      out += '\nCONSULTAS JÁ VALIDADAS (reutilize o padrão quando a pergunta for parecida):\n';
      for (const s of successes) {
        if (!s.sql) continue;
        out += `- P: ${String(s.question).slice(0, 120)}\n  SQL: ${String(s.sql).slice(0, 600)}\n`;
      }
    }
    return out.slice(0, 14000);
  } catch {
    return '';
  }
}

export async function saveLesson(base44: any, data: Record<string, unknown>) {
  try {
    await base44.asServiceRole.entities.BrainLesson.create({ is_active: true, ...data });
  } catch (e) {
    console.error('Falha ao salvar aprendizado do Cérebro:', (e as any)?.message || e);
  }
}

// Evita duplicar aprendizado da mesma pergunta.
export async function hasLesson(base44: any, question: string): Promise<boolean> {
  try {
    const rows = await base44.asServiceRole.entities.BrainLesson.filter(
      { question, kind: 'success' },
      '-created_date',
      1,
    );
    return (rows || []).length > 0;
  } catch {
    return false;
  }
}