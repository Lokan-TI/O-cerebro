import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { MATCH_LABEL, PRODUCT_LABEL } from "@/lib/rdFunnelQuery";

const inp = "bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 min-w-0";

export default function RdFunnelFilters({ value, onChange }) {
  const [opts, setOpts] = useState({ campaign: [], origin: [], stage: [], erp_cd_empresa: [] });
  useEffect(() => {
    Promise.all(Object.keys(opts).map((f) => base44.entities.RdLead.list({ distinct: f }).then((r) => [f, (r.items || []).filter(Boolean).sort()])))
      .then((e) => setOpts(Object.fromEntries(e)));
  }, []);
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const sel = (k, label, list, map) => (
    <select value={value[k] || ""} onChange={set(k)} className={inp} aria-label={label}>
      <option value="">{label}: todos</option>
      {list.map((o) => <option key={o} value={o}>{map ? map[o] : o}</option>)}
    </select>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" value={value.start} onChange={set("start")} className={inp} aria-label="Início" />
      <span className="text-gray-600 text-xs">a</span>
      <input type="date" value={value.end} onChange={set("end")} className={inp} aria-label="Fim" />
      {sel("product", "Fonte", Object.keys(PRODUCT_LABEL), PRODUCT_LABEL)}
      {sel("campaign", "Campanha", opts.campaign)}
      {sel("origin", "Origem", opts.origin)}
      {sel("stage", "Etapa", opts.stage)}
      {sel("empresa", "Empresa ERP", opts.erp_cd_empresa)}
      {sel("match", "Correspondência", Object.keys(MATCH_LABEL), Object.fromEntries(Object.entries(MATCH_LABEL).map(([k, v]) => [k, v[0]])))}
    </div>
  );
}