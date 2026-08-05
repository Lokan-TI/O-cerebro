import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useErpSnapshot } from "./ErpSnapshotContext";
import { getEmpresaLabel } from "@/lib/empresaLabels";

const EmpresaFilterContext = createContext(null);
const STORAGE_KEY = "erp_selected_empresa";

// Dimensão analítica empresa — fonte oficial: snapshot.by_empresa (KPIs por cd_empresa).
// selectedEmpresa === null  → "Todas as empresas" (consolidado + comparativo)
// selectedEmpresa === <cd> → apenas aquela empresa
export function EmpresaFilterProvider({ children }) {
  const { snapshot } = useErpSnapshot();
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  // Hidratar do localStorage uma única vez
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored != null && stored !== "all") {
      const n = Number(stored);
      if (!isNaN(n)) setSelectedEmpresa(n);
    }
    setHydrated(true);
  }, []);

  // Persistir seleção
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, selectedEmpresa == null ? "all" : String(selectedEmpresa));
  }, [selectedEmpresa, hydrated]);

  // dim_empresa derivada do snapshot (cd_empresa + nm_empresa resolvidos na sincronização)
  const empresaList = useMemo(() => {
    return (snapshot?.by_empresa || [])
      .map((e) => ({
        cd_empresa: e.cd_empresa,
        nm_empresa: e.nm_empresa || getEmpresaLabel(e.cd_empresa),
      }))
      .sort((a, b) => a.cd_empresa - b.cd_empresa);
  }, [snapshot?.by_empresa]);

  // Validar seleção: se a empresa selecionada não está mais na lista, voltar para "Todas"
  useEffect(() => {
    if (selectedEmpresa != null && empresaList.length > 0 &&
        !empresaList.some((e) => e.cd_empresa === selectedEmpresa)) {
      setSelectedEmpresa(null);
    }
  }, [empresaList, selectedEmpresa]);

  return (
    <EmpresaFilterContext.Provider
      value={{ selectedEmpresa, setSelectedEmpresa, empresaList }}
    >
      {children}
    </EmpresaFilterContext.Provider>
  );
}

export function useEmpresaFilter() {
  return useContext(EmpresaFilterContext);
}