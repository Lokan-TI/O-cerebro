// Hierarquia de acesso: admin > gestor > coordenador (somente leitura de dashboards).
export const VIEWER_ROLES = ['admin', 'gestor', 'coordenador'];

export function canView(user: any) {
  return !!user && VIEWER_ROLES.includes(user.role);
}

// Coordenador fica preso à sua empresa; demais papéis usam a empresa pedida.
export function scopedEmpresa(user: any, requested: unknown) {
  if (user?.role === 'coordenador') return user.empresa_scope ?? -1;
  return requested;
}