import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const inp = "bg-gray-950 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white [color-scheme:dark]";

function validate(f) {
  if (!f.a1 || !f.a2 || !f.b1 || !f.b2) return "Preencha as quatro datas.";
  if (f.a1 > f.a2 || f.b1 > f.b2) return "Em cada período, a data inicial deve ser anterior à final.";
  if (f.a2 >= f.b1) return "O Período A deve terminar antes do início do Período B.";
  return null;
}

export default function QuedaPeriodForm({ loading, onRun }) {
  const y = new Date().getFullYear();
  const [f, setF] = useState({ a1: `${y - 1}-01-01`, a2: `${y - 1}-06-30`, b1: `${y}-01-01`, b2: `${y}-06-30` });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = () => {
    const e = validate(f);
    setErr(e);
    if (!e) onRun({ p1: { start: f.a1, end: f.a2 }, p2: { start: f.b1, end: f.b2 } });
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-4">
        {[["Período A (base)", "a1", "a2"], ["Período B (comparado)", "b1", "b2"]].map(([t, s, e]) => (
          <div key={t}>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">{t}</p>
            <div className="flex items-center gap-2">
              <input type="date" className={inp} value={f[s]} onChange={set(s)} />
              <span className="text-gray-500 text-xs">até</span>
              <input type="date" className={inp} value={f[e]} onChange={set(e)} />
            </div>
          </div>
        ))}
        <Button onClick={submit} disabled={loading} className="bg-violet-600 hover:bg-violet-500 text-white">
<span key={loading ? "l" : "p"} className="inline-flex">{loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}</span><span>Comparar</span>
        </Button>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}