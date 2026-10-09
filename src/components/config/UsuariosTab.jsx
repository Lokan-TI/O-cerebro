import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ROLE_LABELS } from "@/lib/access";
import ConviteForm from "./ConviteForm";

const ROLES = ["admin", "gestor", "coordenador"];

export default function UsuariosTab() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    base44.entities.User.list()
      .then((u) => { setUsers(u); setError(""); })
      .catch(() => { setUsers([]); setError("Apenas administradores podem consultar e editar usuários."); });

  useEffect(() => { load(); }, []);

  const update = async (id, data) => {
    setError("");
    await base44.entities.User.update(id, data).catch(() => setError("Sem permissão para editar este usuário."));
    load();
  };

  return (
    <div className="space-y-5">
      <ConviteForm onInvited={load} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="text-sm">
          <thead><tr><th className="text-left text-gray-300">Nome</th><th className="text-left text-gray-300">E-mail</th><th className="text-left text-gray-300">Perfil</th><th className="text-left text-gray-300">Empresa (coordenador)</th></tr></thead>
          <tbody>
            {users === null && <tr><td colSpan={4} className="text-gray-500">Carregando…</td></tr>}
            {users?.map((u) => (
              <tr key={u.id}>
                <td className="text-gray-200">{u.full_name || "—"}</td>
                <td className="text-gray-400">{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => update(u.id, { role: e.target.value })} className="bg-gray-800 border border-gray-700 rounded-md text-gray-200 px-2 py-1">
                    {[...new Set([...ROLES, u.role])].map((r) => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                  </select>
                </td>
                <td>
                  {u.role === "coordenador" ? (
                    <input type="number" defaultValue={u.empresa_scope ?? ""} onBlur={(e) => update(u.id, { empresa_scope: e.target.value === "" ? null : Number(e.target.value) })} className="w-24 bg-gray-800 border border-gray-700 rounded-md text-gray-200 px-2 py-1" />
                  ) : <span className="text-gray-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}