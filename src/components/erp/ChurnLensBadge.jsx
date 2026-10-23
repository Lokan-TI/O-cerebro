import { Info } from "lucide-react";
import { CHURN_LENSES } from "@/lib/churnLenses";

// Rótulo + definição da ótica de churn (tooltip nativo e texto visível).
export default function ChurnLensBadge({ lens }) {
  const l = CHURN_LENSES[lens];
  if (!l) return null;
  return (
    <div title={l.definition} className="flex items-start gap-1.5 text-[11px] text-gray-400 mt-2">
      <Info className="w-3.5 h-3.5 mt-px shrink-0 text-violet-400" />
      <span><span className="font-semibold text-violet-300">{l.tag}:</span> {l.definition}</span>
    </div>
  );
}