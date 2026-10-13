import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div>
      <p className="mb-1 text-xs text-gray-500">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-950 p-1 pl-3">
        <code className="flex-1 truncate text-xs text-violet-200">{value}</code>
        <button onClick={copy} className="inline-flex items-center gap-1 rounded-md bg-gray-800 px-2.5 py-1.5 text-xs text-gray-200 hover:bg-gray-700">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}