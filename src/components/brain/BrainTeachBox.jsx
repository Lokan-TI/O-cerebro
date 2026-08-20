import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { GraduationCap, Check, Loader2 } from "lucide-react";

export default function BrainTeachBox({ question, sql, sourceId }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const send = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      await base44.functions.invoke("brainTeach", {
        question,
        sql: sql || "",
        correction: text.trim(),
        source_id: sourceId || null,
      });
      setSaved(true);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="not-prose flex items-center gap-1.5 mt-2 text-[11px] text-emerald-400">
        <Check className="w-3 h-3" /> Aprendizado registrado — vale nas próximas respostas
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="not-prose flex items-center gap-1.5 mt-2 text-[11px] text-gray-500 hover:text-purple-300 transition-colors"
      >
        <GraduationCap className="w-3 h-3" /> Corrigir / ensinar o Cérebro
      </button>
    );
  }

  return (
    <div className="not-prose mt-2 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Ex: contrato faturado é a ficha com NF emitida no mesmo período, não qualquer NF do cliente."
        className="w-full bg-gray-950 border border-gray-700 focus:border-purple-500 rounded-lg p-2 text-xs text-gray-200 outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={send}
          disabled={saving || !text.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-xs text-white"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <GraduationCap className="w-3 h-3" />} Ensinar
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200">
          Cancelar
        </button>
      </div>
    </div>
  );
}