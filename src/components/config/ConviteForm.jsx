import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Send } from "lucide-react";

export default function ConviteForm({ onInvited }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("gestor");
  const [state, setState] = useState({ busy: false, msg: "", ok: false });

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, msg: "", ok: false });
    // A plataforma convida como admin ou user; gestor/coordenador são aplicados ao cadastro em seguida.
    const ok = await base44.users.inviteUser(email, role === "admin" ? "admin" : "user").then(() => true).catch(() => false);
    if (ok && role !== "admin") {
      const found = await base44.entities.User.filter({ email }).catch(() => []);
      if (found?.[0]) await base44.entities.User.update(found[0].id, { role }).catch(() => {});
    }
    setState({ busy: false, ok, msg: ok ? `Convite enviado para ${email}. Confirme o perfil na lista após o aceite.` : "Não foi possível enviar o convite (verifique suas permissões)." });
    if (ok) { setEmail(""); onInvited(); }
  };

  return (
    <form onSubmit={submit} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[220px]">
        <label className="text-xs text-gray-400">E-mail</label>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 px-3 py-2" placeholder="nome@empresa.com.br" />
      </div>
      <div>
        <label className="text-xs text-gray-400">Perfil</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="block mt-1 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 px-3 py-2">
          <option value="admin">Admin</option><option value="gestor">Gestor</option><option value="coordenador">Coordenador</option>
        </select>
      </div>
      <button disabled={state.busy} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-md px-4 py-2">
        {state.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Convidar
      </button>
      {state.msg && <p className={`w-full text-xs ${state.ok ? "text-green-400" : "text-red-400"}`}>{state.msg}</p>}
    </form>
  );
}