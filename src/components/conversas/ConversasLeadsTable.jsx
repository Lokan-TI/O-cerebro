export default function ConversasLeadsTable({ rows }) {
  if (!rows.length) {
    return <p className="text-sm text-gray-500 py-8 text-center">Nenhum lead neste estágio.</p>;
  }
  return (
    <div className="overflow-auto max-h-[600px] border border-gray-800 rounded-xl">
      <table className="w-full text-xs">
        <thead className="bg-gray-900 sticky top-0">
          <tr className="text-gray-400">
            <th className="text-left p-2">Lead</th>
            <th className="text-left p-2">Telefone</th>
            <th className="text-left p-2">Canal</th>
            <th className="text-left p-2">Estágio</th>
            <th className="text-right p-2">Atend.</th>
            <th className="text-right p-2">Msgs recebidas</th>
            <th className="text-left p-2">Tabulações</th>
            <th className="text-left p-2">Último contato</th>
            <th className="text-right p-2">Dias sem contato</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.contact_id || i} className="border-t border-gray-800 text-gray-300">
              <td className="p-2 text-white">{r.nome || "—"}</td>
              <td className="p-2">{r.telefone || "—"}</td>
              <td className="p-2">{r.canal}</td>
              <td className="p-2">{r.stage_label}</td>
              <td className="p-2 text-right">{r.atendimentos}</td>
              <td className="p-2 text-right">{r.total_receive_messages}</td>
              <td className="p-2">{(r.tabulations || []).join(", ") || "—"}</td>
              <td className="p-2">{r.last_contact_at ? new Date(r.last_contact_at).toLocaleDateString("pt-BR") : "—"}</td>
              <td className="p-2 text-right">{r.dias_sem_contato ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}