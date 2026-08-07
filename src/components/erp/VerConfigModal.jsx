import { X } from "lucide-react";
import SourceStatusBadge from "@/components/erp/SourceStatusBadge";

function Field({ label, value }) {
  return (
    <div>
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-gray-200 text-sm break-all">{value || "—"}</p>
    </div>
  );
}

export default function VerConfigModal({ source, onClose }) {
  if (!source) return null;

  const fromEnv = source.credential_reference === "env";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-bold text-lg">Configuração — {source.name}</h2>
            <SourceStatusBadge status={source.status || "disconnected"} />
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-3">Identificação</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Nome" value={source.name} />
              <Field label="Unidade" value={source.branch_name} />
              <Field label="Código da unidade" value={source.branch_code} />
              <Field label="Ambiente" value={source.environment} />
              <Field label="Ativa" value={source.is_active === false ? "Não" : "Sim"} />
              <Field label="Responsável técnico" value={source.tech_contact} />
            </div>
            {source.description && <p className="text-gray-400 text-sm mt-3">{source.description}</p>}
          </section>

          <section>
            <h3 className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-3">Conexão</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Tipo de banco" value={source.database_type || "sqlserver"} />
              <Field label="Host" value={fromEnv ? "Definido via ambiente" : source.host} />
              <Field label="Porta" value={fromEnv ? "Definido via ambiente" : source.port} />
              <Field label="Banco de dados" value={fromEnv ? "Definido via ambiente" : source.database_name} />
              <Field label="Instância" value={source.instance_name} />
              <Field label="Schema padrão" value={source.default_schema} />
              <Field label="Usuário" value={fromEnv ? "Definido via ambiente" : source.username} />
              <Field label="Senha" value="••••••••" />
              <Field label="Origem das credenciais" value={fromEnv ? "Variáveis de ambiente" : "Configuração própria"} />
              <Field label="Autenticação" value={source.auth_type === "windows" ? "Windows" : "SQL"} />
              <Field label="SSL" value={source.use_ssl ? "Sim" : "Não"} />
              <Field label="Somente leitura" value={source.is_read_only === false ? "Não" : "Sim"} />
            </div>
            {source.extra_params && (
              <div className="mt-3"><Field label="Parâmetros adicionais" value={source.extra_params} /></div>
            )}
          </section>

          <section>
            <h3 className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-3">Sincronização</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Modo" value={source.sync_mode === "automatic" ? "Automática" : "Manual"} />
              <Field label="Periodicidade" value={source.sync_periodicity} />
              <Field label="Timeout (s)" value={source.connection_timeout} />
              <Field label="Limite de registros" value={source.row_limit?.toLocaleString("pt-BR")} />
              <Field label="Data inicial de importação" value={source.import_start_date} />
              <Field label="Registros importados" value={source.records_count?.toLocaleString("pt-BR")} />
            </div>
          </section>

          {source.notes && (
            <section>
              <h3 className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">Observações</h3>
              <p className="text-gray-400 text-sm whitespace-pre-wrap">{source.notes}</p>
            </section>
          )}

          <p className="text-gray-600 text-xs">
            A senha nunca é exibida — as credenciais são processadas exclusivamente pelo back-end.
          </p>
        </div>
      </div>
    </div>
  );
}