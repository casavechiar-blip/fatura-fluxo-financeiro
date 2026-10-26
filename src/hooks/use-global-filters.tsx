import { createContext, useContext, useState, useEffect } from "react";

export interface FilterState {
  mes: string; // "todos" ou "AAAA-MM-01"
  forma: string; // "todas" ou nome do cartão/forma
  responsavel: string; // "todos" ou nome do responsável
  busca: string;
}

const STORAGE_KEY = "financas_filtros_globais";

const defaultFilters: FilterState = {
  mes: "todos",
  forma: "todas",
  responsavel: "todos",
  busca: "",
};

function carregarFiltrosIniciais(): FilterState {
  try {
    const salvo = sessionStorage.getItem(STORAGE_KEY);
    if (salvo) return { ...defaultFilters, ...JSON.parse(salvo) };
  } catch {
    // fallback
  }
  return defaultFilters;
}

interface FilterContextType {
  filtros: FilterState;
  setMes: (mes: string) => void;
  setForma: (forma: string) => void;
  setResponsavel: (responsavel: string) => void;
  setBusca: (busca: string) => void;
  limparFiltros: () => void;
}

const FilterContext = createContext<FilterContextType | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filtros, setFiltros] = useState<FilterState>(carregarFiltrosIniciais);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filtros));
    } catch {
      // ignore
    }
  }, [filtros]);

  const setMes = (mes: string) => setFiltros((prev) => ({ ...prev, mes }));
  const setForma = (forma: string) => setFiltros((prev) => ({ ...prev, forma }));
  const setResponsavel = (responsavel: string) => setFiltros((prev) => ({ ...prev, responsavel }));
  const setBusca = (busca: string) => setFiltros((prev) => ({ ...prev, busca }));
  const limparFiltros = () => setFiltros(defaultFilters);

  return (
    <FilterContext.Provider value={{ filtros, setMes, setForma, setResponsavel, setBusca, limparFiltros }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useGlobalFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) {
    throw new Error("useGlobalFilters deve ser usado dentro de um FilterProvider");
  }
  return ctx;
}
