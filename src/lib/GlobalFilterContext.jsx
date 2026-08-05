import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useErpSource } from "./ErpSourceContext";
import { useEmpresaFilter } from "./EmpresaFilterContext";

// Filtro GLOBAL unificado: Fonte → Empresa → Período. Persiste entre todas as abas.
// - Fonte e Empresa aplicam imediatamente (comportamento atual, preserva UX).
// - Período usa draft + "Aplicar filtros" (evita reprocessar a cada mudança).
// A dimensão Filial não é exposta separadamente: no Sisloc a própria empresa já é a
// unidade operacional (matriz + filiais = cd_empresa distintos), então Empresa = Filial.
const GlobalFilterContext = createContext(null);
const STORAGE_KEY = "erp_global_filter_period";

export const PERIOD_PRESETS = [
  { id: "ano_atual", label: "Ano atual" },
  { id: "ultimos_12", label: "Últimos 12 meses" },
  { id: "ano_anterior", label: "Ano anterior" },
  { id: "personalizado", label: "Período personalizado" },
];

function isoDate(d) { return d.toISOString().slice(0, 10); }

function presetRange(preset, customStart, customEnd) {
  const now = new Date();
  const y = now.getFullYear();
  if (preset === "ano_atual") return { start: `${y}-01-01`, end: `${y + 1}-01-01` };
  if (preset === "ano_anterior") return { start: `${y - 1}-01-01`, end: `${y}-01-01` };
  if (preset === "ultimos_12") {
    const start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start: isoDate(start), end: isoDate(end) };
  }
  return { start: customStart || `${y}-01-01`, end: customEnd || `${y + 1}-01-01` };
}

export function GlobalFilterProvider({ children }) {
  const { selectedSource, selectSource, sources } = useErpSource();
  const { selectedEmpresa, setSelectedEmpresa, empresaList } = useEmpresaFilter();

  const [periodPreset, setPeriodPreset] = useState("ano_atual");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedPeriod, setAppliedPeriod] = useState(null);

  // Hidratar do localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.preset) setPeriodPreset(p.preset);
        if (p?.customStart) setCustomStart(p.customStart);
        if (p?.customEnd) setCustomEnd(p.customEnd);
        if (p?.applied) setAppliedPeriod(p.applied);
      }
    } catch {}
  }, []);

  // Persistir
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset: periodPreset, customStart, customEnd, applied: appliedPeriod }));
  }, [periodPreset, customStart, customEnd, appliedPeriod]);

  const draftRange = useMemo(() => presetRange(periodPreset, customStart, customEnd), [periodPreset, customStart, customEnd]);

  const applyFilters = useCallback(() => {
    setAppliedPeriod({ start: draftRange.start, end: draftRange.end, preset: periodPreset });
  }, [draftRange, periodPreset]);

  // Período aplicado (fallback ao draft se nunca aplicado)
  const period = appliedPeriod || { start: draftRange.start, end: draftRange.end, preset: periodPreset };

  // Fonte/Empresa aplicam imediatamente (trocar fonte reseta empresa — cascata)
  const setSource = useCallback((id) => {
    selectSource(id);
    setSelectedEmpresa(null);
  }, [selectSource, setSelectedEmpresa]);
  const setEmpresa = useCallback((id) => setSelectedEmpresa(id == null || id === "" ? null : Number(id)), [setSelectedEmpresa]);

  const hasPendingPeriod = !appliedPeriod ||
    appliedPeriod.start !== draftRange.start ||
    appliedPeriod.end !== draftRange.end ||
    appliedPeriod.preset !== periodPreset;

  return (
    <GlobalFilterContext.Provider value={{
      // Fonte (imediato)
      sourceId: selectedSource?.id || null,
      sourceName: selectedSource?.name || null,
      sources,
      setSource,
      // Empresa (imediato)
      empresaId: selectedEmpresa,
      empresaList,
      setEmpresa,
      // Período (draft + apply)
      periodPreset, setPeriodPreset,
      customStart, setCustomStart,
      customEnd, setCustomEnd,
      period,
      draftRange,
      applyFilters,
      hasPendingPeriod,
    }}>
      {children}
    </GlobalFilterContext.Provider>
  );
}

export function useGlobalFilter() {
  return useContext(GlobalFilterContext);
}