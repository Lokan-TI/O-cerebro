import { useState } from "react";

const inp = "bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 px-2 py-1.5";
const tab = (on) => `px-3 py-1.5 text-xs rounded-md transition-colors ${on ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`;

export default function RfmPeriodPicker({ mode, custom, onGlobal, onApply }) {
  const [s, setS] = useState(custom.start);
  const [e, setE] = useState(custom.end);
  const valid = s && e && s <= e;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex bg-gray-800/60 border border-gray-700 rounded-lg p-0.5">
        <button className={tab(mode === "global")} onClick={onGlobal}>Período global</button>
        <button className={tab(mode === "custom")} onClick={() => valid && onApply({ start: s, end: e })}>Personalizado</button>
      </div>
      <input type="date" value={s} onChange={(x) => setS(x.target.value)} className={inp} />
      <span className="text-xs text-gray-500">até</span>
      <input type="date" value={e} onChange={(x) => setE(x.target.value)} className={inp} />
      <button disabled={!valid} onClick={() => onApply({ start: s, end: e })}
        className="text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-md px-3 py-1.5">Aplicar</button>
    </div>
  );
}