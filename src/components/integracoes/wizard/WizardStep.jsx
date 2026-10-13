import { Check } from "lucide-react";

// Uma etapa numerada do assistente.
export default function WizardStep({ n, title, done, children }) {
  return (
    <div className="relative pl-12 pb-8 last:pb-0">
      <span className="absolute left-[15px] top-8 bottom-0 w-px bg-gray-800" />
      <span className={`absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full text-xs font-semibold transition-colors ${done ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40" : "bg-gray-900 text-gray-300 ring-1 ring-gray-700"}`}>
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <p className="pt-1.5 text-sm font-semibold text-white">{title}</p>
      <div className="mt-3 space-y-3 text-sm text-gray-400">{children}</div>
    </div>
  );
}