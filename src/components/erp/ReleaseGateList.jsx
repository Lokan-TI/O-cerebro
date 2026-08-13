import { CheckCircle2, XCircle } from "lucide-react";

export default function ReleaseGateList({ gates = [] }) {
  return (
    <div className="space-y-2">
      {gates.map((g) => (
        <div key={g.id} className={`flex items-start gap-3 p-3 rounded-lg border ${g.passed ? "bg-emerald-950/30 border-emerald-900" : "bg-red-950/30 border-red-900"}`}>
          {g.passed
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
          <div>
            <p className="text-sm text-gray-100">{g.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{g.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}