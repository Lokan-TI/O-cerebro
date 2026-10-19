import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const EDIT_FIELDS = [
  ["nm_pessoa", "Razão social"], ["nm_fan_pessoa", "Nome fantasia"], ["cnpj", "CNPJ"], ["cpf", "CPF"],
  ["inscricao_estadual", "Inscrição estadual"], ["email", "E-mail"], ["telefone", "Telefone"],
  ["logradouro", "Logradouro"], ["numero", "Número"], ["complemento", "Complemento"],
  ["bairro", "Bairro"], ["cidade", "Cidade"], ["uf", "UF"], ["cep", "CEP"],
];

export default function SupplierEditDialog({ row, onClose, onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (row) setForm(Object.fromEntries(EDIT_FIELDS.map(([k]) => [k, row[k] ?? ""])));
    setError(null);
  }, [row]);

  const save = async () => {
    // Só guarda como correção o que difere do dado original do ERP.
    const corrections = Object.fromEntries(
      Object.entries(form).filter(([k, v]) => String(v ?? "") !== String(row._erp[k] ?? ""))
    );
    setSaving(true);
    try {
      await onSave(row, corrections);
      onClose();
    } catch (e) {
      setError(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Corrigir fornecedor · código {row?.cd_pessoa}</DialogTitle></DialogHeader>
        <p className="text-xs text-gray-500">As correções ficam salvas no Cérebro e entram no Excel. O Sisloc não é alterado.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EDIT_FIELDS.map(([k, label]) => {
            const changed = row && String(form[k] ?? "") !== String(row._erp[k] ?? "");
            return (
              <label key={k} className="text-xs text-gray-400 space-y-1">
                <span className="flex justify-between">{label}{changed && <span className="text-amber-400">corrigido</span>}</span>
                <input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className={`w-full px-2.5 py-1.5 bg-gray-900 border rounded-md text-sm text-white focus:outline-none focus:border-purple-500 ${changed ? "border-amber-600/70" : "border-gray-800"}`} />
                {changed && <span className="block text-[11px] text-gray-600">ERP: {row._erp[k] || "(vazio)"}</span>}
              </label>
            );
          })}
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm font-medium">
            {saving ? "Salvando…" : "Salvar correções"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}