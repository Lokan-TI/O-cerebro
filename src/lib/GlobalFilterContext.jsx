import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useErpSource } from "./ErpSourceContext";
import { useEmpresaFilter } from "./EmpresaFilterContext";
import { PERIOD_CONTRACT_VERSION, buildCanonicalPeriod } from "./periodContract";

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

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// A interface trabalha com fim INCLUSIVO; o contrato canônico deriva endExclusive.
// Nenhum preset se estende para o futuro: o máximo visível é hoje.
function maxEndInclusive() {
  return isoDate(new Date());
}
function clampEndInclusive(end) {
  const cap = maxEndInclusive();
  return end > cap ? cap : end;
}

function presetRange(preset, customStart, customEnd) {
  const now = new Date();
  const y = now.getFullYear();
  const today = maxEndInclusive();
  const range = (() => {
    if (preset === "tudo") return { start: "2000-01-01", end: today };
    if (preset === "ano_atual") return { start: `${y}-01-01`, end: today };
    if (preset === "ano_anterior") return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    if (preset === "ultimos_12") {
      const start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      return { start: isoDate(start), end: today };
    }
    return { start: customStart || `${y}-01-01`, end: customEnd || today };
  })();
  return buildCanonicalPeriod(range.start, clampEndInclusive(range.end), preset);
}

function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (parsed?.version === PERIOD_CONTRACT_VERSION) return parsed;
    // Migração v1 → v2: preserva escolha do usuário, mas recalcula a janela para
    // eliminar o antigo end ambíguo (às vezes inclusivo, às vezes exclusivo).
    return {
      preset: parsed?.preset,
      customStart: parsed?.customStart,
      customEnd: parsed?.customEnd,
    };
  } catch { return {}; }
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: PERIOD_CONTRACT_VERSION, preset: periodPreset, customStart, customEnd, applied: appliedPeriod }));
  }, [periodPreset, customStart, customEnd, appliedPeriod]);

  const draftRange = useMemo(() => presetRange(periodPreset, customStart, customEnd), [periodPreset, customStart, customEnd]);

  const applyFilters = useCallback(() => {
    setAppliedPeriod({ ...draftRange, preset: periodPreset });
  }, [draftRange, periodPreset]);

  // Valor que os consumers leem (aplicado, não o draft).
  const period = appliedPeriod;

  const setSource = useCallback((id) => {
    selectSource(id);
    setSelectedEmpresa(null);
  }, [selectSource, setSelectedEmpresa]);
  const setEmpresa = useCallback((id) => setSelectedEmpresa(id == null || id === "" ? null : Number(id)), [setSelectedEmpresa]);

  const hasPendingPeriod = appliedPeriod.start !== draftRange.start || appliedPeriod.endExclusive !== draftRange.endExclusive || appliedPeriod.preset !== periodPreset;

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