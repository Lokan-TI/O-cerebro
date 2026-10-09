export const ROLE_LABELS = { admin: "Admin", gestor: "Gestor", coordenador: "Coordenador", user: "Usuário" };

export const isAdmin = (user) => user?.role === "admin";
export const isCoordenador = (user) => user?.role === "coordenador";