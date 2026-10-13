import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Configuração editável das conexões RD (nome, credencial salva, removida).
export function useRdConnections() {
  const [connections, setConnections] = useState([]);
  const [envSecrets, setEnvSecrets] = useState([]);
  const reload = useCallback(async () => {
    const r = await base44.functions.invoke("rdApiConnection", { action: "list" });
    setConnections(r.data?.connections || []);
    setEnvSecrets(r.data?.env_secrets || []);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const byProduct = (p) => connections.find((c) => c.product === p);
  return { connections, byProduct, reload, envSecrets };
}