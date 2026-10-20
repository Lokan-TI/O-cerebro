import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { onlyDigits } from "@/lib/erpFormat";
import { validCnpj } from "@/components/erp/fornecedores/emailAudit";
import { merge, recOf } from "@/components/erp/fornecedores/useSupplierCache";
import { fetchAllClientesCadastro } from "@/components/erp/clientesCadastroExport";

const E = () => base44.entities.ClienteCadastroCache;
const s = (v) => String(v ?? "").trim();

const toErp = (p) => ({
  cd_pessoa: String(p.cd_pessoa), nm_pessoa: s(p.nm_pessoa), nm_fan_pessoa: s(p.nm_fan_pessoa),
  cnpj: onlyDigits(p.nr_cnpj_pessoa || ""), inscricao_estadual: s(p.nr_ies_pessoa), email: s(p.en_mail_pessoa),
  telefone: s(p.tel_pessoa || p.tl_cel_pessoa), logradouro: s(p.log_pessoa), numero: s(p.num_pessoa),
  complemento: s(p.comple_pessoa), bairro: s(p.bairro_pessoa), cidade: s(p.cidade_pessoa), uf: s(p.uf_pessoa),
  cep: onlyDigits(p.cep_pessoa || ""), codigo_ibge: "",
});

// Clientes com CNPJ de todas as fontes selecionadas, guardados no Cérebro (o Sisloc nunca é alterado).
export default function useClienteCache(sourceIds) {
  const key = sourceIds.join(",");
  const [rows, setRows] = useState(null);
  const [state, setState] = useState("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);

  const loadCache = useCallback(async () => {
    if (!key) return;
    setState("loading");
    setError(null);
    const out = [];
    let cursor;
    try {
      do {
        const page = await E().filter({ source_key: { $in: key.split(",") } }, { limit: 1000, cursor });
        out.push(...page.items);
        cursor = page.has_more ? page.next_cursor : null;
      } while (cursor);
      setRows(out.length ? out.map(merge) : null);
    } catch (e) {
      setError(e?.message || "Falha ao ler o cache");
    } finally {
      setState("idle");
    }
  }, [key]);

  useEffect(() => { loadCache(); }, [loadCache]);

  const syncFromErp = async () => {
    setState("syncing");
    setError(null);
    try {
      const now = new Date().toISOString();
      for (const id of key.split(",")) {
        const all = await fetchAllClientesCadastro(id, (n) => setProgress(`Lendo clientes do Sisloc… ${n}`));
        const list = all.map(toErp).filter((c) => validCnpj(c.cnpj));
        for (let i = 0; i < list.length; i += 500) {
          setProgress(`Salvando no Cérebro ${Math.min(i + 500, list.length)}/${list.length}…`);
          await E().upsert(list.slice(i, i + 500).map((c) => ({ source_key: id, cd_pessoa: c.cd_pessoa, erp: c, synced_at: now })), { key: ["source_key", "cd_pessoa"] });
        }
      }
    } catch (e) {
      setError(e?.message || "Falha ao carregar clientes");
    }
    setProgress("");
    await loadCache();
  };

  const saveCorrections = async (row, corrections) => {
    await E().update(row._id, { corrections });
    setRows((rs) => rs.map((r) => (r._id === row._id ? merge({ ...recOf(r), corrections }) : r)));
  };

  const savePublic = async (items) => {
    const now = new Date().toISOString();
    const upd = items.map(({ row, res }) => ({
      id: row._id, public_status: res.status, public_error: res.error || "",
      public_data: res.status === "ok" ? res : row._pub || {}, public_at: now,
    }));
    for (let i = 0; i < upd.length; i += 500) await E().bulkUpdate(upd.slice(i, i + 500));
    const byId = Object.fromEntries(upd.map((u) => [u.id, u]));
    setRows((rs) => rs.map((r) => (byId[r._id] ? merge({ ...recOf(r), ...byId[r._id] }) : r)));
  };

  return { rows, state, progress, error, syncFromErp, saveCorrections, savePublic };
}