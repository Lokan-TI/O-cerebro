import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useErpSource } from "./ErpSourceContext";
import { useEmpresaFilter } from "./EmpresaFilterContext";

// Filtro GLOBAL unificado: Fonte → Empresa → Período. Persiste entre todas as abas.
// - Fonte e Empresa aplicam imediatamente (preserva UX; trocar fonte reseta empresa).
// - Período usa draft + "Aplicar filtros": consumers leem `period` (valor aplicado),
//   não o draft — evita reprocessar a cada mudança de preset.
// A dimensão Filial não é separada: no Sisloc a própria empresa é a unidade operacional
// (matriz + filiais = cd_empresa distintos), então Empresa = Filial.
const GlobalFilterContext = createContext(null);
const STORAGE_KEY = "erp_global_filter_period";

export const PERIOD_PRESETS = [
  { id: "tudo", label: "Todo o período" },
  { id: "ano_atual", label: "Ano atual" },
  { id: "ultimos_12", label: "Últimos 12 meses" },
  { id: "ano_anterior", label: "Ano anterior" },
  { id: "personalizado", label: "Período personalizado" },
];

function isoDate(d) { return d.toISOString().slice(0, 10); }

// Fim máximo = amanhã (fim exclusivo que cobre hoje). Períodos não se estendem para o
// futuro: "Ano atual" vai de 1º de janeiro até hoje, e não até 31/12, evitando janelas
// que o banco teria de varrer sem dados e que pareciam "todo o período".
function maxEnd() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return isoDate(t);
}
function clampEnd(end) {
  const cap = maxEnd();
  return end > cap ? cap : end;
}

function presetRange(preset, customStart, customEnd) {
  const now = new Date();
  const y = now.getFullYear();
  const range = (() => {
    // "Todo o período": cobre todo o histórico operacional da base
    if (preset === "tudo") return { start: "2000-01-01", end: `${y + 1}-01-01` };
    if (preset === "ano_atual") return { start: `${y}-01-01`, end: `${y + 1}-01-01` };
    if (preset === "ano_anterior") return { start: `${y - 1}-01-01`, end: `${y}-01-01` };
    if (preset === "ultimos_12") {
      const start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start: isoDate(start), end: isoDate(end) };
    }
    return { start: customStart || `${y}-01-01`, end: customEnd || `${y + 1}-01-01` };
  })();
  return { start: range.start, end: clampEnd(range.end) };
}

function readStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}

export function GlobalFilterProvider({ children }) {
  const { selectedSource, selectSource, sources } = useErpSource();
  const { selectedEmpresa, setSelectedEmpresa, empresaList } = useEmpresaFilter();

  const [periodPreset, setPeriodPreset] = useState(() => readStored().preset || "ano_atual");
  const [customStart, setCustomStart] = useState(() => readStored().customStart || "");
  const [customEnd, setCustomEnd] = useState(() => readStored().customEnd || "");
  // Período aplicado (committed). Inicial = stored.applied ou range do preset inicial.
  const [appliedPeriod, setAppliedPeriod] = useState(() => {
    const s = readStored();
    return s.applied || presetRange(s.preset || "ano_atual", s.customStart || "", s.customEnd || "");
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset: periodPreset, customStart, customEnd, applied: appliedPeriod }));
  }, [periodPreset, customStart, customEnd, appliedPeriod]);

  const draftRange = useMemo(() => presetRange(periodPreset, customStart, customEnd), [periodPreset, customStart, customEnd]);

  const applyFilters = useCallback(() => {
    setAppliedPeriod({ start: draftRange.start, end: draftRange.end, preset: periodPreset });
  }, [draftRange, periodPreset]);

  // Valor que os consumers leem (aplicado, não o draft).
  const period = appliedPeriod;

  const setSource = useCallback((id) => {
    selectSource(id);
    setSelectedEmpresa(null);
  }, [selectSource, setSelectedEmpresa]);
  const setEmpresa = useCallback((id) => setSelectedEmpresa(id == null || id === "" ? null : Number(id)), [setSelectedEmpresa]);

  const hasPendingPeriod = appliedPeriod.start !== draftRange.start || appliedPeriod.end !== draftRange.end || appliedPeriod.preset !== periodPreset;

  return (
    <GlobalFilterContext.Provider value={{
      sourceId: selectedSource?.id || null,
      sourceName: selectedSource?.name || null,
      sources,
      setSource,
      empresaId: selectedEmpresa,
      empresaList,
      setEmpresa,
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