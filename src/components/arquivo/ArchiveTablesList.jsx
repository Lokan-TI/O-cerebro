import { STATUS_LABEL } from "@/lib/sislocArchive";

const TONE = {
  validated: "text-emerald-400", divergent: "text-amber-400", error: "text-red-400",
  done: "text-sky-400", extracting: "text-violet-400", pending: "text-gray-500",
};

export default function ArchiveTablesList({ tables }) {
  return (
    <div className="max-h-[560px] overflow-auto rounded-xl border border-gray-800">
      <table className="text-sm">
        <thead><tr>
          <th className="text-left">Tabela</th><th className="text-right">Colunas</th><th className="text-left">Chave</th>
          <th className="text-right">Linhas Sisloc</th><th className="text-right">Migradas</th>
          <th className="text-right">Contagem validação</th><th className="text-left">Status</th>
        </tr></thead>
        <tbody>
          {tables.map((t) => (
            <tr key={t.id}>
              <td className="font-mono text-gray-200">{t.table_name}</td>
              <td className="text-right text-gray-400">{t.columns?.length || 0}</td>
              <td className="text-gray-400">{t.primary_key?.length ? t.primary_key.join(", ") : <span className="text-amber-400">sem PK</span>}</td>
              <td className="text-right">{(t.source_row_count || 0).toLocaleString("pt-BR")}</td>
              <td className="text-right">{(t.migrated_row_count || 0).toLocaleString("pt-BR")}</td>
              <td className="text-right text-gray-400">{t.validated_source_count != null ? t.validated_source_count.toLocaleString("pt-BR") : "—"}</td>
              <td className={TONE[t.status]} title={t.last_error || ""}>{STATUS_LABEL[t.status]}{t.last_error ? " ⚠" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}